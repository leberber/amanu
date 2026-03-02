from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import String
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime, timezone
from enum import Enum
from pydantic import EmailStr

if TYPE_CHECKING:
    from app.models.order import Order
    # Remove this import
    # from app.models.cart import CartItem

class UserRole(str, Enum):
    """User role enumeration"""
    CUSTOMER = "customer"
    STAFF = "staff"
    ADMIN = "admin"


class AuthProvider(str, Enum):
    """Authentication provider enumeration"""
    EMAIL = "email"
    GOOGLE = "google"

class UserBase(SQLModel):
    """Base user model with common fields"""
    email: EmailStr = Field(index=True)
    full_name: str = Field(min_length=1, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=20)
    address: Optional[str] = Field(default=None, max_length=200)
    latitude: Optional[float] = Field(default=None)
    longitude: Optional[float] = Field(default=None)
    store_name: Optional[str] = Field(default=None, max_length=100)
    wilaya: Optional[str] = Field(default=None, max_length=50)
    daira: Optional[str] = Field(default=None, max_length=50)
    commune: Optional[str] = Field(default=None, max_length=50)
    role: UserRole = Field(default=UserRole.CUSTOMER)
    is_active: bool = Field(default=True)
    auth_provider: AuthProvider = Field(default=AuthProvider.EMAIL, sa_type=String(20))
    profile_picture: Optional[str] = Field(default=None, max_length=500)

class User(UserBase, table=True):
    """Database model for users"""
    __tablename__ = "users"
    id: Optional[int] = Field(default=None, primary_key=True)
    hashed_password: Optional[str] = Field(default=None)  # Optional for OAuth users
    google_id: Optional[str] = Field(default=None, max_length=100, index=True)  # Google OAuth ID
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)
    
    # Relationships
    orders: List["Order"] = Relationship(back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    # Remove this relationship
    # cart_items: List["CartItem"] = Relationship(back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

class UserCreate(UserBase):
    """Model for creating a new user"""
    password: str = Field(min_length=8, max_length=100)

class UserUpdate(SQLModel):
    """Model for updating users"""
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=20)
    address: Optional[str] = Field(default=None, max_length=200)
    latitude: Optional[float] = Field(default=None)
    longitude: Optional[float] = Field(default=None)
    store_name: Optional[str] = Field(default=None, max_length=100)
    wilaya: Optional[str] = Field(default=None, max_length=50)
    daira: Optional[str] = Field(default=None, max_length=50)
    commune: Optional[str] = Field(default=None, max_length=50)
    password: Optional[str] = Field(default=None, min_length=8, max_length=100)
    is_active: Optional[bool] = Field(default=None)
    role: Optional[UserRole] = Field(default=None)

class UserRead(UserBase):
    """Model for reading users"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None