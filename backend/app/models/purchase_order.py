from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime, timezone
from enum import Enum
from pydantic import BaseModel


class PurchaseOrderStatus(str, Enum):
    """Purchase order status enumeration"""
    DRAFT = "draft"
    SENT = "sent"
    CONFIRMED = "confirmed"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


# =============================================================================
# Database Models
# =============================================================================

class PurchaseOrderItem(SQLModel, table=True):
    """Database model for purchase order items"""
    __tablename__ = "purchase_order_items"

    id: Optional[int] = Field(default=None, primary_key=True)
    purchase_order_id: int = Field(foreign_key="purchase_orders.id", index=True)

    # Product info (stored at time of order)
    product_name: str
    brand: str = ""
    units_per_carton: int = 1
    quantity: int = 1  # Number of cartons
    unit_price: float = 0  # Price per carton
    total_price: float = 0  # quantity * unit_price

    # Relationship
    purchase_order: "PurchaseOrder" = Relationship(back_populates="items")


class PurchaseOrder(SQLModel, table=True):
    """Database model for purchase orders (Bon de Commande)"""
    __tablename__ = "purchase_orders"

    id: Optional[int] = Field(default=None, primary_key=True)
    reference: str = Field(index=True, unique=True)  # e.g., "BC-2024-001"

    # Supplier info
    supplier_name: str
    supplier_address: Optional[str] = None
    supplier_phone: Optional[str] = None
    supplier_email: Optional[str] = None
    supplier_city: Optional[str] = None

    # Order details
    status: PurchaseOrderStatus = Field(default=PurchaseOrderStatus.DRAFT)
    total_amount: float = 0
    notes: Optional[str] = None

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None

    # Relationships
    items: List[PurchaseOrderItem] = Relationship(
        back_populates="purchase_order",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


# =============================================================================
# Request/Response Models
# =============================================================================

class PurchaseOrderItemCreate(BaseModel):
    """Model for creating a purchase order item"""
    product_name: str
    brand: str = ""
    units_per_carton: int = 1
    quantity: int = 1
    unit_price: float = 0
    total_price: float = 0


class PurchaseOrderCreate(BaseModel):
    """Model for creating a purchase order"""
    supplier_name: str
    supplier_address: Optional[str] = None
    supplier_phone: Optional[str] = None
    supplier_email: Optional[str] = None
    supplier_city: Optional[str] = None
    notes: Optional[str] = None
    items: List[PurchaseOrderItemCreate]


class PurchaseOrderUpdate(BaseModel):
    """Model for updating a purchase order"""
    supplier_name: Optional[str] = None
    supplier_address: Optional[str] = None
    supplier_phone: Optional[str] = None
    supplier_email: Optional[str] = None
    supplier_city: Optional[str] = None
    status: Optional[PurchaseOrderStatus] = None
    notes: Optional[str] = None


class PurchaseOrderItemResponse(BaseModel):
    """Response model for purchase order item"""
    id: int
    product_name: str
    brand: str
    units_per_carton: int
    quantity: int
    unit_price: float
    total_price: float


class PurchaseOrderResponse(BaseModel):
    """Response model for purchase order"""
    id: int
    reference: str
    supplier_name: str
    supplier_address: Optional[str]
    supplier_phone: Optional[str]
    supplier_email: Optional[str]
    supplier_city: Optional[str]
    status: str
    total_amount: float
    notes: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    sent_at: Optional[datetime]
    confirmed_at: Optional[datetime]
    delivered_at: Optional[datetime]
    items: List[PurchaseOrderItemResponse] = []
    item_count: int = 0


class PurchaseOrderListResponse(BaseModel):
    """Response model for purchase order list"""
    orders: List[PurchaseOrderResponse]
    total: int
