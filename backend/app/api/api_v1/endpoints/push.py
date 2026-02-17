# backend/app/api/api_v1/endpoints/push.py
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel

from app.database import get_session
from app.models.user import User
from app.models.push_subscription import PushSubscription, PushSubscriptionCreate
from app.core.security import get_current_active_user, get_current_admin_user
from app.core.push import PushService
from app.core.config import settings

router = APIRouter()


class NotificationRequest(BaseModel):
    title: str
    body: str
    url: str = "/"


@router.get("/vapid-public-key")
def get_vapid_public_key():
    """Get VAPID public key for frontend subscription."""
    if not settings.VAPID_PUBLIC_KEY:
        raise HTTPException(status_code=500, detail="Push notifications not configured")
    return {"publicKey": settings.VAPID_PUBLIC_KEY}


@router.post("/subscribe")
def subscribe(
    subscription: PushSubscriptionCreate,
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_active_user),
):
    """Subscribe to push notifications."""
    # Check if already subscribed
    existing = session.exec(
        select(PushSubscription).where(PushSubscription.endpoint == subscription.endpoint)
    ).first()

    if existing:
        return {"message": "Already subscribed"}

    # Create new subscription
    db_sub = PushSubscription(
        endpoint=subscription.endpoint,
        p256dh=subscription.keys.get("p256dh", ""),
        auth=subscription.keys.get("auth", ""),
        user_id=current_user.id if current_user else None
    )
    session.add(db_sub)
    session.commit()

    return {"message": "Subscribed successfully"}


@router.delete("/unsubscribe")
def unsubscribe(
    endpoint: str,
    session: Session = Depends(get_session),
):
    """Unsubscribe from push notifications."""
    sub = session.exec(
        select(PushSubscription).where(PushSubscription.endpoint == endpoint)
    ).first()

    if sub:
        session.delete(sub)
        session.commit()

    return {"message": "Unsubscribed"}


@router.post("/send")
def send_notification(
    notification: NotificationRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_admin_user),
):
    """Send push notification to all subscribers (admin only)."""
    subscriptions = session.exec(select(PushSubscription)).all()

    if not subscriptions:
        raise HTTPException(status_code=400, detail="No subscribers")

    result = PushService.send_to_all(
        subscriptions,
        notification.title,
        notification.body,
        notification.url
    )

    # Remove expired subscriptions
    for sub_id in result.get("expired_ids", []):
        sub = session.get(PushSubscription, sub_id)
        if sub:
            session.delete(sub)
    session.commit()

    return {
        "message": f"Sent to {result['sent']} subscribers",
        "sent": result["sent"],
        "failed": result["failed"]
    }
