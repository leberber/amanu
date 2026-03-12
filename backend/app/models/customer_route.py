"""
Customer Route model for storing pre-fetched routes from depot to customers.
Routes are fetched once from Google Directions API and stored permanently.
Used for delivery route optimization without additional API calls.
"""
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Text, JSON
from typing import Optional, List
from datetime import datetime, timezone


class CustomerRoute(SQLModel, table=True):
    """
    Stores the route from depot to each customer.
    Fetched once from Google Directions API, used forever for routing optimization.
    """
    __tablename__ = "customer_routes"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Link to customer (user_id from users table)
    user_id: int = Field(foreign_key="users.id", unique=True, index=True)

    # Route polyline (encoded string from Google Directions API)
    # Decode with: polyline.decode(route_polyline) -> [(lat, lng), ...]
    route_polyline: str = Field(sa_column=Column(Text))

    # Distance and duration from depot
    distance_meters: int = Field(description="Distance from depot in meters")
    duration_seconds: int = Field(description="Estimated travel time in seconds")

    # Initial heading (compass direction from depot, 0-360)
    # Used for corridor grouping: 0=N, 90=E, 180=S, 270=W
    initial_heading: Optional[int] = Field(
        default=None,
        description="Initial compass heading from depot (0-360)"
    )

    # Corridor assignment (NORTH, NORTHEAST, EAST, SOUTHEAST, SOUTH, SOUTHWEST, WEST, NORTHWEST)
    corridor: Optional[str] = Field(
        default=None,
        max_length=20,
        index=True,
        description="Route corridor for grouping similar routes"
    )

    # First 20 points of decoded route for corridor analysis
    # Stored as JSON array: [[lat, lng], [lat, lng], ...]
    path_points_sample: Optional[List[List[float]]] = Field(
        default=None,
        sa_column=Column(JSON),
        description="First 20 points of decoded route for analysis"
    )

    # Address info from Google
    end_address: Optional[str] = Field(default=None, max_length=300)

    # Metadata
    fetched_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CustomerRouteCreate(SQLModel):
    """Model for creating a customer route (internal use)"""
    user_id: int
    route_polyline: str
    distance_meters: int
    duration_seconds: int
    initial_heading: Optional[int] = None
    corridor: Optional[str] = None
    path_points_sample: Optional[List[List[float]]] = None
    end_address: Optional[str] = None


class CustomerRouteRead(SQLModel):
    """Model for reading customer routes"""
    id: int
    user_id: int
    distance_meters: int
    duration_seconds: int
    initial_heading: Optional[int] = None
    corridor: Optional[str] = None
    end_address: Optional[str] = None
    fetched_at: datetime

    # Computed fields for convenience
    @property
    def distance_km(self) -> float:
        return round(self.distance_meters / 1000, 2)

    @property
    def duration_min(self) -> float:
        return round(self.duration_seconds / 60, 1)
