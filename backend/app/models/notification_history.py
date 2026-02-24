# backend/app/models/notification_history.py
from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime, timezone
from enum import Enum


class SegmentType(str, Enum):
    """Customer segment types"""
    ALL = "all"
    INACTIVE_30 = "inactive_30"
    INACTIVE_60 = "inactive_60"
    VIP = "vip"
    NEW_USERS = "new_users"
    BY_CITY = "by_city"


class NotificationType(str, Enum):
    """Notification content types"""
    CUSTOM = "custom"
    PROMOTION = "promotion"
    PRODUCT = "product"
    CATEGORY = "category"
    BRAND = "brand"


class NotificationStatus(str, Enum):
    """Notification status"""
    PENDING = "pending"
    SENT = "sent"
    SCHEDULED = "scheduled"
    FAILED = "failed"


class NotificationHistory(SQLModel, table=True):
    """Database model for notification history"""
    __tablename__ = "notification_history"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Content
    title_en: str = Field(max_length=200)
    title_fr: Optional[str] = Field(default=None, max_length=200)
    title_ar: Optional[str] = Field(default=None, max_length=200)
    body_en: str = Field(max_length=500)
    body_fr: Optional[str] = Field(default=None, max_length=500)
    body_ar: Optional[str] = Field(default=None, max_length=500)
    url: str = Field(default="/", max_length=500)
    image_url: Optional[str] = Field(default=None, max_length=500)

    # Targeting
    segment_type: SegmentType = Field(default=SegmentType.ALL)
    segment_value: Optional[str] = Field(default=None, max_length=100)  # e.g., city name

    # Type reference
    notification_type: NotificationType = Field(default=NotificationType.CUSTOM)
    target_id: Optional[int] = Field(default=None)  # promotion_id, product_id, etc.

    # Stats
    status: NotificationStatus = Field(default=NotificationStatus.PENDING)
    sent_count: int = Field(default=0)
    failed_count: int = Field(default=0)

    # Scheduling
    scheduled_at: Optional[datetime] = Field(default=None)
    sent_at: Optional[datetime] = Field(default=None)

    # Audit
    created_by: int = Field(index=True)  # Admin user ID
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class NotificationHistoryRead(SQLModel):
    """Model for reading notification history"""
    id: int
    title_en: str
    title_fr: Optional[str]
    title_ar: Optional[str]
    body_en: str
    body_fr: Optional[str]
    body_ar: Optional[str]
    url: str
    image_url: Optional[str]
    segment_type: SegmentType
    segment_value: Optional[str]
    notification_type: NotificationType
    target_id: Optional[int]
    status: NotificationStatus
    sent_count: int
    failed_count: int
    scheduled_at: Optional[datetime]
    sent_at: Optional[datetime]
    created_by: int
    created_at: datetime
