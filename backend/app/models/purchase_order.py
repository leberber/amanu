from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime, timezone
from enum import Enum
from pydantic import BaseModel

if TYPE_CHECKING:
    from app.models.product import Product


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

    # Link to products table (for stock sync)
    product_id: Optional[int] = Field(default=None, foreign_key="products.id", index=True)

    # Product info (stored at time of order)
    product_name: str
    brand: str = ""
    units_per_carton: int = 1

    # Quantities
    quantity_ordered: int = 1      # Original quantity ordered (cartons)
    quantity_received: int = 0     # Actual quantity received (for partial deliveries)
    facture_quantity: int = Field(default=0)  # Units received with official invoice
    facture_unit_price: float = Field(default=0.0)  # Price per unit on supplier's official invoice

    # Pricing
    unit_price: float = 0          # Price per carton
    total_price: float = 0         # quantity_ordered * unit_price

    # Relationship
    purchase_order: "PurchaseOrder" = Relationship(back_populates="items")
    product: Optional["Product"] = Relationship()


class PurchaseOrder(SQLModel, table=True):
    """Database model for purchase orders (Bon de Commande)"""
    __tablename__ = "purchase_orders"

    id: Optional[int] = Field(default=None, primary_key=True)
    reference: str = Field(index=True, unique=True)  # e.g., "BC-2024-001"

    # Supplier link (optional FK — null for legacy orders created before supplier linking)
    supplier_id: Optional[int] = Field(default=None, foreign_key="suppliers.id", index=True)

    # Supplier info (snapshot at time of order)
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
    product_id: Optional[int] = None
    product_name: str
    brand: str = ""
    units_per_carton: int = 1
    quantity_ordered: int = 1
    unit_price: float = 0
    total_price: float = 0


class PurchaseOrderCreate(BaseModel):
    """Model for creating a purchase order"""
    supplier_id: Optional[int] = None
    supplier_name: str
    supplier_address: Optional[str] = None
    supplier_phone: Optional[str] = None
    supplier_email: Optional[str] = None
    supplier_city: Optional[str] = None
    notes: Optional[str] = None
    items: List[PurchaseOrderItemCreate]


class PurchaseOrderItemUpdate(BaseModel):
    """Model for updating a purchase order item"""
    id: Optional[int] = None
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    brand: Optional[str] = None
    units_per_carton: Optional[int] = None
    quantity_ordered: Optional[int] = None
    quantity_received: Optional[int] = None
    facture_quantity: Optional[int] = None
    unit_price: Optional[float] = None
    total_price: Optional[float] = None


class PurchaseOrderUpdate(BaseModel):
    """Model for updating a purchase order"""
    supplier_name: Optional[str] = None
    supplier_address: Optional[str] = None
    supplier_phone: Optional[str] = None
    supplier_email: Optional[str] = None
    supplier_city: Optional[str] = None
    notes: Optional[str] = None
    items: Optional[List[PurchaseOrderItemUpdate]] = None


class DeliveryItemConfirmation(BaseModel):
    """Model for confirming delivery of a single item"""
    item_id: int
    quantity_received: int
    quantity_rejected: int = 0
    facture_quantity: int = 0
    facture_unit_price: float = 0.0
    made_date: Optional[str] = None    # ISO format: YYYY-MM-DD
    expiry_date: Optional[str] = None  # ISO format: YYYY-MM-DD


class DeliveryConfirmation(BaseModel):
    """Model for confirming delivery with received quantities"""
    items: List[DeliveryItemConfirmation]
    notes: Optional[str] = None


class PurchaseOrderItemResponse(BaseModel):
    """Response model for purchase order item"""
    id: int
    product_id: Optional[int] = None
    product_name: str
    brand: str
    units_per_carton: int
    quantity_ordered: int
    quantity_received: int
    facture_quantity: int
    facture_unit_price: float = 0.0
    unit_price: float
    total_price: float


class PurchaseOrderResponse(BaseModel):
    """Response model for purchase order"""
    id: int
    reference: str
    supplier_id: Optional[int] = None
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
