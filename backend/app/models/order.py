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
    from app.models.trip import Trip
    from app.models.order_payments import OrderPayment, OrderAuditLog, PaymentStatus

class OrderStatus(str, Enum):
    """Order status enumeration"""
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"      # Ready for driver pool
    ASSIGNED = "ASSIGNED"        # Driver has claimed
    PICKED_UP = "PICKED_UP"      # Driver has items
    IN_TRANSIT = "IN_TRANSIT"    # Driver is delivering
    READY = "READY"              # Ready for customer pickup (pickup orders only)
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"


class DeliveryType(str, Enum):
    """Delivery type enumeration for routing optimization"""
    STANDARD = "STANDARD"    # Can be batched with other orders
    PRIORITY = "PRIORITY"    # Immediate dedicated delivery
    PICKUP = "PICKUP"        # Customer picks up at depot

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
    packaging_type: Optional[str] = Field(default=None)
    custom_unit_price: Optional[float] = Field(default=None)
    # Stored margin fields (set at order creation / item edit)
    cmup: Optional[float] = Field(default=None)
    item_margin: Optional[float] = Field(default=None)
    item_margin_pct: Optional[float] = Field(default=None)

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
    total_amount: float = Field(ge=0)
    # Promotion fields
    subtotal: Optional[float] = Field(default=None)
    discount_amount: float = Field(default=0)
    promotion_id: Optional[int] = Field(default=None, foreign_key="promotions.id")
    # Cross-sell discount fields
    cross_sell_discount_amount: float = Field(default=0)
    # Volume discount fields
    volume_discount_amount: float = Field(default=0)
    # Shipping cost (used for driver earnings calculation)
    shipping_cost: float = Field(default=0)
    original_shipping_cost: Optional[float] = Field(default=None)


