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


# =============================================================================
# DATABASE MODELS
# =============================================================================

class Driver(SQLModel, table=True):
    """Database model for drivers"""
    __tablename__ = "drivers"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", unique=True, index=True)

    # Status & availability
    status: DriverStatus = Field(default=DriverStatus.OFFLINE, description="Current driver status")
    is_available: bool = Field(default=True, description="Driver availability for new orders")
    max_active_orders: int = Field(default=3, description="Maximum concurrent orders allowed")

    # Route preferences
    preferred_corridor: Optional[str] = Field(default=None, max_length=100, description="Driver's preferred corridor/route")

    # Flagging/suspension (simple for now)
    is_flagged: bool = Field(default=False, description="Driver is flagged for review")
    flag_reason: Optional[str] = Field(default=None, max_length=500)
    flagged_at: Optional[datetime] = Field(default=None)
    flagged_by_id: Optional[int] = Field(default=None, foreign_key="users.id")
    suspended_until: Optional[datetime] = Field(default=None, description="Suspension end time")

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)

    # Relationships
    user: Optional["User"] = Relationship(
        back_populates="driver",
        sa_relationship_kwargs={"foreign_keys": "[Driver.user_id]"}
    )
    vehicles: List["DriverVehicle"] = Relationship(back_populates="driver")


class DriverVehicle(SQLModel, table=True):
    """Database model for driver vehicles"""
    __tablename__ = "driver_vehicles"

    id: Optional[int] = Field(default=None, primary_key=True)
    driver_id: int = Field(foreign_key="drivers.id", index=True)

    # Vehicle info
    vehicle_type: VehicleType
    capacity_kg: Optional[float] = Field(default=None, description="Weight capacity in kg")
    capacity_volume: Optional[float] = Field(default=None, description="Volume capacity in m³")
    license_plate: Optional[str] = Field(default=None, max_length=20)
    is_primary: bool = Field(default=True, description="Primary vehicle for the driver")
    is_active: bool = Field(default=True)

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Relationship
    driver: Optional["Driver"] = Relationship(back_populates="vehicles")


# =============================================================================
# READ MODELS (API Responses)
# =============================================================================

class DriverVehicleRead(SQLModel):
    """Model for reading driver vehicles"""
    id: int
    driver_id: int
    vehicle_type: VehicleType
    capacity_kg: Optional[float] = None
    capacity_volume: Optional[float] = None
    license_plate: Optional[str] = None
    is_primary: bool = True
    is_active: bool = True
    created_at: datetime

    model_config = {"from_attributes": True, "use_enum_values": True}


class DriverRead(SQLModel):
    """Model for reading driver info"""
    id: int
    user_id: int
    status: DriverStatus
    is_available: bool
    max_active_orders: int = 3
    preferred_corridor: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    # Primary vehicle info (for convenience)
    vehicle_type: Optional[VehicleType] = None
    capacity_kg: Optional[float] = None
    capacity_volume: Optional[float] = None

    # Computed stats (populated by endpoint)
    active_orders_count: int = 0
    total_deliveries: int = 0
    total_earnings: float = 0.0
    average_rating: Optional[float] = None
    total_ratings: int = 0

    model_config = {"from_attributes": True, "use_enum_values": True}


class DriverReadWithFlags(DriverRead):
    """Extended driver info with flagging (for admin)"""
    is_flagged: bool = False
    flag_reason: Optional[str] = None
    flagged_at: Optional[datetime] = None
    suspended_until: Optional[datetime] = None

    # User info (populated by endpoint)
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

    # Cancellation stats (computed from orders)
    cancellation_count: int = 0


# =============================================================================
# CREATE/UPDATE MODELS
# =============================================================================

class DriverCreate(SQLModel):
    """Model for creating a driver"""
    vehicle_type: VehicleType
    capacity_kg: Optional[float] = None
    capacity_volume: Optional[float] = None


class DriverUpdate(SQLModel):
    """Model for updating driver"""
    is_available: Optional[bool] = None
    status: Optional[DriverStatus] = None


class DriverVehicleCreate(SQLModel):
    """Model for creating a driver vehicle"""
    vehicle_type: VehicleType
    capacity_kg: Optional[float] = None
    capacity_volume: Optional[float] = None
    license_plate: Optional[str] = None
    is_primary: bool = True


class DriverVehicleUpdate(SQLModel):
    """Model for updating a driver vehicle"""
    vehicle_type: Optional[VehicleType] = None
    capacity_kg: Optional[float] = None
    capacity_volume: Optional[float] = None
    license_plate: Optional[str] = None
    is_primary: Optional[bool] = None
    is_active: Optional[bool] = None


class DriverAdminUpdate(DriverUpdate):
    """Admin-only update fields"""
    max_active_orders: Optional[int] = None
    preferred_corridor: Optional[str] = None
    is_flagged: Optional[bool] = None
    flag_reason: Optional[str] = None
    suspended_until: Optional[datetime] = None


# =============================================================================
# REGISTRATION MODEL
# =============================================================================

class DriverRegister(SQLModel):
    """Model for driver registration (user + driver + vehicle)"""
    # User fields
    email: str
    full_name: str
    phone: str
    password: str
    # Vehicle fields
    vehicle_type: VehicleType
    capacity_kg: Optional[float] = None
    capacity_volume: Optional[float] = None


# =============================================================================
# STATS MODELS
# =============================================================================

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


# =============================================================================
# BACKWARD COMPATIBILITY (to be removed after migration)
# =============================================================================

# Aliases for backward compatibility during migration
DriverProfile = Driver
DriverProfileBase = DriverCreate
DriverProfileRead = DriverRead
DriverProfileWithFlags = DriverReadWithFlags
DriverProfileCreate = DriverCreate
DriverProfileUpdate = DriverUpdate
DriverProfileAdminUpdate = DriverAdminUpdate
