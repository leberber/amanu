"""
Customer Route Service
Handles fetching routes from Google Directions API and storing them in the database.
"""
import googlemaps
import polyline
from typing import Optional, List, Dict, Tuple
from datetime import datetime, timezone, time
from math import radians, cos, sin, atan2, degrees
from sqlmodel import Session, select

from app.core.config import settings
from app.models.customer_route import CustomerRoute, CustomerRouteCreate


# Corridor ranges based on actual delivery roads from Ouadhia depot
# Analyzed from 48 stored routes - customers cluster in 2 main corridors:
#   - TIZI_OUZOU: N30 road northwest toward Tizi Ouzou / Ait Bouaddou (heading ~302°)
#   - AGOUNI_GUEGHRANE: Road southeast toward Agouni Gueghrane (heading ~124°)
CORRIDOR_RANGES = {
    'TIZI_OUZOU': (270, 340),        # Northwest: N30 road toward Tizi Ouzou
    'AGOUNI_GUEGHRANE': (100, 160),  # Southeast: Road toward Agouni Gueghrane
}


def get_gmaps_client() -> Optional[googlemaps.Client]:
    """Get Google Maps client if API key is configured."""
    if not settings.GOOGLE_MAPS_API_KEY:
        return None
    return googlemaps.Client(key=settings.GOOGLE_MAPS_API_KEY)


def calculate_heading(from_point: Tuple[float, float], to_point: Tuple[float, float]) -> float:
    """
    Calculate compass heading (bearing) from one point to another.
    Returns degrees (0-360) where 0=North, 90=East, 180=South, 270=West
    """
    lat1, lon1 = radians(from_point[0]), radians(from_point[1])
    lat2, lon2 = radians(to_point[0]), radians(to_point[1])

    dlon = lon2 - lon1
    x = cos(lat2) * sin(dlon)
    y = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dlon)

    heading = degrees(atan2(x, y))
    return (heading + 360) % 360


def get_corridor(heading: float) -> str:
    """Assign corridor based on heading."""
    for corridor, (min_h, max_h) in CORRIDOR_RANGES.items():
        if min_h <= heading < max_h:
            return corridor
    return 'OTHER'  # Fallback for customers outside main corridors


def fetch_route_from_google(
    destination_lat: float,
    destination_lng: float,
    gmaps_client: googlemaps.Client = None
) -> Optional[Dict]:
    """
    Fetch a single route from depot to destination using Google Directions API.

    Returns dict with route data or None if failed.
    """
    if gmaps_client is None:
        gmaps_client = get_gmaps_client()

    if gmaps_client is None:
        raise ValueError("Google Maps API key not configured")

    # Use 5 PM departure time for realistic traffic
    today = datetime.now().date()
    departure_time = datetime.combine(today, time(17, 0))

    try:
        result = gmaps_client.directions(
            origin=(settings.DEPOT_LATITUDE, settings.DEPOT_LONGITUDE),
            destination=(destination_lat, destination_lng),
            mode='driving',
            language='fr',
            region='dz',
            departure_time=departure_time
        )

        if not result:
            return None

        route = result[0]
        leg = route['legs'][0]

        # Decode polyline
        encoded_polyline = route['overview_polyline']['points']
        path_points = polyline.decode(encoded_polyline)

        # Calculate heading from first two points
        heading = None
        corridor = None
        if len(path_points) >= 2:
            heading = round(calculate_heading(path_points[0], path_points[1]))
            corridor = get_corridor(heading)

        return {
            'polyline': encoded_polyline,
            'distance_meters': leg['distance']['value'],
            'duration_seconds': leg['duration']['value'],
            'initial_heading': heading,
            'corridor': corridor,
            'path_points_sample': [list(p) for p in path_points[:20]],
            'end_address': leg.get('end_address'),
        }

    except Exception as e:
        print(f"Error fetching route: {e}")
        return None


def save_customer_route(
    session: Session,
    user_id: int,
    route_data: Dict
) -> CustomerRoute:
    """
    Save or update a customer route in the database.
    """
    # Check if route already exists
    existing = session.exec(
        select(CustomerRoute).where(CustomerRoute.user_id == user_id)
    ).first()

    if existing:
        # Update existing record
        existing.route_polyline = route_data['polyline']
        existing.distance_meters = route_data['distance_meters']
        existing.duration_seconds = route_data['duration_seconds']
        existing.initial_heading = route_data.get('initial_heading')
        existing.corridor = route_data.get('corridor')
        existing.path_points_sample = route_data.get('path_points_sample')
        existing.end_address = route_data.get('end_address')
        existing.fetched_at = datetime.now(timezone.utc)
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing
    else:
        # Create new record
        new_route = CustomerRoute(
            user_id=user_id,
            route_polyline=route_data['polyline'],
            distance_meters=route_data['distance_meters'],
            duration_seconds=route_data['duration_seconds'],
            initial_heading=route_data.get('initial_heading'),
            corridor=route_data.get('corridor'),
            path_points_sample=route_data.get('path_points_sample'),
            end_address=route_data.get('end_address'),
        )
        session.add(new_route)
        session.commit()
        session.refresh(new_route)
        return new_route


def fetch_and_save_route(
    session: Session,
    user_id: int,
    lat: float,
    lng: float
) -> Optional[CustomerRoute]:
    """
    Fetch route from Google for a customer and save to database.
    This is the main function to call when a new customer registers.

    Cost: ~$0.005 per call
    """
    route_data = fetch_route_from_google(lat, lng)

    if route_data is None:
        return None

    return save_customer_route(session, user_id, route_data)


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
    """Delete a customer's route (e.g., when customer is deleted)."""
    route = session.exec(
        select(CustomerRoute).where(CustomerRoute.user_id == user_id)
    ).first()

    if route:
        session.delete(route)
        session.commit()
        return True
    return False
