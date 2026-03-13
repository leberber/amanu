"""
Customer Route Service
Fetches routes from Google Directions API and stores in database.
"""
import os
import math
import requests
from typing import Optional, List, Dict
from datetime import datetime, timezone
from sqlmodel import Session, select

from app.core.config import settings
from app.models.customer_route import CustomerRoute
from app.models.user import User, UserRole

# Try to import polyline, fallback to manual decode
try:
    from polyline import decode as decode_polyline
except ImportError:
    def decode_polyline(encoded: str) -> List[tuple]:
        """Decode Google polyline to list of (lat, lng) tuples."""
        coords = []
        index = 0
        lat = 0
        lng = 0
        while index < len(encoded):
            # Decode latitude
            shift = 0
            result = 0
            while True:
                b = ord(encoded[index]) - 63
                index += 1
                result |= (b & 0x1f) << shift
                shift += 5
                if b < 0x20:
                    break
            lat += (~(result >> 1) if result & 1 else result >> 1)

            # Decode longitude
            shift = 0
            result = 0
            while True:
                b = ord(encoded[index]) - 63
                index += 1
                result |= (b & 0x1f) << shift
                shift += 5
                if b < 0x20:
                    break
            lng += (~(result >> 1) if result & 1 else result >> 1)

            coords.append((lat / 1e5, lng / 1e5))
        return coords


def calculate_heading(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Calculate initial heading (bearing) from point 1 to point 2.
    Returns degrees (0-360, where 0=North, 90=East, 180=South, 270=West)
    """
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lng = math.radians(lng2 - lng1)

    x = math.sin(delta_lng) * math.cos(lat2_rad)
    y = math.cos(lat1_rad) * math.sin(lat2_rad) - \
        math.sin(lat1_rad) * math.cos(lat2_rad) * math.cos(delta_lng)

    heading = math.degrees(math.atan2(x, y))
    return (heading + 360) % 360


def fetch_route_from_google(
    depot_lat: float,
    depot_lng: float,
    customer_lat: float,
    customer_lng: float
) -> Optional[Dict]:
    """
    Fetch route from depot to customer using Google Directions API.

    Returns dict with:
        - distance_meters
        - duration_seconds
        - polyline
        - heading
    """
    api_key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not api_key:
        print("ERROR: GOOGLE_MAPS_API_KEY not set")
        return None

    params = {
        "origin": f"{depot_lat},{depot_lng}",
        "destination": f"{customer_lat},{customer_lng}",
        "key": api_key,
    }

    try:
        response = requests.get(
            "https://maps.googleapis.com/maps/api/directions/json",
            params=params,
            timeout=10
        )
        data = response.json()

        if data["status"] != "OK":
            print(f"Google API error: {data['status']}")
            return None

        route = data["routes"][0]
        leg = route["legs"][0]

        # Get encoded polyline
        polyline = route["overview_polyline"]["points"]

        # Decode to get first segment for heading calculation
        coords = decode_polyline(polyline)

        # Calculate heading from first two points of route
        if len(coords) >= 2:
            heading = calculate_heading(coords[0][0], coords[0][1], coords[1][0], coords[1][1])
        else:
            # Fallback: direct heading from depot to customer
            heading = calculate_heading(depot_lat, depot_lng, customer_lat, customer_lng)

        return {
            "distance_meters": leg["distance"]["value"],
            "duration_seconds": leg["duration"]["value"],
            "polyline": polyline,
            "heading": round(heading, 1),
        }

    except Exception as e:
        print(f"Error fetching route from Google: {e}")
        return None


def fetch_and_save_route(
    session: Session,
    user_id: int,
    lat: float,
    lng: float,
    commune: Optional[str] = None
) -> Optional[CustomerRoute]:
    """
    Fetch route from depot to customer using Google and save to database.

    Args:
        session: Database session
        user_id: Customer user ID
        lat: Customer latitude
        lng: Customer longitude
        commune: Customer commune (for corridor name)

    Returns:
        CustomerRoute or None if failed
    """
    # Fetch from Google
    route_data = fetch_route_from_google(
        settings.DEPOT_LATITUDE,
        settings.DEPOT_LONGITUDE,
        lat,
        lng
    )

    if route_data is None:
        return None

    # Build corridor name
    corridor = f"Direction {commune}" if commune else None

    # Check if route already exists
    existing = session.exec(
        select(CustomerRoute).where(CustomerRoute.user_id == user_id)
    ).first()

    if existing:
        # Update existing record
        existing.distance_meters = route_data["distance_meters"]
        existing.duration_seconds = route_data["duration_seconds"]
        existing.route_polyline = route_data["polyline"]
        existing.heading = route_data["heading"]
        existing.corridor = corridor
        existing.fetched_at = datetime.now(timezone.utc)
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing
    else:
        # Create new record
        new_route = CustomerRoute(
            user_id=user_id,
            distance_meters=route_data["distance_meters"],
            duration_seconds=route_data["duration_seconds"],
            route_polyline=route_data["polyline"],
            heading=route_data["heading"],
            corridor=corridor,
        )
        session.add(new_route)
        session.commit()
        session.refresh(new_route)
        return new_route


def fetch_all_customer_routes(session: Session, only_missing: bool = True) -> Dict:
    """
    Fetch routes for all customers with coordinates.

    Args:
        session: Database session
        only_missing: If True, skip customers who already have routes

    Returns:
        Dict with stats (fetched, failed, skipped)
    """
    # Get customers with coordinates
    customers = session.exec(
        select(User).where(
            User.role == UserRole.CUSTOMER,
            User.latitude.isnot(None),
            User.longitude.isnot(None)
        )
    ).all()

    # Get existing routes if only_missing
    existing_user_ids = set()
    if only_missing:
        existing = session.exec(select(CustomerRoute.user_id)).all()
        existing_user_ids = set(existing)

    fetched = 0
    failed = 0
    skipped = 0

    for customer in customers:
        if customer.id in existing_user_ids:
            skipped += 1
            continue

        print(f"Fetching route for {customer.full_name}...")

        route = fetch_and_save_route(
            session,
            customer.id,
            customer.latitude,
            customer.longitude,
            customer.commune
        )

        if route:
            print(f"  OK: {route.distance_km} km, heading {route.heading}°")
            fetched += 1
        else:
            print(f"  FAILED")
            failed += 1

    return {
        "total_customers": len(customers),
        "fetched": fetched,
        "failed": failed,
        "skipped": skipped,
    }


def get_customer_route(session: Session, user_id: int) -> Optional[CustomerRoute]:
    """Get stored route for a customer."""
    return session.exec(
        select(CustomerRoute).where(CustomerRoute.user_id == user_id)
    ).first()


def get_all_customer_routes(session: Session) -> List[CustomerRoute]:
    """Get all stored customer routes."""
    return session.exec(select(CustomerRoute)).all()


def get_routes_by_corridor(session: Session, corridor: str) -> List[CustomerRoute]:
    """Get all routes in a specific corridor."""
    return session.exec(
        select(CustomerRoute).where(CustomerRoute.corridor == corridor)
    ).all()


def delete_customer_route(session: Session, user_id: int) -> bool:
    """Delete a customer's route."""
    route = session.exec(
        select(CustomerRoute).where(CustomerRoute.user_id == user_id)
    ).first()

    if route:
        session.delete(route)
        session.commit()
        return True
    return False


def delete_all_customer_routes(session: Session) -> int:
    """Delete all customer routes. Returns count deleted."""
    routes = session.exec(select(CustomerRoute)).all()
    count = len(routes)
    for route in routes:
        session.delete(route)
    session.commit()
    return count
