# backend/app/models/push_subscription.py
from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime, timezone


class PushSubscriptionBase(SQLModel):
    """Base model for push subscription"""
    endpoint: str = Field(index=True)
    p256dh: str  # Public key
    auth: str    # Auth secret


class PushSubscription(PushSubscriptionBase, table=True):
    """Database model for push subscriptions"""
    __tablename__ = "push_subscriptions"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PushSubscriptionCreate(SQLModel):
    """Model for creating a subscription (from frontend)"""
    endpoint: str
    keys: dict  # Contains p256dh and auth
