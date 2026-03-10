from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List, Dict, Any, TYPE_CHECKING
from datetime import datetime, timezone
from enum import Enum
from pydantic import field_validator, field_serializer

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.product import Product
    from app.models.promotion import Promotion
    from app.models.driver import DriverProfile

class OrderStatus(str, Enum):
    """Order status enumeration"""
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"      # Ready for driver pool
    ASSIGNED = "ASSIGNED"        # Driver has claimed
    PICKED_UP = "PICKED_UP"      # Driver has items
    IN_TRANSIT = "IN_TRANSIT"    # Driver is delivering
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"

class OrderItemBase(SQLModel):
    """Base model for order items"""
    order_id: int = Field(foreign_key="orders.id")
    product_id: int = Field(foreign_key="products.id")
    quantity: float = Field(gt=0)
    unit_price: float = Field(gt=0)

class OrderItem(OrderItemBase, table=True):
    """Database model for order items"""
    __tablename__ = "order_items"
    id: Optional[int] = Field(default=None, primary_key=True)
    product_name: str
    product_unit: str
    pieces_per_box: Optional[int] = Field(default=None)

    # Relationships
    order: "Order" = Relationship(back_populates="items")
    product: "Product" = Relationship(back_populates="order_items")

class OrderBase(SQLModel):
    """Base order model with common fields"""
    model_config = {"use_enum_values": True}

    user_id: int = Field(foreign_key="users.id")
    status: OrderStatus = Field(default=OrderStatus.PENDING)
    shipping_address: str
    contact_phone: str
    total_amount: float = Field(gt=0)
    # Promotion fields
    subtotal: Optional[float] = Field(default=None)
    discount_amount: float = Field(default=0)
    promotion_id: Optional[int] = Field(default=None, foreign_key="promotions.id")
    # Cross-sell discount fields
    cross_sell_discount_amount: float = Field(default=0)
    # Volume discount fields
    volume_discount_amount: float = Field(default=0)


class Order(OrderBase, table=True):
    """Database model for orders"""
    __tablename__ = "orders"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)

    # Driver assignment fields
    driver_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    assigned_at: Optional[datetime] = Field(default=None)
    assignment_expires_at: Optional[datetime] = Field(default=None)
    picked_up_at: Optional[datetime] = Field(default=None)
    in_transit_at: Optional[datetime] = Field(default=None)
    delivered_at: Optional[datetime] = Field(default=None)

    # Driver cancellation tracking
    driver_cancelled_at: Optional[datetime] = Field(default=None)
    driver_cancel_reason: Optional[str] = Field(default=None, max_length=500)
    cancellation_count: int = Field(default=0)

    # Delivery info
    delivery_notes: Optional[str] = Field(default=None, max_length=500)
    estimated_delivery_minutes: Optional[int] = Field(default=None)
    actual_delivery_minutes: Optional[int] = Field(default=None)

    # Relationships
    user: "User" = Relationship(back_populates="orders", sa_relationship_kwargs={"foreign_keys": "[Order.user_id]"})
    items: List[OrderItem] = Relationship(back_populates="order", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    promotion: Optional["Promotion"] = Relationship()
    driver: Optional["User"] = Relationship(sa_relationship_kwargs={"foreign_keys": "[Order.driver_id]"})

class OrderCreateItem(SQLModel):
    """Model for item in order creation"""
    product_id: int
    quantity: float = Field(gt=0)

class OrderCreate(SQLModel):
    """Model for creating a new order"""
    user_id: int
    shipping_address: str
    contact_phone: str
    items: List[OrderCreateItem]
    promotion_code: Optional[str] = None  # Optional promo code

    @field_validator("items")
    def validate_items(cls, v):
        """Validate that order contains items"""
        if not v or len(v) == 0:
            raise ValueError("Order must contain at least one item")
        return v

class OrderUpdate(SQLModel):
    """Model for updating orders"""
    status: Optional[OrderStatus] = None
    shipping_address: Optional[str] = None
    contact_phone: Optional[str] = None

class UserInfo(SQLModel):
    """Minimal user info for order display"""
    id: int
    full_name: str
    email: str

    model_config = {"from_attributes": True}


class DriverInfo(SQLModel):
    """Minimal driver info for order display"""
    id: int
    full_name: str
    phone: Optional[str] = None

    model_config = {"from_attributes": True}

class OrderRead(OrderBase):
    """Model for reading orders"""
    model_config = {"from_attributes": True, "use_enum_values": True}

    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    subtotal: Optional[float] = None
    discount_amount: float = 0
    cross_sell_discount_amount: float = 0
    volume_discount_amount: float = 0
    promotion_id: Optional[int] = None
    user: Optional[UserInfo] = None

    # Driver fields
    driver_id: Optional[int] = None
    driver: Optional[DriverInfo] = None
    assigned_at: Optional[datetime] = None
    assignment_expires_at: Optional[datetime] = None
    picked_up_at: Optional[datetime] = None
    in_transit_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    delivery_notes: Optional[str] = None
    estimated_delivery_minutes: Optional[int] = None
    actual_delivery_minutes: Optional[int] = None

    @field_serializer('status')
    def serialize_status(self, status: OrderStatus) -> str:
        """Serialize status to lowercase for frontend compatibility"""
        if isinstance(status, OrderStatus):
            return status.value.lower()
        return str(status).lower()


# Create a new Pydantic model that explicitly includes items
class OrderItemRead(SQLModel):
    """Model for reading order items in API responses"""
    id: int
    order_id: int
    product_id: int
    quantity: float
    unit_price: float
    product_name: str
    product_unit: str
    pieces_per_box: Optional[int] = None


class PromotionInfo(SQLModel):
    """Minimal promotion info for order display"""
    id: int
    name: str
    code: Optional[str] = None
    discount_type: str
    discount_value: float


class OrderWithItems(OrderRead):
    """Extended order model that includes items"""
    items: List[OrderItemRead] = []
    promotion_info: Optional[PromotionInfo] = None