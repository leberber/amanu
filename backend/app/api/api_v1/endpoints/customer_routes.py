"""
Customer Routes API endpoints.
Fetch and manage routes from depot to customers using Google Directions API.
"""
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, text
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_session
from app.models.user import User, UserRole
from app.models.customer_route import CustomerRoute
from app.core.security import get_current_user
from app.services.customer_route_service import (
    fetch_and_save_route,
    fetch_all_customer_routes,
    get_customer_route,
    get_all_customer_routes,
    get_routes_by_corridor,
    delete_customer_route,
    delete_all_customer_routes,
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
    heading: Optional[float] = None
    corridor: Optional[str] = None

    @classmethod
    def from_route(cls, route: CustomerRoute) -> "CustomerRouteResponse":
        return cls(
            id=route.id,
            user_id=route.user_id,
            distance_meters=route.distance_meters,
            duration_seconds=route.duration_seconds,
            distance_km=round(route.distance_meters / 1000, 2),
            duration_min=round(route.duration_seconds / 60, 1),
            heading=route.heading,
            corridor=route.corridor,
        )


class FetchRouteRequest(BaseModel):
    user_id: int


class FetchRoutesResponse(BaseModel):
    total_customers: int
    fetched: int
    failed: int
    skipped: int


class CorridorStats(BaseModel):
    corridor: str
    count: int
    total_distance_km: float
    avg_distance_km: float


class CustomerRouteWithGeometry(BaseModel):
    """Route with coordinates for map display."""
    id: int
    user_id: int
    distance_meters: int
    duration_seconds: int
    distance_km: float
    duration_min: float
    heading: Optional[float] = None
    corridor: Optional[str] = None
    coordinates: List[List[float]] = []  # [[lng, lat], [lng, lat], ...]


class UpdateRouteRequest(BaseModel):
    """Request to update route data manually."""
    corridor: Optional[str] = None
    distance_km: Optional[float] = None
    duration_min: Optional[float] = None


# Endpoints

@router.get("/", response_model=List[CustomerRouteResponse])
def list_routes(
    corridor: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List all stored customer routes. Admin only."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")

    if corridor:
        routes = get_routes_by_corridor(session, corridor)
    else:
        routes = get_all_customer_routes(session)

    return [CustomerRouteResponse.from_route(r) for r in routes]


@router.get("/with-geometry", response_model=List[CustomerRouteWithGeometry])
def list_routes_with_geometry(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    List all customer routes with geometry coordinates for map display.
    Returns coordinates as [[lng, lat], ...] arrays.
    Admin only.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")

    # Query routes with geometry as GeoJSON
    result = session.exec(text("""
        SELECT
            id, user_id, distance_meters, duration_seconds,
            heading, corridor,
            ST_AsGeoJSON(route_geom)::json as geojson
        FROM customer_routes
        WHERE route_geom IS NOT NULL
        ORDER BY corridor, heading
    """))

    routes = []
    for row in result:
        coordinates = []
        if row[6]:  # geojson
            geojson = row[6] if isinstance(row[6], dict) else json.loads(row[6])
            coordinates = geojson.get('coordinates', [])

        routes.append(CustomerRouteWithGeometry(
            id=row[0],
            user_id=row[1],
            distance_meters=row[2],
            duration_seconds=row[3],
            distance_km=round(row[2] / 1000, 2),
            duration_min=round(row[3] / 60, 1),
            heading=row[4],
            corridor=row[5],
            coordinates=coordinates
        ))

    return routes


@router.get("/stats", response_model=List[CorridorStats])
def get_corridor_stats(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get statistics by corridor. Admin only."""
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
    """Get stored route for a specific customer. Admin only."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")

    route = get_customer_route(session, user_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found for this user")

    return CustomerRouteResponse.from_route(route)


@router.patch("/{user_id}", response_model=CustomerRouteResponse)
def update_route(
    user_id: int,
    request: UpdateRouteRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update route data manually (corridor, distance, duration). Admin only."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")

    route = get_customer_route(session, user_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found for this user")

    # Update fields if provided
    if request.corridor is not None:
        route.corridor = request.corridor
    if request.distance_km is not None:
        route.distance_meters = int(request.distance_km * 1000)
    if request.duration_min is not None:
        route.duration_seconds = int(request.duration_min * 60)

    session.add(route)
    session.commit()
    session.refresh(route)

    return CustomerRouteResponse.from_route(route)


@router.post("/fetch", response_model=CustomerRouteResponse)
def fetch_single_route(
    request: FetchRouteRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Fetch route for a single customer using Google. Admin only."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")

    user = session.get(User, request.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.latitude or not user.longitude:
        raise HTTPException(status_code=400, detail="User has no coordinates")

    route = fetch_and_save_route(
        session,
        user.id,
        user.latitude,
        user.longitude,
        user.commune
    )

    if not route:
        raise HTTPException(status_code=500, detail="Failed to fetch route from Google")

    return CustomerRouteResponse.from_route(route)


@router.post("/fetch-all", response_model=FetchRoutesResponse)
def fetch_all_routes(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Fetch routes for all customers using Google.
    Only fetches for customers without existing routes.
    Admin only.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")

    result = fetch_all_customer_routes(session, only_missing=True)

    return FetchRoutesResponse(**result)


@router.post("/refetch-all", response_model=FetchRoutesResponse)
def refetch_all_routes(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Re-fetch routes for ALL customers (including existing ones).
    Admin only.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")

    result = fetch_all_customer_routes(session, only_missing=False)

    return FetchRoutesResponse(**result)


@router.delete("/{user_id}")
def delete_route(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Delete a customer's route. Admin only."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")

    if delete_customer_route(session, user_id):
        return {"message": "Route deleted"}
    else:
        raise HTTPException(status_code=404, detail="Route not found")


@router.delete("/")
def delete_all_routes(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Delete ALL customer routes. Admin only."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")

    count = delete_all_customer_routes(session)
    return {"message": f"Deleted {count} routes"}
