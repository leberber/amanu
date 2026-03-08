# backend/app/api/api_v1/endpoints/user_notifications.py
"""
API endpoints for user notifications (in-app notifications).
"""
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func

from app.database import get_session
from app.models.user import User
from app.models.user_notification import (
    UserNotification,
    UserNotificationRead,
    UnreadCountResponse,
)
from app.core.security import get_current_active_user

router = APIRouter()


@router.get("", response_model=List[UserNotificationRead])
def get_my_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
    lang: str = Query("en", description="Language for translations (en, fr, ar)"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get current user's notifications.
    """
    query = select(UserNotification).where(
        UserNotification.user_id == current_user.id
    )

    if unread_only:
        query = query.where(UserNotification.is_read == False)

    query = query.order_by(UserNotification.created_at.desc()).offset(skip).limit(limit)

    notifications = session.exec(query).all()

    # Apply translations based on language
    result = []
    for notif in notifications:
        # Get translated title
        title = notif.title
        if lang != "en" and notif.title_translations:
            title = notif.title_translations.get(lang, notif.title)

        # Get translated message
        message = notif.message
        if lang != "en" and notif.message_translations:
            message = notif.message_translations.get(lang, notif.message)

        notif_data = UserNotificationRead(
            id=notif.id,
            user_id=notif.user_id,
            type=notif.type,
            title=title,
            message=message,
            title_translations=notif.title_translations,
            message_translations=notif.message_translations,
            reference_id=notif.reference_id,
            reference_type=notif.reference_type,
            url=notif.url,
            is_read=notif.is_read,
            read_at=notif.read_at,
            created_at=notif.created_at,
        )
        result.append(notif_data)

    return result


@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread_count(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get count of unread notifications for current user.
    """
    count = session.exec(
        select(func.count(UserNotification.id)).where(
            UserNotification.user_id == current_user.id,
            UserNotification.is_read == False,
        )
    ).one()

    return UnreadCountResponse(count=count)


@router.post("/{notification_id}/read")
def mark_as_read(
    notification_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
):
    """
    Mark a notification as read.
    """
    notification = session.exec(
        select(UserNotification).where(
            UserNotification.id == notification_id,
            UserNotification.user_id == current_user.id,
        )
    ).first()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    if not notification.is_read:
        notification.is_read = True
        notification.read_at = datetime.now(timezone.utc)
        session.add(notification)
        session.commit()

    return {"message": "Marked as read"}


@router.post("/read-all")
def mark_all_as_read(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
):
    """
    Mark all notifications as read for current user.
    """
    notifications = session.exec(
        select(UserNotification).where(
            UserNotification.user_id == current_user.id,
            UserNotification.is_read == False,
        )
    ).all()

    now = datetime.now(timezone.utc)
    for notif in notifications:
        notif.is_read = True
        notif.read_at = now
        session.add(notif)

    session.commit()

    return {"message": f"Marked {len(notifications)} notifications as read"}


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
):
    """
    Delete a notification.
    """
    notification = session.exec(
        select(UserNotification).where(
            UserNotification.id == notification_id,
            UserNotification.user_id == current_user.id,
        )
    ).first()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    session.delete(notification)
    session.commit()

    return {"message": "Notification deleted"}
