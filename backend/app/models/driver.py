from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime, timezone
from enum import Enum

if TYPE_CHECKING:
    from app.models.user import User


class VehicleType(str, Enum):
    """Vehicle type enumeration"""
    TRUCK = "truck"
    VAN = "van"
    MINI_VAN = "mini_van"


class DriverStatus(str, Enum):
    """Driver status enumeration"""
    AVAILABLE = "available"
    BUSY = "busy"  # Has active orders
    OFFLINE = "offline"
    SUSPENDED = "suspended"


class DriverProfileBase(SQLModel):
    """Base driver profile model"""
    model_config = {"use_enum_values": True}

    vehicle_type: VehicleType
    capacity_kg: Optional[float] = Field(default=None, description="Weight capacity in kg")
    capacity_volume: Optional[float] = Field(default=None, description="Volume capacity in m³")


class DriverProfile(SQLModel, table=True):
    """Database model for driver profiles"""
    __tablename__ = "driver_profiles"

    # ID and user_id first
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", unique=True, index=True)

    # Vehicle info (from DriverProfileBase)
    vehicle_type: VehicleType
    capacity_kg: Optional[float] = Field(default=None, description="Weight capacity in kg")
    capacity_volume: Optional[float] = Field(default=None, description="Volume capacity in m³")

    # Status & timestamps
    status: DriverStatus = Field(default=DriverStatus.OFFLINE, description="Current driver status")
    is_available: bool = Field(default=True, description="Driver availability for new orders")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)

    # Performance stats
    total_deliveries: int = Field(default=0, description="Total completed deliveries")
    total_earnings: float = Field(default=0.0, description="Total earnings from deliveries")
    average_rating: Optional[float] = Field(default=None, ge=1.0, le=5.0, description="Average customer rating")
    total_ratings: int = Field(default=0, description="Number of ratings received")

    # Active order tracking
    active_orders_count: int = Field(default=0, description="Current active orders")
    max_active_orders: int = Field(default=3, description="Maximum concurrent orders allowed")

    # Cancellation tracking
    cancellation_count: int = Field(default=0, description="Total order cancellations")
    cancellation_count_period: int = Field(default=0, description="Cancellations in current period")
    last_cancellation_at: Optional[datetime] = Field(default=None)
    period_start: Optional[datetime] = Field(default=None, description="Start of current tracking period")

    # Flagging/suspension
    is_flagged: bool = Field(default=False, description="Driver is flagged for review")
    flag_reason: Optional[str] = Field(default=None, max_length=500)
    flagged_at: Optional[datetime] = Field(default=None)
    flagged_by_id: Optional[int] = Field(default=None, foreign_key="users.id")
    suspended_until: Optional[datetime] = Field(default=None, description="Suspension end time")

    # Relationship
    user: Optional["User"] = Relationship(back_populates="driver_profile", sa_relationship_kwargs={"foreign_keys": "[DriverProfile.user_id]"})


class DriverProfileCreate(DriverProfileBase):
    """Model for creating a driver profile"""
    pass


class DriverProfileRead(DriverProfileBase):
    """Model for reading driver profiles"""
    id: int
    user_id: int
    status: DriverStatus
    is_available: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    # Stats
    total_deliveries: int = 0
    total_earnings: float = 0.0
    average_rating: Optional[float] = None
    total_ratings: int = 0
    active_orders_count: int = 0
    max_active_orders: int = 3

    model_config = {"from_attributes": True, "use_enum_values": True}


class DriverProfileWithFlags(DriverProfileRead):
    """Extended profile with flagging info (for admin)"""
    cancellation_count: int = 0
    cancellation_count_period: int = 0
    last_cancellation_at: Optional[datetime] = None
    is_flagged: bool = False
    flag_reason: Optional[str] = None
    flagged_at: Optional[datetime] = None
    suspended_until: Optional[datetime] = None


class DriverProfileUpdate(SQLModel):
    """Model for updating driver profiles"""
    vehicle_type: Optional[VehicleType] = None
    capacity_kg: Optional[float] = None
    capacity_volume: Optional[float] = None
    is_available: Optional[bool] = None
    status: Optional[DriverStatus] = None


class DriverProfileAdminUpdate(DriverProfileUpdate):
    """Admin-only update fields"""
    max_active_orders: Optional[int] = None
    is_flagged: Optional[bool] = None
    flag_reason: Optional[str] = None
    suspended_until: Optional[datetime] = None


# Combined model for driver registration
class DriverRegister(SQLModel):
    """Model for driver registration (user + profile)"""
    # User fields
    email: str
    full_name: str
    phone: str
    password: str
    # Driver profile fields
    vehicle_type: VehicleType
    capacity_kg: Optional[float] = None
    capacity_volume: Optional[float] = None


class DriverStats(SQLModel):
    """Driver statistics for dashboard"""
    total_deliveries: int
    total_earnings: float
    average_rating: Optional[float]
    total_ratings: int
    active_orders_count: int
    cancellation_count: int

    # Period stats (e.g., today, this week)
    deliveries_today: int = 0
    earnings_today: float = 0.0
    deliveries_this_week: int = 0
    earnings_this_week: float = 0.0


class DriverEarning(SQLModel):
    """Model for a single earning record"""
    order_id: int
    amount: float
    delivered_at: datetime
    customer_name: str
    delivery_address: str


class DriverEarningsResponse(SQLModel):
    """Response model for driver earnings"""
    total_earnings: float
    earnings_today: float
    earnings_this_week: float
    earnings_this_month: float
    recent_earnings: List["DriverEarning"] = []