class Order(OrderBase, table=True):
    """Database model for orders"""
    __tablename__ = "orders"
    id: Optional[int] = Field(default=None, primary_key=True)

    # Routing & batching (grouped with inherited user_id, status)
    trip_id: Optional[int] = Field(default=None, foreign_key="trips.id", index=True, description="Trip this order belongs to (if batched)")
    delivery_type: DeliveryType = Field(default=DeliveryType.STANDARD, description="STANDARD can be batched, PRIORITY is immediate")

    # Driver assignment
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
    pickup_date: Optional[datetime] = Field(default=None, description="Scheduled pickup date/time for pickup orders")
    delivery_notes: Optional[str] = Field(default=None, max_length=500)
    estimated_delivery_minutes: Optional[int] = Field(default=None)
    actual_delivery_minutes: Optional[int] = Field(default=None)

    # Weight & capacity
    total_weight_kg: float = Field(default=0.0, description="Pre-calculated total weight of order in kg")
    is_full_load: bool = Field(default=False, description="True if order fills >=80% of a vehicle capacity")
    min_vehicle_capacity_kg: Optional[float] = Field(default=None, description="Minimum vehicle capacity needed in kg")

    # Payment tracking
    payment_status: str = Field(default="unpaid")  # unpaid | partial | paid
    total_paid: float = Field(default=0.0)

    # Stored margin (set at order creation / item edit)
    margin: Optional[float] = Field(default=None)
    margin_pct: Optional[float] = Field(default=None)

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)
    admin_modified_at: Optional[datetime] = Field(default=None, description="Set when admin edits items; cleared when customer views order")

    # Relationships
    user: "User" = Relationship(back_populates="orders", sa_relationship_kwargs={"foreign_keys": "[Order.user_id]"})
    items: List[OrderItem] = Relationship(back_populates="order", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    promotion: Optional["Promotion"] = Relationship()
    driver: Optional["User"] = Relationship(sa_relationship_kwargs={"foreign_keys": "[Order.driver_id]"})
    trip: Optional["Trip"] = Relationship(sa_relationship_kwargs={"foreign_keys": "[Order.trip_id]"})
    payments: List["OrderPayment"] = Relationship(back_populates="order", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    audit_logs: List["OrderAuditLog"] = Relationship(back_populates="order", sa_relationship_kwargs={"cascade": "all, delete-orphan", "order_by": "OrderAuditLog.created_at"})

class OrderCreateItem(SQLModel):
    """Model for item in order creation"""
    product_id: int
    quantity: float = Field(gt=0)
    custom_unit_price: Optional[float] = None

class OrderCreate(SQLModel):
    """Model for creating a new order"""
    user_id: int
    shipping_address: str
    contact_phone: str
    items: List[OrderCreateItem]
    promotion_code: Optional[str] = None  # Optional promo code
    shipping_cost: float = 0
    original_shipping_cost: Optional[float] = None  # Priority price before standard delivery discount
    delivery_type: DeliveryType = DeliveryType.STANDARD  # STANDARD or PRIORITY
    pickup_date: Optional[datetime] = None  # Scheduled pickup date/time

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

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        """Convert lowercase status to uppercase for enum matching"""
        if v is None:
            return v
        if isinstance(v, str):
            return v.upper()
        return v

class UserInfo(SQLModel):
    """Minimal user info for order display"""
    id: int
    full_name: str
    email: str
    store_name: Optional[str] = None
    daira: Optional[str] = None
    commune: Optional[str] = None

    model_config = {"from_attributes": True}


class DriverInfo(SQLModel):
    """Minimal driver info for order display"""
    id: int
    full_name: str
    phone: Optional[str] = None
    vehicle_type: Optional[str] = None  # truck, van, mini_van

    model_config = {"from_attributes": True}

class OrderRead(OrderBase):
    """Model for reading orders"""
    model_config = {"from_attributes": True, "use_enum_values": True}

    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    admin_modified_at: Optional[datetime] = None
    payment_status: str = "unpaid"
    total_paid: float = 0.0
    subtotal: Optional[float] = None
    discount_amount: float = 0
    cross_sell_discount_amount: float = 0
    volume_discount_amount: float = 0
    shipping_cost: float = 0
    original_shipping_cost: Optional[float] = None
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
    pickup_date: Optional[datetime] = None
    delivery_notes: Optional[str] = None
    estimated_delivery_minutes: Optional[int] = None
    actual_delivery_minutes: Optional[int] = None

    # Routing fields
    delivery_type: DeliveryType = DeliveryType.STANDARD
    is_full_load: bool = False
    min_vehicle_capacity_kg: Optional[float] = None
    trip_id: Optional[int] = None

    @field_serializer('status')
    def serialize_status(self, status: OrderStatus) -> str:
        """Serialize status to lowercase for frontend compatibility"""
        if isinstance(status, OrderStatus):
            return status.value.lower()
        return str(status).lower()

    @field_serializer('delivery_type')
    def serialize_delivery_type(self, delivery_type: DeliveryType) -> str:
        """Serialize delivery_type to lowercase for frontend compatibility"""
        if isinstance(delivery_type, DeliveryType):
            return delivery_type.value.lower()
        return str(delivery_type).lower()

    # Margin (admin only, null when no CMUP data available)
    margin: Optional[float] = None
    margin_pct: Optional[float] = None


# Create a new Pydantic model that explicitly includes items
class OrderItemRead(SQLModel):
    """Model for reading order items in API responses"""
    id: int
    order_id: int
    product_id: int
    quantity: float
    unit_price: float
    custom_unit_price: Optional[float] = None
    product_name: str
    product_unit: str
    pieces_per_box: Optional[int] = None
    packaging_type: Optional[str] = None
    fraction_options: Optional[List[Dict]] = None
    image_url: Optional[str] = None
    brand_name: Optional[str] = None
    category_name: Optional[str] = None
    # Margin fields (admin only, null when no CMUP data)
    cmup: Optional[float] = None
    item_margin: Optional[float] = None
    item_margin_pct: Optional[float] = None


class PromotionInfo(SQLModel):
    """Minimal promotion info for order display"""
    id: int
    name: str
    code: Optional[str] = None
    discount_type: str
    discount_value: float


class OrderPaymentCustomerReadInline(SQLModel):
    """Inline payment model to avoid circular imports with order_payments.py"""
    id: int
    amount: float
    method: str
    note: Optional[str] = None
    recorded_at: datetime
    model_config = {"from_attributes": True}


class OrderWithItems(OrderRead):
    """Extended order model that includes items"""
    items: List[OrderItemRead] = []
    payments: List[OrderPaymentCustomerReadInline] = []
    promotion_info: Optional[PromotionInfo] = None
    total_weight: Optional[float] = None  # Total weight in kg
    total_volume: Optional[float] = None  # Total volume in liters