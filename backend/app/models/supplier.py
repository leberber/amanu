from sqlmodel import SQLModel, Field, Relationship, JSON, Column
from typing import Optional, List, Dict, TYPE_CHECKING
from datetime import datetime, timezone

if TYPE_CHECKING:
    from app.models.purchase_order import PurchaseOrder


class SupplierBase(SQLModel):
    """Base supplier model with common fields"""
    name: str = Field(min_length=1, max_length=100, index=True)
    contact_person: Optional[str] = Field(default=None, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=50)
    email: Optional[str] = Field(default=None, max_length=100)
    address: Optional[str] = Field(default=None, max_length=255)
    city: Optional[str] = Field(default=None, max_length=100)
    notes: Optional[str] = Field(default=None)
    is_active: bool = Field(default=True)


class Supplier(SupplierBase, table=True):
    """Database model for suppliers"""
    __tablename__ = "suppliers"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)


class SupplierCreate(SupplierBase):
    """Model for creating a new supplier"""
    pass


class SupplierUpdate(SQLModel):
    """Model for updating suppliers"""
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    contact_person: Optional[str] = Field(default=None, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=50)
    email: Optional[str] = Field(default=None, max_length=100)
    address: Optional[str] = Field(default=None, max_length=255)
    city: Optional[str] = Field(default=None, max_length=100)
    notes: Optional[str] = Field(default=None)
    is_active: Optional[bool] = Field(default=None)


class SupplierRead(SupplierBase):
    """Model for reading suppliers"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
