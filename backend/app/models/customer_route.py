"""
Customer Route model for storing routes from depot to customers.
Routes are fetched from Google Directions API.
Used for delivery route optimization and batching.
"""
from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime, timezone


class CustomerRoute(SQLModel, table=True):
    """
    Stores the route from depot to each customer.
    Fetched from Google Directions API.
    """
    __tablename__ = "customer_routes"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", unique=True, index=True)

    # === Route data from Google ===
    distance_meters: int = Field(default=0, description="Route distance in meters")
    duration_seconds: int = Field(default=0, description="Estimated travel time in seconds")
    route_polyline: Optional[str] = Field(default=None, description="Encoded polyline from Google")

    # === Direction/Heading ===
    heading: Optional[float] = Field(
        default=None,
        description="Initial heading from depot (0-360 degrees, 0=North)"
    )

    # === Corridor (Direction + Commune) ===
    corridor: Optional[str] = Field(
        default=None,
        max_length=100,
        index=True,
        description="Direction label, e.g. 'Direction Ouadhia'"
    )

    # === Timestamp ===
    fetched_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def distance_km(self) -> float:
        return round(self.distance_meters / 1000, 2)

    @property
    def duration_min(self) -> float:
        return round(self.duration_seconds / 60, 1)
