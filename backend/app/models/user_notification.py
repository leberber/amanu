from sqlmodel import SQLModel, Field, JSON, Column
from sqlalchemy import String
from typing import Optional, Dict
from datetime import datetime, timezone
from enum import Enum


class NotificationType(str, Enum):
    """Type of user notification"""
    ORDER_CONFIRMED = "order_confirmed"
    ORDER_SHIPPED = "order_shipped"
    ORDER_DELIVERED = "order_delivered"
    ORDER_CANCELLED = "order_cancelled"
    PAYMENT_RECEIVED = "payment_received"
    TRIP_ASSIGNED = "trip_assigned"
    ORDER_MODIFIED = "order_modified"
    PROMOTION = "promotion"
    SYSTEM = "system"


class UserNotification(SQLModel, table=True):
    """Database model for user notifications"""
    __tablename__ = "user_notifications"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)

    # Content with JSON translations (like products)
    # Use String column to avoid PostgreSQL enum issues
    type: str = Field(default="system", sa_column=Column(String(50)))
    title: str = Field(max_length=200)
    message: str = Field(max_length=500)

    # Translations as JSON: {"fr": "...", "ar": "..."}
    title_translations: Optional[Dict[str, str]] = Field(
        default_factory=dict,
        sa_column=Column(JSON)
    )
    message_translations: Optional[Dict[str, str]] = Field(
        default_factory=dict,
        sa_column=Column(JSON)
    )

    # Optional reference to related entity
    reference_id: Optional[int] = Field(default=None)  # order_id, promotion_id, etc.
    reference_type: Optional[str] = Field(default=None, max_length=50)  # "order", "promotion", etc.

    # Deep link URL for the notification
    url: Optional[str] = Field(default=None, max_length=500)

    # Status
    is_read: bool = Field(default=False, index=True)
    read_at: Optional[datetime] = Field(default=None)

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)


class UserNotificationCreate(SQLModel):
    """Model for creating a notification"""
    user_id: int
    type: str = "system"
    title: str
    message: str
    title_translations: Optional[Dict[str, str]] = None
    message_translations: Optional[Dict[str, str]] = None
    reference_id: Optional[int] = None
    reference_type: Optional[str] = None
    url: Optional[str] = None


class UserNotificationRead(SQLModel):
    """Model for reading notifications"""
    id: int
    user_id: int
    type: str
    title: str
    message: str
    title_translations: Optional[Dict[str, str]] = None
    message_translations: Optional[Dict[str, str]] = None
    reference_id: Optional[int] = None
    reference_type: Optional[str] = None
    url: Optional[str] = None
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime


class UnreadCountResponse(SQLModel):
    """Response model for unread count"""
    count: int
