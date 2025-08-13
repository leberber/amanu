from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List, Dict, Any, TYPE_CHECKING
from datetime import datetime, timezone
from enum import Enum
from pydantic import field_validator

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.product import Product

class OrderStatus(str, Enum):
    """Order status enumeration"""
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"

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
    
    # Relationships
    order: "Order" = Relationship(back_populates="items")
    product: "Product" = Relationship(back_populates="order_items")

class OrderBase(SQLModel):
    """Base order model with common fields"""
    user_id: int = Field(foreign_key="users.id")
    status: OrderStatus = Field(default=OrderStatus.PENDING)
    shipping_address: str
    contact_phone: str
    total_amount: float = Field(gt=0)

class Order(OrderBase, table=True):
    """Database model for orders"""
    __tablename__ = "orders"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)
    
    # Relationships
    user: "User" = Relationship(back_populates="orders")
    items: List[OrderItem] = Relationship(back_populates="order", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

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

class OrderRead(OrderBase):
    """Model for reading orders"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

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

class OrderWithItems(OrderRead):
    """Extended order model that includes items"""
    items: List[OrderItemRead] = []