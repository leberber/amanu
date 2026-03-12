"""
Customer Routes API endpoints.
Manages pre-fetched routes from depot to customers for delivery optimization.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_session
from app.models.user import User, UserRole
from app.models.customer_route import CustomerRoute
from app.core.security import get_current_user
from app.services.customer_route_service import (
    fetch_and_save_route,
    get_customer_route,
    get_all_customer_routes,
    get_routes_by_corridor,
    delete_customer_route,
    get_gmaps_client,
)

router = APIRouter()


# Response models
class CustomerRouteResponse(BaseModel):
    id: int
    user_id: int
    distance_meters: int
    duration_seconds: int
    distance_km: float
    duration_min: float
    initial_heading: Optional[int] = None
    corridor: Optional[str] = None
    end_address: Optional[str] = None
    route_polyline: Optional[str] = None

    @classmethod
    def from_route(cls, route: CustomerRoute) -> "CustomerRouteResponse":
        return cls(
            id=route.id,
            user_id=route.user_id,
            distance_meters=route.distance_meters,
            duration_seconds=route.duration_seconds,
            distance_km=round(route.distance_meters / 1000, 2),
            duration_min=round(route.duration_seconds / 60, 1),
            initial_heading=route.initial_heading,
            corridor=route.corridor,
            end_address=route.end_address,
            route_polyline=route.route_polyline,
        )


class FetchRouteRequest(BaseModel):
    user_id: int


class FetchAllRoutesRequest(BaseModel):
    user_ids: Optional[List[int]] = None  # If None, fetch for all users with coordinates


class FetchRoutesResponse(BaseModel):
    fetched: int
    failed: int
    skipped: int
    routes: List[CustomerRouteResponse]


class CorridorStats(BaseModel):
    corridor: str
    count: int
    total_distance_km: float
    avg_distance_km: float


# Endpoints

@router.get("/", response_model=List[CustomerRouteResponse])
def list_routes(
    corridor: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    List all stored customer routes.
    Admin only.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")

    if corridor:
        routes = get_routes_by_corridor(session, corridor)
    else:
        routes = get_all_customer_routes(session)

    return [CustomerRouteResponse.from_route(r) for r in routes]


@router.get("/stats", response_model=List[CorridorStats])
def get_corridor_stats(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get statistics by corridor.
    Admin only.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")

    routes = get_all_customer_routes(session)

    # Group by corridor
    corridors = {}
    for route in routes:
        c = route.corridor or 'UNKNOWN'
        if c not in corridors:
            corridors[c] = {'count': 0, 'total_distance': 0}
        corridors[c]['count'] += 1
        corridors[c]['total_distance'] += route.distance_meters

    return [
        CorridorStats(
            corridor=c,
            count=data['count'],
            total_distance_km=round(data['total_distance'] / 1000, 2),
            avg_distance_km=round(data['total_distance'] / data['count'] / 1000, 2) if data['count'] > 0 else 0
        )
        for c, data in sorted(corridors.items())
    ]


@router.get("/{user_id}", response_model=CustomerRouteResponse)
def get_route(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get stored route for a specific customer.
    Admin only.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")

    route = get_customer_route(session, user_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found for this user")

    return CustomerRouteResponse.from_route(route)


@router.post("/fetch", response_model=CustomerRouteResponse)
def fetch_single_route(
    request: FetchRouteRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Fetch route from Google for a single customer and save to database.
    Admin only. Cost: ~$0.005 per call.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")

    # Check if Google API key is configured
    if not get_gmaps_client():
        raise HTTPException(status_code=500, detail="Google Maps API key not configured")

    # Get user with coordinates
    user = session.get(User, request.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.latitude or not user.longitude:
        raise HTTPException(status_code=400, detail="User has no coordinates")

    # Fetch and save route
    route = fetch_and_save_route(session, user.id, user.latitude, user.longitude)

    if not route:
        raise HTTPException(status_code=500, detail="Failed to fetch route from Google")

    return CustomerRouteResponse.from_route(route)


@router.post("/fetch-all", response_model=FetchRoutesResponse)
def fetch_all_routes(
    request: FetchAllRoutesRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Fetch routes from Google for multiple customers and save to database.
    Admin only. Cost: ~$0.005 per customer.

    If user_ids is empty/null, fetches for all users with coordinates who don't have routes yet.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")

    # Check if Google API key is configured
    gmaps = get_gmaps_client()
    if not gmaps:
        raise HTTPException(status_code=500, detail="Google Maps API key not configured")

    # Get users to fetch
    if request.user_ids:
        users = session.exec(
            select(User).where(User.id.in_(request.user_ids))
        ).all()
    else:
        # Get all users with coordinates who don't have routes
        existing_routes = session.exec(select(CustomerRoute.user_id)).all()
        existing_ids = set(existing_routes)

        users = session.exec(
            select(User).where(
                User.latitude.isnot(None),
                User.longitude.isnot(None)
            )
        ).all()
        users = [u for u in users if u.id not in existing_ids]

    fetched = 0
    failed = 0
    skipped = 0
    routes = []

    for user in users:
        if not user.latitude or not user.longitude:
            skipped += 1
            continue

        try:
            route = fetch_and_save_route(session, user.id, user.latitude, user.longitude)
            if route:
                fetched += 1
                routes.append(CustomerRouteResponse.from_route(route))
            else:
                failed += 1
        except Exception as e:
            print(f"Error fetching route for user {user.id}: {e}")
            failed += 1

    return FetchRoutesResponse(
        fetched=fetched,
        failed=failed,
        skipped=skipped,
        routes=routes
    )


@router.delete("/{user_id}")
def delete_route(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a customer's route.
    Admin only.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")

    if delete_customer_route(session, user_id):
        return {"message": "Route deleted"}
    else:
        raise HTTPException(status_code=404, detail="Route not found")
