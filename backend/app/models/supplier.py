from sqlmodel import SQLModel, Field, Relationship, JSON, Column
from typing import Optional, List, Dict, TYPE_CHECKING
from datetime import datetime, timezone
from pydantic import BaseModel

if TYPE_CHECKING:
    from app.models.purchase_order import PurchaseOrder
    from app.models.product import Product


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


# =============================================================================
# Supplier Payments
# =============================================================================

class SupplierPayment(SQLModel, table=True):
    """Tracks payments made to a supplier"""
    __tablename__ = "supplier_payments"

    id: Optional[int] = Field(default=None, primary_key=True)
    supplier_id: int = Field(foreign_key="suppliers.id", index=True)
    amount: float
    payment_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    payment_method: str = Field(default="espece")  # espece, cheque, virement
    notes: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SupplierPaymentCreate(BaseModel):
    amount: float
    payment_date: Optional[datetime] = None
    payment_method: str = "espece"
    notes: Optional[str] = None


class SupplierPaymentResponse(BaseModel):
    id: int
    supplier_id: int
    amount: float
    payment_date: datetime
    payment_method: str
    notes: Optional[str]
    created_at: datetime


# =============================================================================
# Supplier Product Price History
# =============================================================================

class SupplierProductPrice(SQLModel, table=True):
    """Price history: what a supplier charged us for a product on a given PO"""
    __tablename__ = "supplier_product_prices"

    id: Optional[int] = Field(default=None, primary_key=True)
    supplier_id: int = Field(foreign_key="suppliers.id", index=True)
    product_id: int = Field(foreign_key="products.id", index=True)
    purchase_order_id: int = Field(foreign_key="purchase_orders.id", index=True)
    unit_price: float
    quantity_received: int = Field(default=0)
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SupplierProductPriceResponse(BaseModel):
    id: int
    supplier_id: int
    product_id: int
    product_name: str
    product_image: Optional[str]
    purchase_order_id: int
    purchase_order_reference: str
    unit_price: float
    quantity_received: int
    date: datetime


# =============================================================================
# Supplier Stats
# =============================================================================

class SupplierStats(BaseModel):
    supplier: SupplierRead
    total_ordered: float
    total_paid: float
    balance_owed: float
    order_count: int
    pending_order_count: int
