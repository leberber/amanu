from typing import Optional, Dict, Any, TYPE_CHECKING
from datetime import datetime, timezone
from enum import Enum

from sqlmodel import SQLModel, Field, Relationship, Column
from sqlalchemy import JSON

if TYPE_CHECKING:
    from app.models.order import Order
    from app.models.user import User


class PaymentMethod(str, Enum):
    CASH = "cash"
    VIREMENT = "virement"
    CHEQUE = "cheque"


class PaymentStatus(str, Enum):
    UNPAID = "unpaid"
    PARTIAL = "partial"
    PAID = "paid"


class AuditAction(str, Enum):
    ORDER_CREATED = "order_created"
    STATUS_CHANGED = "status_changed"
    ITEM_ADDED = "item_added"
    ITEM_REMOVED = "item_removed"
    ITEM_QUANTITY_CHANGED = "item_quantity_changed"
    PAYMENT_RECORDED = "payment_recorded"
    REFUND_RECORDED = "refund_recorded"
    DELIVERY_CONFIRMED = "delivery_confirmed"


# ---------------------------------------------------------------------------
# OrderPayment
# ---------------------------------------------------------------------------

class OrderPayment(SQLModel, table=True):
    __tablename__ = "order_payments"

    id: Optional[int] = Field(default=None, primary_key=True)
    order_id: int = Field(foreign_key="orders.id", index=True)
    amount: float  # negative value = refund
    method: PaymentMethod
    note: Optional[str] = Field(default=None, max_length=500)
    recorded_by: int = Field(foreign_key="users.id")
    recorded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    order: "Order" = Relationship(back_populates="payments")
    recorder: "User" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[OrderPayment.recorded_by]"}
    )


class OrderPaymentCreate(SQLModel):
    amount: float
    method: PaymentMethod
    note: Optional[str] = None


class OrderPaymentRead(SQLModel):
    id: int
    order_id: int
    amount: float
    method: PaymentMethod
    note: Optional[str] = None
    recorded_by: int
    recorded_at: datetime
    recorder_name: Optional[str] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# OrderAuditLog
# ---------------------------------------------------------------------------

class OrderAuditLog(SQLModel, table=True):
    __tablename__ = "order_audit_logs"

    id: Optional[int] = Field(default=None, primary_key=True)
    order_id: int = Field(foreign_key="orders.id", index=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")
    action: AuditAction
    details: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    order: "Order" = Relationship(back_populates="audit_logs")
    actor: Optional["User"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[OrderAuditLog.user_id]"}
    )


class OrderAuditLogRead(SQLModel):
    id: int
    order_id: int
    user_id: Optional[int] = None
    actor_name: Optional[str] = None
    action: AuditAction
    details: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = {"from_attributes": True}
