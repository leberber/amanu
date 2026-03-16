"""
Trip models for order batching and multi-stop deliveries.
A Trip groups multiple orders for a single driver route.
"""
from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime, timezone
from enum import Enum

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.order import Order, OrderItemRead


class TripStatus(str, Enum):
    """Trip status enumeration"""
    PENDING = "PENDING"          # Trip created, waiting for driver
    ASSIGNED = "ASSIGNED"        # Driver has accepted the trip
    IN_PROGRESS = "IN_PROGRESS"  # Driver is delivering
    COMPLETED = "COMPLETED"      # All stops delivered
    CANCELLED = "CANCELLED"      # Trip cancelled


class StopStatus(str, Enum):
    """Individual stop status enumeration"""
    PENDING = "pending"      # Not yet reached
    ARRIVED = "arrived"      # Driver arrived at stop
    DELIVERED = "delivered"  # Order delivered at this stop
    FAILED = "failed"        # Delivery failed at this stop


# =============================================================================
# DATABASE MODELS
# =============================================================================

class Trip(SQLModel, table=True):
    """
    Database model for delivery trips.
    A trip contains multiple stops (orders) for a single driver route.
    """
    __tablename__ = "trips"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Driver assignment
    driver_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    suggested_driver_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True, description="Suggested driver based on corridor preference")

    # Trip status
    status: TripStatus = Field(default=TripStatus.PENDING)

    # Corridor/Route info
    corridor: Optional[str] = Field(default=None, max_length=100, description="Corridor/route name for this trip")

    # Capacity totals
    total_weight_kg: float = Field(default=0.0, description="Combined weight of all orders")
    total_volume_m3: float = Field(default=0.0, description="Combined volume of all orders")

    # Route info
    estimated_distance_km: float = Field(default=0.0, description="Total estimated route distance")
    estimated_duration_min: float = Field(default=0.0, description="Total estimated route duration")

    # Geographic grouping (H3 zone for batching)
    h3_zone: Optional[str] = Field(default=None, index=True, description="H3 zone for geographic grouping")

    # Earnings
    total_earnings: float = Field(default=0.0, description="Total driver earnings for this trip")

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)
    assigned_at: Optional[datetime] = Field(default=None)
    started_at: Optional[datetime] = Field(default=None)
    picked_up_at: Optional[datetime] = Field(default=None)
    completed_at: Optional[datetime] = Field(default=None)
    cancelled_at: Optional[datetime] = Field(default=None)

    # Created by (admin who triggered batching)
    created_by_id: Optional[int] = Field(default=None, foreign_key="users.id")

    # Relationships
    driver: Optional["User"] = Relationship(sa_relationship_kwargs={"foreign_keys": "[Trip.driver_id]"})
    stops: List["TripStop"] = Relationship(back_populates="trip", sa_relationship_kwargs={"cascade": "all, delete-orphan"})


class TripStop(SQLModel, table=True):
    """
    Database model for individual stops within a trip.
    Each stop corresponds to one order delivery.
    """
    __tablename__ = "trip_stops"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Parent trip
    trip_id: int = Field(foreign_key="trips.id", index=True)

    # Order being delivered at this stop
    order_id: int = Field(foreign_key="orders.id", index=True)

    # Stop sequence (1, 2, 3, etc.)
    sequence: int = Field(description="Order of this stop in the route")

    # Stop status
    status: StopStatus = Field(default=StopStatus.PENDING)

    # Estimated timing
    estimated_arrival: Optional[datetime] = Field(default=None)

    # Actual timing
    arrived_at: Optional[datetime] = Field(default=None)
    delivered_at: Optional[datetime] = Field(default=None)

    # Delivery notes
    notes: Optional[str] = Field(default=None, max_length=500)

    # Relationships
    trip: Optional["Trip"] = Relationship(back_populates="stops")
    order: Optional["Order"] = Relationship()


# =============================================================================
# READ MODELS (API Responses)
# =============================================================================

class TripStopOrderItem(SQLModel):
    """Simplified order item for trip stop display"""
    id: int
    product_id: int
    quantity: float
    unit_price: float
    product_name: str
    product_unit: str


class TripStopRead(SQLModel):
    """Model for reading trip stops in API responses"""
    id: int
    trip_id: int
    order_id: int
    sequence: int
    status: StopStatus
    estimated_arrival: Optional[datetime] = None
    arrived_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    notes: Optional[str] = None

    # Order details (populated by endpoint)
    customer_name: Optional[str] = None
    shipping_address: Optional[str] = None
    contact_phone: Optional[str] = None
    order_total: Optional[float] = None

    # Order items (populated by endpoint)
    order_items: List["TripStopOrderItem"] = []

    # Location coordinates (for map display)
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    model_config = {"from_attributes": True, "use_enum_values": True}


class TripRead(SQLModel):
    """Model for reading trips in API responses"""
    id: int
    driver_id: Optional[int] = None
    suggested_driver_id: Optional[int] = None
    status: TripStatus
    corridor: Optional[str] = None
    total_weight_kg: float
    total_volume_m3: float
    estimated_distance_km: float
    estimated_duration_min: float
    h3_zone: Optional[str] = None
    total_earnings: float
    created_at: datetime
    updated_at: Optional[datetime] = None
    assigned_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    picked_up_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None

    # Stop count
    total_stops: int = 0
    completed_stops: int = 0

    # Driver info (populated by endpoint)
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None

    # Suggested driver info (populated by endpoint)
    suggested_driver_name: Optional[str] = None

    model_config = {"from_attributes": True, "use_enum_values": True}


class TripWithStops(TripRead):
    """Extended trip model that includes all stops"""
    stops: List[TripStopRead] = []
    # Route coordinates for map display [[lat, lng], ...]
    route_coords: List[List[float]] = []


# =============================================================================
# CREATE/UPDATE MODELS
# =============================================================================

class TripCreate(SQLModel):
    """Model for creating a trip (used by batching service)"""
    order_ids: List[int]  # Orders to include in this trip
    h3_zone: Optional[str] = None


class TripStopUpdate(SQLModel):
    """Model for updating a trip stop"""
    status: Optional[StopStatus] = None
    notes: Optional[str] = None


class TripUpdate(SQLModel):
    """Model for updating a trip"""
    status: Optional[TripStatus] = None
    driver_id: Optional[int] = None
