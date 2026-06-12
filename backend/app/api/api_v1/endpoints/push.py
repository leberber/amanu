# backend/app/api/api_v1/endpoints/push.py
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func, col
from pydantic import BaseModel

from app.database import get_session
from app.models.user import User
from app.models.order import Order
from app.models.product import Product
from app.models.category import Category
from app.models.brand import Brand
from app.models.promotion import Promotion
from app.models.push_subscription import PushSubscription, PushSubscriptionCreate
from app.models.notification_history import (
    NotificationHistory,
    NotificationHistoryRead,
    SegmentType,
    NotificationType,
    NotificationStatus
)
from app.models.user_group import UserGroup, UserGroupLink
from app.core.security import get_current_active_user, get_current_admin_user, get_current_staff_user
from app.core.push import PushService
from app.core.config import settings

router = APIRouter()


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class NotificationRequest(BaseModel):
    """Simple notification request (legacy)"""
    title: str
    body: str
    url: str = "/"


class TargetedNotificationRequest(BaseModel):
    """Targeted notification request with segments and multi-language"""
    # Content (multi-language)
    title_en: str
    title_fr: Optional[str] = None
    title_ar: Optional[str] = None
    body_en: str
    body_fr: Optional[str] = None
    body_ar: Optional[str] = None
    url: str = "/"
    image_url: Optional[str] = None

    # Targeting
    segment_type: SegmentType = SegmentType.ALL
    segment_value: Optional[str] = None  # e.g., city name
    user_group_ids: Optional[List[int]] = None  # Filter by user groups

    # Type reference (for auto-generation)
    notification_type: NotificationType = NotificationType.CUSTOM
    target_id: Optional[int] = None  # promotion_id, product_id, etc.

    # Scheduling
    scheduled_at: Optional[datetime] = None


class SegmentInfo(BaseModel):
    """Segment information with count"""
    segment_type: SegmentType
    label: str
    count: int
    description: str


