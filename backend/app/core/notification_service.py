# backend/app/core/notification_service.py
"""
Service for sending user notifications (in-app + push).
This handles both storing notifications in the database and sending push notifications.
"""
from typing import Optional, Dict
from sqlmodel import Session, select
from datetime import datetime, timezone

from app.models.user_notification import UserNotification, NotificationType
from app.models.push_subscription import PushSubscription
from app.core.push import PushService
from app.models.user import User, UserRole


class NotificationService:
    """Service for managing user notifications."""

    # Notification templates for order events
    TEMPLATES = {
        NotificationType.ORDER_CONFIRMED: {
            "title": "Order Confirmed",
            "title_translations": {"fr": "Commande confirmée", "ar": "تم تأكيد الطلب"},
            "message": "Your order #{order_id} has been confirmed and is being prepared.",
            "message_translations": {
                "fr": "Votre commande #{order_id} a été confirmée et est en cours de préparation.",
                "ar": "تم تأكيد طلبك #{order_id} وجاري تحضيره.",
            },
        },
        NotificationType.ORDER_SHIPPED: {
            "title": "Order Shipped",
            "title_translations": {"fr": "Commande expédiée", "ar": "تم شحن الطلب"},
            "message": "Your order #{order_id} is on its way!",
            "message_translations": {
                "fr": "Votre commande #{order_id} est en route!",
                "ar": "طلبك #{order_id} في الطريق!",
            },
        },
        NotificationType.ORDER_DELIVERED: {
            "title": "Order Delivered",
            "title_translations": {"fr": "Commande livrée", "ar": "تم تسليم الطلب"},
            "message": "Your order #{order_id} has been delivered. Enjoy!",
            "message_translations": {
                "fr": "Votre commande #{order_id} a été livrée. Bon appétit!",
                "ar": "تم تسليم طلبك #{order_id}. بالهناء والشفاء!",
            },
        },
        NotificationType.ORDER_CANCELLED: {
            "title": "Order Cancelled",
            "title_translations": {"fr": "Commande annulée", "ar": "تم إلغاء الطلب"},
            "message": "Your order #{order_id} has been cancelled.",
            "message_translations": {
                "fr": "Votre commande #{order_id} a été annulée.",
                "ar": "تم إلغاء طلبك #{order_id}.",
            },
        },
        NotificationType.PAYMENT_RECEIVED: {
            "title": "Payment Received",
            "title_translations": {"fr": "Paiement reçu", "ar": "تم استلام الدفع"},
            "message": "Payment for order #{order_id} has been received. Thank you!",
            "message_translations": {
                "fr": "Le paiement pour la commande #{order_id} a été reçu. Merci!",
                "ar": "تم استلام الدفع للطلب #{order_id}. شكراً!",
            },
        },
        NotificationType.TRIP_ASSIGNED: {
            "title": "New Trip Assigned",
            "title_translations": {"fr": "Nouvelle tournée assignée", "ar": "رحلة جديدة مخصصة"},
            "message": "You have a new trip with {stop_count} stops ({total_weight_kg} kg). Open the app to view details.",
            "message_translations": {
                "fr": "Vous avez une nouvelle tournée avec {stop_count} arrêts ({total_weight_kg} kg). Ouvrez l'application pour voir les détails.",
                "ar": "لديك رحلة جديدة بها {stop_count} محطات ({total_weight_kg} كغ). افتح التطبيق لعرض التفاصيل.",
            },
        },
    }

    @classmethod
    def notify_user(
        cls,
        session: Session,
        user_id: int,
        notification_type: NotificationType,
        title: str,
        message: str,
        title_translations: Optional[Dict[str, str]] = None,
        message_translations: Optional[Dict[str, str]] = None,
        reference_id: Optional[int] = None,
        reference_type: Optional[str] = None,
        url: Optional[str] = None,
    ) -> UserNotification:
        """
        Send notification to a user.
        1. Saves to user_notifications table
        2. Sends push notification to all user's devices

        Returns the created notification.
        """
        # 1. Save to database
        notification = UserNotification(
            user_id=user_id,
            type=notification_type.value if isinstance(notification_type, NotificationType) else notification_type,
            title=title,
            message=message,
            title_translations=title_translations or {},
            message_translations=message_translations or {},
            reference_id=reference_id,
            reference_type=reference_type,
            url=url,
            created_at=datetime.now(timezone.utc),
        )
        session.add(notification)
        session.flush()  # Get the ID without committing

        # 2. Send push notification to all user's devices
        subscriptions = session.exec(
            select(PushSubscription).where(PushSubscription.user_id == user_id)
        ).all()

        for sub in subscriptions:
            # Get content in user's preferred language
            lang = sub.preferred_language or "en"
            push_title = title
            push_message = message

            if lang != "en" and title_translations:
                push_title = title_translations.get(lang, title)
            if lang != "en" and message_translations:
                push_message = message_translations.get(lang, message)

            subscription_info = {
                "endpoint": sub.endpoint,
                "keys": {"p256dh": sub.p256dh, "auth": sub.auth}
            }

            result = PushService.send(
                subscription_info,
                push_title,
                push_message,
                url or "/"
            )

            # If subscription expired, remove it
            if not result["success"] and "410" in str(result.get("error", "")):
                session.delete(sub)

        return notification

    @classmethod
    def notify_order_status(
        cls,
        session: Session,
        user_id: int,
        order_id: int,
        status: str,
    ) -> Optional[UserNotification]:
        """
        Send notification for order status change.
        Maps order status to notification type and uses templates.
        """
        # Map order status to notification type
        status_to_type = {
            "confirmed": NotificationType.ORDER_CONFIRMED,
            "shipped": NotificationType.ORDER_SHIPPED,
            "delivered": NotificationType.ORDER_DELIVERED,
            "cancelled": NotificationType.ORDER_CANCELLED,
        }

        notification_type = status_to_type.get(status.lower())
        if not notification_type:
            return None

        # Get template
        template = cls.TEMPLATES.get(notification_type)
        if not template:
            return None

        # Format messages with order ID
        title = template["title"]
        message = template["message"].format(order_id=order_id)

        # Format translations with order ID
        title_translations = template.get("title_translations", {})
        message_translations = {}
        for lang, msg in template.get("message_translations", {}).items():
            message_translations[lang] = msg.format(order_id=order_id)

        return cls.notify_user(
            session=session,
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            message=message,
            title_translations=title_translations,
            message_translations=message_translations,
            reference_id=order_id,
            reference_type="order",
            url=f"/orders/{order_id}",
        )

    @classmethod
    def notify_trip_assigned(
        cls,
        session: Session,
        driver_user_id: int,
        trip_id: int,
        stop_count: int,
        total_weight_kg: float,
    ) -> UserNotification:
        """
        Send notification to a driver when a trip is assigned to them.
        """
        template = cls.TEMPLATES[NotificationType.TRIP_ASSIGNED]

        title = template["title"]
        message = template["message"].format(
            stop_count=stop_count,
            total_weight_kg=round(total_weight_kg, 1),
        )

        title_translations = template.get("title_translations", {})
        message_translations = {}
        for lang, msg in template.get("message_translations", {}).items():
            message_translations[lang] = msg.format(
                stop_count=stop_count,
                total_weight_kg=round(total_weight_kg, 1),
            )

        return cls.notify_user(
            session=session,
            user_id=driver_user_id,
            notification_type=NotificationType.TRIP_ASSIGNED,
            title=title,
            message=message,
            title_translations=title_translations,
            message_translations=message_translations,
            reference_id=trip_id,
            reference_type="trip",
            url=f"/driver/trip/{trip_id}",
        )

    @classmethod
    def notify_admins_new_order(
        cls,
        session: Session,
        order_id: int,
        customer_name: str,
        total_amount: float,
    ) -> None:
        """Send push notification to all admin/staff users when a new order is placed."""
        # Get all active admin and staff users
        admin_users = session.exec(
            select(User).where(
                User.role.in_([UserRole.ADMIN, UserRole.STAFF]),
                User.is_active == True
            )
        ).all()

        admin_user_ids = [u.id for u in admin_users]
        if not admin_user_ids:
            return

        # Get their push subscriptions
        subscriptions = list(session.exec(
            select(PushSubscription).where(
                PushSubscription.user_id.in_(admin_user_ids)
            )
        ).all())

        if not subscriptions:
            return

        title = f"Nouvelle commande #{order_id}"
        body = f"{customer_name} — {total_amount:,.0f} DA"
        url = "/admin/orders"

        result = PushService.send_to_all(subscriptions, title, body, url)

        # Clean up expired subscriptions
        expired_ids = result.get("expired_ids", [])
        if expired_ids:
            expired_subs = session.exec(
                select(PushSubscription).where(PushSubscription.id.in_(expired_ids))
            ).all()
            for sub in expired_subs:
                session.delete(sub)
            session.commit()

    @classmethod
    def notify_admins_new_user(
        cls,
        session: Session,
        user_id: int,
        full_name: str,
        role: str,
    ) -> None:
        """Send push notification to all admin/staff users when a new account is created."""
        admin_users = session.exec(
            select(User).where(
                User.role.in_([UserRole.ADMIN, UserRole.STAFF]),
                User.is_active == True
            )
        ).all()

        admin_user_ids = [u.id for u in admin_users]
        if not admin_user_ids:
            return

        subscriptions = list(session.exec(
            select(PushSubscription).where(
                PushSubscription.user_id.in_(admin_user_ids)
            )
        ).all())

        if not subscriptions:
            return

        title = "Nouveau compte créé"
        body = f"{full_name} ({role})"
        url = f"/admin/users/{user_id}"

        result = PushService.send_to_all(subscriptions, title, body, url)

        expired_ids = result.get("expired_ids", [])
        if expired_ids:
            expired_subs = session.exec(
                select(PushSubscription).where(PushSubscription.id.in_(expired_ids))
            ).all()
            for sub in expired_subs:
                session.delete(sub)
            session.commit()

    @classmethod
    def notify_order_modified(
        cls,
        session: Session,
        user_id: int,
        order_id: int,
    ) -> UserNotification:
        """Notify customer that an admin has modified their order."""
        return cls.notify_user(
            session=session,
            user_id=user_id,
            notification_type=NotificationType.ORDER_MODIFIED,
            title=f"Order #{order_id} modified",
            message=f"Your order #{order_id} has been updated by our team.",
            title_translations={
                "fr": f"Commande #{order_id} modifiée",
                "ar": f"تم تعديل الطلب #{order_id}",
            },
            message_translations={
                "fr": f"Votre commande #{order_id} a été modifiée par notre équipe.",
                "ar": f"تم تعديل طلبك #{order_id} من قِبَل فريقنا.",
            },
            reference_id=order_id,
            reference_type="order",
            url=f"/orders/{order_id}",
        )

    @classmethod
    def notify_promotion(
        cls,
        session: Session,
        user_id: int,
        promotion_id: int,
        title: str,
        message: str,
        title_translations: Optional[Dict[str, str]] = None,
        message_translations: Optional[Dict[str, str]] = None,
    ) -> UserNotification:
        """Send notification for a promotion."""
        return cls.notify_user(
            session=session,
            user_id=user_id,
            notification_type=NotificationType.PROMOTION,
            title=title,
            message=message,
            title_translations=title_translations,
            message_translations=message_translations,
            reference_id=promotion_id,
            reference_type="promotion",
            url=f"/promotions",
        )
