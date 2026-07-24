from typing import Optional, List, TYPE_CHECKING
from datetime import datetime, timezone
from enum import Enum

from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from app.models.order import Order, OrderItem
    from app.models.user import User
    from app.models.order_payments import OrderPayment


class OrderReturn(SQLModel, table=True):
    __tablename__ = "order_returns"

    id: Optional[int] = Field(default=None, primary_key=True)
    order_id: int = Field(foreign_key="orders.id", index=True)
    created_by: int = Field(foreign_key="users.id")
    reason: Optional[str] = Field(default=None, max_length=500)
    notes: Optional[str] = Field(default=None, max_length=1000)
    restocked: bool = Field(default=False)
    refund_amount: float = Field(default=0.0)
    margin_impact: Optional[float] = Field(default=None)
    refund_payment_id: Optional[int] = Field(default=None, foreign_key="order_payments.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    items: List["OrderReturnItem"] = Relationship(
        back_populates="order_return",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    creator: Optional["User"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[OrderReturn.created_by]"}
    )


class OrderReturnItem(SQLModel, table=True):
    __tablename__ = "order_return_items"

    id: Optional[int] = Field(default=None, primary_key=True)
    order_return_id: int = Field(foreign_key="order_returns.id", index=True)
    order_item_id: int = Field(foreign_key="order_items.id")
    product_id: int = Field(foreign_key="products.id")
    product_name: str
    quantity: float
    unit_price: float
    pieces_per_box: Optional[int] = Field(default=None)
    packaging_type: Optional[str] = Field(default=None)

    order_return: Optional["OrderReturn"] = Relationship(back_populates="items")


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class OrderReturnItemCreate(SQLModel):
    order_item_id: int
    quantity: float


class OrderReturnCreate(SQLModel):
    order_id: int
    reason: Optional[str] = None
    notes: Optional[str] = None
    restock: bool = True
    items: List[OrderReturnItemCreate]


class OrderReturnItemRead(SQLModel):
    id: int
    order_item_id: int
    product_id: int
    product_name: str
    quantity: float
    unit_price: float
    pieces_per_box: Optional[int] = None
    packaging_type: Optional[str] = None
    model_config = {"from_attributes": True}


class OrderReturnRead(SQLModel):
    id: int
    order_id: int
    reason: Optional[str] = None
    notes: Optional[str] = None
    restocked: bool
    refund_amount: float
    margin_impact: Optional[float] = None
    created_at: datetime
    creator_name: Optional[str] = None
    customer_name: Optional[str] = None
    customer_segment_id: Optional[int] = None
    items: List[OrderReturnItemRead] = []
    model_config = {"from_attributes": True}
