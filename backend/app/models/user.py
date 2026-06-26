from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import String, JSON
from typing import Optional, List, Dict, Any, TYPE_CHECKING
from datetime import datetime, timezone
from enum import Enum
from pydantic import EmailStr

# Import UserGroupLink at runtime (no circular dependency - it doesn't import User)
from app.models.user_group import UserGroupLink

if TYPE_CHECKING:
    from app.models.order import Order
    from app.models.user_notification import UserNotification
    from app.models.user_group import UserGroup
    from app.models.driver import Driver

class UserRole(str, Enum):
    """User role enumeration"""
    CUSTOMER = "customer"
    STAFF = "staff"
    ADMIN = "admin"
    DRIVER = "driver"


class AuthProvider(str, Enum):
    """Authentication provider enumeration"""
    EMAIL = "email"
    GOOGLE = "google"

class UserBase(SQLModel):
    """Base user model with common fields"""
    model_config = {"use_enum_values": True}

    # Core identity
    email: EmailStr = Field(index=True)
    full_name: str = Field(min_length=1, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=20)
    store_name: Optional[str] = Field(default=None, max_length=100)
    role: UserRole = Field(default=UserRole.CUSTOMER)
    is_active: bool = Field(default=True)
    h3_index: Optional[str] = Field(default=None, max_length=20, index=True)
    # Location
    address: Optional[str] = Field(default=None, max_length=200)
    wilaya: Optional[str] = Field(default=None, max_length=50)
    daira: Optional[str] = Field(default=None, max_length=50)
    commune: Optional[str] = Field(default=None, max_length=50)
    latitude: Optional[float] = Field(default=None)
    longitude: Optional[float] = Field(default=None)
    # Fiscal info (for invoicing) — stored as JSON: {rc, na, nif, nis}
    fiscal_info: Optional[Dict[str, Any]] = Field(default=None, sa_type=JSON)
    # Auth
    auth_provider: AuthProvider = Field(default=AuthProvider.EMAIL, sa_type=String(20))
    profile_picture: Optional[str] = Field(default=None, max_length=500)

class User(SQLModel, table=True):
    """Database model for users"""
    __tablename__ = "users"

    # ID first
    id: Optional[int] = Field(default=None, primary_key=True)

    # Core identity (from UserBase)
    email: EmailStr = Field(index=True)
    full_name: str = Field(min_length=1, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=20)
    store_name: Optional[str] = Field(default=None, max_length=100)
    role: UserRole = Field(default=UserRole.CUSTOMER)
    is_active: bool = Field(default=True)
    h3_index: Optional[str] = Field(default=None, max_length=20, index=True)

    # Location
    address: Optional[str] = Field(default=None, max_length=200)
    wilaya: Optional[str] = Field(default=None, max_length=50)
    daira: Optional[str] = Field(default=None, max_length=50)
    commune: Optional[str] = Field(default=None, max_length=50)
    latitude: Optional[float] = Field(default=None)
    longitude: Optional[float] = Field(default=None)

    # Fiscal info (for invoicing) — {rc, na, nif, nis}
    fiscal_info: Optional[Dict[str, Any]] = Field(default=None, sa_type=JSON)
    # Auth
    auth_provider: AuthProvider = Field(default=AuthProvider.EMAIL, sa_type=String(20))
    profile_picture: Optional[str] = Field(default=None, max_length=500)
    hashed_password: Optional[str] = Field(default=None)
    google_id: Optional[str] = Field(default=None, max_length=100, index=True)

    # Preferences & timestamps
    user_preferences: Optional[Dict[str, Any]] = Field(default=None, sa_type=JSON)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)

    # Relationships
    orders: List["Order"] = Relationship(back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan", "foreign_keys": "[Order.user_id]"})
    notifications: List["UserNotification"] = Relationship(sa_relationship_kwargs={"cascade": "all, delete-orphan", "foreign_keys": "[UserNotification.user_id]"})
    groups: List["UserGroup"] = Relationship(back_populates="users", link_model=UserGroupLink)
    driver: Optional["Driver"] = Relationship(back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan", "uselist": False, "foreign_keys": "[Driver.user_id]"})

class UserCreate(UserBase):
    """Model for creating a new user"""
    password: str = Field(min_length=8, max_length=100)

class UserUpdate(SQLModel):
    """Model for updating users"""
    # Core identity
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=20)
    store_name: Optional[str] = Field(default=None, max_length=100)
    is_active: Optional[bool] = Field(default=None)
    role: Optional[UserRole] = Field(default=None)
    h3_index: Optional[str] = Field(default=None, max_length=20)
    # Location
    address: Optional[str] = Field(default=None, max_length=200)
    wilaya: Optional[str] = Field(default=None, max_length=50)
    daira: Optional[str] = Field(default=None, max_length=50)
    commune: Optional[str] = Field(default=None, max_length=50)
    latitude: Optional[float] = Field(default=None)
    longitude: Optional[float] = Field(default=None)
    # Fiscal info (for invoicing) — {rc, na, nif, nis}
    fiscal_info: Optional[Dict[str, Any]] = Field(default=None)
    # Auth
    password: Optional[str] = Field(default=None, min_length=8, max_length=100)
    # Preferences
    user_preferences: Optional[Dict[str, Any]] = Field(default=None)

class UserGroupBasic(SQLModel):
    """Basic group info for embedding in user responses"""
    id: int
    name: str
    color: Optional[str] = None


class UserRead(UserBase):
    """Model for reading users"""
    model_config = {"use_enum_values": True, "from_attributes": True}

    id: int
    h3_index: Optional[str] = None
    user_preferences: Optional[Dict[str, Any]] = None
    created_at: datetime
    segment_ids: List[int] = []
    updated_at: Optional[datetime] = None
    groups: List[UserGroupBasic] = []
    remaining_balance: Optional[float] = None  # Computed: sum of unpaid order amounts
    has_push: bool = False  # Computed: whether user has any push subscriptions


class UserGroupsUpdate(SQLModel):
    """Model for updating user's groups"""
    group_ids: List[int] = []