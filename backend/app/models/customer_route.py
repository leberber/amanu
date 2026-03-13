"""
Customer Route model for storing routes from depot to customers.
Routes are fetched from OSMnx and stored with PostGIS geometry.
Used for delivery route optimization.
"""
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, event
from sqlalchemy.schema import DDL
from geoalchemy2 import Geometry
from typing import Optional
from datetime import datetime, timezone


class CustomerRoute(SQLModel, table=True):
    """
    Stores the route from depot to each customer.
    Fetched from OSMnx, geometry stored as PostGIS LineString.
    """
    __tablename__ = "customer_routes"

    # === Primary key and foreign keys ===
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", unique=True, index=True)
    major_road_id: Optional[int] = Field(
        default=None,
        foreign_key="major_roads.id",
        index=True,
        description="Main corridor this route uses"
    )

    # === Route data ===
    distance_meters: int = Field(description="Route distance in meters")
    duration_seconds: int = Field(description="Estimated travel time in seconds")

    # === Corridor (denormalized for convenience) ===
    corridor: Optional[str] = Field(
        default=None,
        max_length=50,
        index=True,
        description="Road ref from major_roads (e.g., 'RN 30')"
    )

    # === Timestamp ===
    fetched_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Add geometry column separately (SQLModel doesn't support it directly)
CustomerRoute.__table__.append_column(
    Column('geom', Geometry('LINESTRING', srid=4326), nullable=True)
)

# Create spatial index after table creation
event.listen(
    CustomerRoute.__table__,
    'after_create',
    DDL('CREATE INDEX IF NOT EXISTS idx_customer_routes_geom ON customer_routes USING GIST (geom)')
)


class CustomerRouteCreate(SQLModel):
    """Model for creating a customer route."""
    user_id: int
    major_road_id: Optional[int] = None
    distance_meters: int
    duration_seconds: int
    corridor: Optional[str] = None


class CustomerRouteRead(SQLModel):
    """Model for reading customer routes."""
    id: int
    user_id: int
    major_road_id: Optional[int]
    distance_meters: int
    duration_seconds: int
    corridor: Optional[str]
    fetched_at: datetime

    @property
    def distance_km(self) -> float:
        return round(self.distance_meters / 1000, 2)

    @property
    def duration_min(self) -> float:
        return round(self.duration_seconds / 60, 1)
