from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, TYPE_CHECKING
from datetime import datetime, timezone
from enum import Enum

if TYPE_CHECKING:
    from app.models.user import User


class VehicleType(str, Enum):
    """Vehicle type enumeration"""
    TRUCK = "truck"
    VAN = "van"
    MINI_VAN = "mini_van"


class DriverProfileBase(SQLModel):
    """Base driver profile model"""
    vehicle_type: VehicleType
    capacity_kg: Optional[float] = Field(default=None, description="Weight capacity in kg")
    capacity_volume: Optional[float] = Field(default=None, description="Volume capacity in m³")


class DriverProfile(DriverProfileBase, table=True):
    """Database model for driver profiles"""
    __tablename__ = "driver_profiles"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", unique=True, index=True)
    is_available: bool = Field(default=True, description="Driver availability status")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)

    # Relationship
    user: Optional["User"] = Relationship(back_populates="driver_profile")


class DriverProfileCreate(DriverProfileBase):
    """Model for creating a driver profile"""
    pass


class DriverProfileRead(DriverProfileBase):
    """Model for reading driver profiles"""
    id: int
    user_id: int
    is_available: bool
    created_at: datetime
    updated_at: Optional[datetime] = None


class DriverProfileUpdate(SQLModel):
    """Model for updating driver profiles"""
    vehicle_type: Optional[VehicleType] = None
    capacity_kg: Optional[float] = None
    capacity_volume: Optional[float] = None
    is_available: Optional[bool] = None


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