class CityStat(BaseModel):
    """City statistics"""
    city: str
    count: int


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_user_ids_by_segment(
    session: Session,
    segment_type: SegmentType,
    segment_value: Optional[str] = None
) -> List[int]:
    """Get list of user IDs matching the segment criteria."""
    now = datetime.now(timezone.utc)

    if segment_type == SegmentType.ALL:
        # All users with subscriptions
        subs = session.exec(
            select(PushSubscription.user_id).where(PushSubscription.user_id.is_not(None))
        ).all()
        return list(set(subs))

    elif segment_type == SegmentType.INACTIVE_30:
        # Users with no orders in last 30 days
        cutoff = now - timedelta(days=30)
        active_users = session.exec(
            select(Order.user_id).where(Order.created_at >= cutoff)
        ).all()
        active_set = set(active_users)

        all_users = session.exec(
            select(PushSubscription.user_id).where(PushSubscription.user_id.is_not(None))
        ).all()
        return [u for u in set(all_users) if u not in active_set]

    elif segment_type == SegmentType.INACTIVE_60:
        # Users with no orders in last 60 days
        cutoff = now - timedelta(days=60)
        active_users = session.exec(
            select(Order.user_id).where(Order.created_at >= cutoff)
        ).all()
        active_set = set(active_users)

        all_users = session.exec(
            select(PushSubscription.user_id).where(PushSubscription.user_id.is_not(None))
        ).all()
        return [u for u in set(all_users) if u not in active_set]

    elif segment_type == SegmentType.VIP:
        # Top 20% by total spent
        order_totals = session.exec(
            select(Order.user_id, func.sum(Order.total_amount).label("total"))
            .group_by(Order.user_id)
            .order_by(func.sum(Order.total_amount).desc())
        ).all()

        if not order_totals:
            return []

        # Get top 20%
        top_count = max(1, len(order_totals) // 5)
        vip_users = [row[0] for row in order_totals[:top_count]]

        # Filter to those with subscriptions
        subscribed = session.exec(
            select(PushSubscription.user_id).where(
                PushSubscription.user_id.in_(vip_users)
            )
        ).all()
        return list(set(subscribed))

    elif segment_type == SegmentType.NEW_USERS:
        # Users registered in last 7 days with no orders
        cutoff = now - timedelta(days=7)
        new_users = session.exec(
            select(User.id).where(User.created_at >= cutoff)
        ).all()

        users_with_orders = session.exec(
            select(Order.user_id).where(Order.user_id.in_(new_users))
        ).all()
        orders_set = set(users_with_orders)

        # Filter to those with subscriptions and no orders
        subscribed = session.exec(
            select(PushSubscription.user_id).where(
                PushSubscription.user_id.in_(new_users)
            )
        ).all()
        return [u for u in set(subscribed) if u not in orders_set]

    elif segment_type == SegmentType.BY_CITY:
        if not segment_value:
            return []
        # Users in the specified city (using commune field)
        users_in_city = session.exec(
            select(User.id).where(
                func.lower(User.commune) == segment_value.lower()
            )
        ).all()
        city_users_set = set(users_in_city)

        # Filter to those with subscriptions
        subscribed = session.exec(
            select(PushSubscription.user_id).where(
                PushSubscription.user_id.in_(list(city_users_set))
            )
        ).all()
        return list(set(subscribed))

    return []


def get_subscriptions_by_user_ids(
    session: Session,
    user_ids: List[int]
) -> List[PushSubscription]:
    """Get subscriptions for given user IDs."""
    if not user_ids:
        return []
    return list(session.exec(
        select(PushSubscription).where(PushSubscription.user_id.in_(user_ids))
    ).all())


def get_user_ids_by_groups(
    session: Session,
    group_ids: List[int]
) -> List[int]:
    """Get list of user IDs belonging to specified groups."""
    if not group_ids:
        return []

    # Query the UserGroupLink table
    user_ids = session.exec(
        select(UserGroupLink.user_id)
        .where(UserGroupLink.group_id.in_(group_ids))
        .distinct()
    ).all()

    return list(user_ids)


def get_all_subscriptions(session: Session) -> List[PushSubscription]:
    """Get all subscriptions."""
    return list(session.exec(select(PushSubscription)).all())


# =============================================================================
# PUBLIC ENDPOINTS
# =============================================================================

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
        # Update language preference if changed
        if existing.preferred_language != subscription.language:
            existing.preferred_language = subscription.language
            session.add(existing)
            session.commit()
        return {"message": "Already subscribed"}

    # Create new subscription
    db_sub = PushSubscription(
        endpoint=subscription.endpoint,
        p256dh=subscription.keys.get("p256dh", ""),
        auth=subscription.keys.get("auth", ""),
        user_id=current_user.id if current_user else None,
        preferred_language=subscription.language
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


# =============================================================================
# ADMIN ENDPOINTS
# =============================================================================

@router.get("/segments", response_model=List[SegmentInfo])
def get_segments(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
):
    """Get available segments with subscriber counts."""
    now = datetime.now(timezone.utc)

    # Total subscribers
    total_subs = session.exec(select(func.count(PushSubscription.id))).one()

    segments = []

    # All users
    segments.append(SegmentInfo(
        segment_type=SegmentType.ALL,
        label="All Users",
        count=total_subs,
        description="All subscribed users"
    ))

    # Inactive 30 days
    inactive_30_count = len(get_user_ids_by_segment(session, SegmentType.INACTIVE_30))
    segments.append(SegmentInfo(
        segment_type=SegmentType.INACTIVE_30,
        label="Inactive 30+ days",
        count=inactive_30_count,
        description="No orders in last 30 days"
    ))

    # Inactive 60 days
    inactive_60_count = len(get_user_ids_by_segment(session, SegmentType.INACTIVE_60))
    segments.append(SegmentInfo(
        segment_type=SegmentType.INACTIVE_60,
        label="Inactive 60+ days",
        count=inactive_60_count,
        description="No orders in last 60 days"
    ))

    # VIP
    vip_count = len(get_user_ids_by_segment(session, SegmentType.VIP))
    segments.append(SegmentInfo(
        segment_type=SegmentType.VIP,
        label="VIP Customers",
        count=vip_count,
        description="Top 20% by total spent"
    ))

    # New users
    new_count = len(get_user_ids_by_segment(session, SegmentType.NEW_USERS))
    segments.append(SegmentInfo(
        segment_type=SegmentType.NEW_USERS,
        label="New Users",
        count=new_count,
        description="Registered in last 7 days, no orders"
    ))

    return segments


@router.get("/cities", response_model=List[CityStat])
def get_cities(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
):
    """Get cities (communes) with subscriber counts."""
    # Get users with subscriptions
    subscribed_users = session.exec(
        select(PushSubscription.user_id).where(PushSubscription.user_id.is_not(None))
    ).all()
    subscribed_set = set(subscribed_users)

    if not subscribed_set:
        return []

    # Get cities from user commune field
    city_counts = session.exec(
        select(User.commune, func.count(User.id).label("count"))
        .where(User.id.in_(list(subscribed_set)), User.commune.is_not(None))
        .group_by(User.commune)
        .order_by(func.count(User.id).desc())
    ).all()

    return [CityStat(city=row[0], count=row[1]) for row in city_counts if row[0]]


@router.get("/wilayas")
def get_wilayas(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
):
    """Get wilayas with user counts."""
    # Get users with subscriptions
    subscribed_users = session.exec(
        select(PushSubscription.user_id).where(PushSubscription.user_id.is_not(None))
    ).all()
    subscribed_set = set(subscribed_users)

    if not subscribed_set:
        return []

    # Get wilayas from users
    wilaya_counts = session.exec(
        select(User.wilaya, func.count(User.id).label("count"))
        .where(User.id.in_(list(subscribed_set)), User.wilaya.is_not(None))
        .group_by(User.wilaya)
        .order_by(User.wilaya)
    ).all()

    return [{"name": row[0], "user_count": row[1]} for row in wilaya_counts if row[0]]


@router.get("/dairas")
def get_dairas(
    wilaya: str = Query(..., description="Wilaya name"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
):
    """Get dairas for a wilaya with user counts."""
    # Get users with subscriptions
    subscribed_users = session.exec(
        select(PushSubscription.user_id).where(PushSubscription.user_id.is_not(None))
    ).all()
    subscribed_set = set(subscribed_users)

    if not subscribed_set:
        return []

    # Get dairas for the wilaya
    daira_counts = session.exec(
        select(User.daira, func.count(User.id).label("count"))
        .where(
            User.id.in_(list(subscribed_set)),
            User.wilaya == wilaya,
            User.daira.is_not(None)
        )
        .group_by(User.daira)
        .order_by(User.daira)
    ).all()

    return [{"name": row[0], "user_count": row[1]} for row in daira_counts if row[0]]


@router.get("/communes")
def get_communes(
    daira: str = Query(..., description="Daira name"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
):
    """Get communes for a daira with user counts."""
    # Get users with subscriptions
    subscribed_users = session.exec(
        select(PushSubscription.user_id).where(PushSubscription.user_id.is_not(None))
    ).all()
    subscribed_set = set(subscribed_users)

    if not subscribed_set:
        return []

    # Get communes for the daira
    commune_counts = session.exec(
        select(User.commune, func.count(User.id).label("count"))
        .where(
            User.id.in_(list(subscribed_set)),
            User.daira == daira,
            User.commune.is_not(None)
        )
        .group_by(User.commune)
        .order_by(User.commune)
    ).all()

    return [{"name": row[0], "user_count": row[1]} for row in commune_counts if row[0]]


@router.get("/preview-count")
def preview_recipient_count(
    segment_type: SegmentType,
    segment_value: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
):
    """Get the number of recipients for a segment."""
    if segment_type == SegmentType.ALL:
        count = session.exec(select(func.count(PushSubscription.id))).one()
    elif segment_type == SegmentType.BY_CITY:
        user_ids = get_user_ids_by_segment(session, segment_type, segment_value)
        count = len(user_ids)
    else:
        user_ids = get_user_ids_by_segment(session, segment_type)
        count = len(user_ids)

    return {"count": count}


@router.post("/send")
def send_notification(
    notification: NotificationRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
):
    """Send push notification to all subscribers (legacy endpoint)."""
    subscriptions = get_all_subscriptions(session)

    if not subscriptions:
        raise HTTPException(status_code=400, detail="No subscribers")

    result = PushService.send_to_all(
        subscriptions,
        notification.title,
        notification.body,
        notification.url
    )

    # Remove expired subscriptions (batch load)
    expired_ids = result.get("expired_ids", [])
    if expired_ids:
        expired_subs = session.exec(
            select(PushSubscription).where(PushSubscription.id.in_(expired_ids))
        ).all()
        for sub in expired_subs:
            session.delete(sub)
    session.commit()

    return {
        "message": f"Sent to {result['sent']} subscribers",
        "sent": result["sent"],
        "failed": result["failed"]
    }


@router.post("/send-targeted")
def send_targeted_notification(
    notification: TargetedNotificationRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
):
    """Send targeted push notification with multi-language support."""
    # Get user IDs based on segment
    if notification.segment_type == SegmentType.ALL:
        # Get all user IDs with subscriptions
        all_user_ids = session.exec(
            select(PushSubscription.user_id).where(PushSubscription.user_id.is_not(None))
        ).all()
        user_ids = list(set(all_user_ids))
    else:
        user_ids = get_user_ids_by_segment(
            session,
            notification.segment_type,
            notification.segment_value
        )

    # Filter by user groups if specified
    if notification.user_group_ids:
        group_user_ids = set(get_user_ids_by_groups(session, notification.user_group_ids))
        user_ids = [uid for uid in user_ids if uid in group_user_ids]

    # Get subscriptions for filtered user IDs
    subscriptions = get_subscriptions_by_user_ids(session, user_ids)

    if not subscriptions:
        raise HTTPException(status_code=400, detail="No subscribers match the criteria")

    # Check if scheduled
    if notification.scheduled_at and notification.scheduled_at > datetime.now(timezone.utc):
        # Save for later
        history = NotificationHistory(
            title_en=notification.title_en,
            title_fr=notification.title_fr,
            title_ar=notification.title_ar,
            body_en=notification.body_en,
            body_fr=notification.body_fr,
            body_ar=notification.body_ar,
            url=notification.url,
            image_url=notification.image_url,
            segment_type=notification.segment_type,
            segment_value=notification.segment_value,
            notification_type=notification.notification_type,
            target_id=notification.target_id,
            status=NotificationStatus.SCHEDULED,
            scheduled_at=notification.scheduled_at,
            created_by=current_user.id
        )
        session.add(history)
        session.commit()

        return {
            "message": f"Scheduled for {notification.scheduled_at}",
            "scheduled": True,
            "recipient_count": len(subscriptions)
        }

    # Send immediately with multi-language support
    sent = 0
    failed = 0
    expired_ids = []

    for sub in subscriptions:
        # Get content in user's preferred language
        lang = sub.preferred_language or "en"
        title = getattr(notification, f"title_{lang}", None) or notification.title_en
        body = getattr(notification, f"body_{lang}", None) or notification.body_en

        subscription_info = {
            "endpoint": sub.endpoint,
            "keys": {"p256dh": sub.p256dh, "auth": sub.auth}
        }

        result = PushService.send(
            subscription_info,
            title,
            body,
            notification.url,
            notification.image_url
        )

        if result["success"]:
            sent += 1
        else:
            failed += 1
            if "410" in str(result.get("error", "")):
                expired_ids.append(sub.id)

    # Remove expired subscriptions (batch load)
    if expired_ids:
        expired_subs = session.exec(
            select(PushSubscription).where(PushSubscription.id.in_(expired_ids))
        ).all()
        for sub in expired_subs:
            session.delete(sub)

    # Save to history
    history = NotificationHistory(
        title_en=notification.title_en,
        title_fr=notification.title_fr,
        title_ar=notification.title_ar,
        body_en=notification.body_en,
        body_fr=notification.body_fr,
        body_ar=notification.body_ar,
        url=notification.url,
        image_url=notification.image_url,
        segment_type=notification.segment_type,
        segment_value=notification.segment_value,
        notification_type=notification.notification_type,
        target_id=notification.target_id,
        status=NotificationStatus.SENT,
        sent_count=sent,
        failed_count=failed,
        sent_at=datetime.now(timezone.utc),
        created_by=current_user.id
    )
    session.add(history)
    session.commit()

    return {
        "message": f"Sent to {sent} subscribers",
        "sent": sent,
        "failed": failed
    }


@router.get("/history", response_model=List[NotificationHistoryRead])
def get_notification_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
):
    """Get notification history."""
    history = session.exec(
        select(NotificationHistory)
        .order_by(NotificationHistory.created_at.desc())
        .offset(skip)
        .limit(limit)
    ).all()

    return list(history)


@router.get("/history/{history_id}", response_model=NotificationHistoryRead)
def get_notification_detail(
    history_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
):
    """Get notification detail."""
    history = session.get(NotificationHistory, history_id)
    if not history:
        raise HTTPException(status_code=404, detail="Notification not found")
    return history


# =============================================================================
# DATA ENDPOINTS FOR NOTIFICATION BUILDER
# =============================================================================

@router.get("/promotions-list")
def get_promotions_for_notifications(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
):
    """Get active promotions for notification builder."""
    now = datetime.now(timezone.utc)
    promotions = session.exec(
        select(Promotion).where(
            Promotion.is_active == True,
            Promotion.end_date >= now
        )
    ).all()

    return [{
        "id": p.id,
        "name_en": p.get_translated_name("en"),
        "name_fr": p.get_translated_name("fr"),
        "name_ar": p.get_translated_name("ar"),
        "description_en": p.get_translated_description("en"),
        "description_fr": p.get_translated_description("fr"),
        "description_ar": p.get_translated_description("ar"),
        "discount_type": p.discount_type,
        "discount_value": p.discount_value,
        "code": p.code
    } for p in promotions]


@router.get("/products-list")
def get_products_for_notifications(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
):
    """Get products for notification builder."""
    products = session.exec(
        select(Product).where(Product.is_active == True).limit(100)
    ).all()

    return [{
        "id": p.id,
        "name_en": p.get_translated_name("en"),
        "name_fr": p.get_translated_name("fr"),
        "name_ar": p.get_translated_name("ar"),
        "image_url": p.image_url,
        "price": p.price
    } for p in products]


@router.get("/categories-list")
def get_categories_for_notifications(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
):
    """Get categories for notification builder."""
    categories = session.exec(select(Category)).all()

    return [{
        "id": c.id,
        "name_en": c.get_translated_name("en"),
        "name_fr": c.get_translated_name("fr"),
        "name_ar": c.get_translated_name("ar"),
        "image_url": c.image_url
    } for c in categories]


@router.get("/brands-list")
def get_brands_for_notifications(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
):
    """Get brands for notification builder."""
    brands = session.exec(select(Brand)).all()

    return [{
        "id": b.id,
        "name_en": b.get_translated_name("en"),
        "name_fr": b.get_translated_name("fr"),
        "name_ar": b.get_translated_name("ar"),
        "logo_url": b.logo_url
    } for b in brands]
