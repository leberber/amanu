# backend/app/core/push.py
import json
from typing import Optional
from pywebpush import webpush, WebPushException
from .config import settings


class PushService:
    """Service for sending web push notifications."""

    @classmethod
    def send(
        cls,
        subscription: dict,
        title: str,
        body: str,
        url: str = "/",
        image_url: Optional[str] = None
    ) -> dict:
        """Send push notification to a single subscription."""
        if not settings.VAPID_PRIVATE_KEY:
            return {"success": False, "error": "VAPID keys not configured"}

        # Angular service worker expects this format
        notification_data = {
            "title": title,
            "body": body,
            "icon": "/icons/pwa-192x192.png",
            "badge": "/icons/pwa-72x72.png",
            "data": {
                "onActionClick": {
                    "default": {"operation": "navigateLastFocusedOrOpen", "url": url}
                }
            }
        }

        # Add image if provided (supported on some platforms)
        if image_url:
            notification_data["image"] = image_url

        payload = json.dumps({"notification": notification_data})

        try:
            webpush(
                subscription_info=subscription,
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": settings.VAPID_CLAIMS_EMAIL}
            )
            return {"success": True}
        except WebPushException as e:
            return {"success": False, "error": str(e)}

    @classmethod
    def send_to_all(cls, subscriptions: list, title: str, body: str, url: str = "/") -> dict:
        """Send push notification to multiple subscriptions."""
        sent = 0
        failed = 0
        expired = []

        for sub in subscriptions:
            subscription_info = {
                "endpoint": sub.endpoint,
                "keys": {"p256dh": sub.p256dh, "auth": sub.auth}
            }
            result = cls.send(subscription_info, title, body, url)
            if result["success"]:
                sent += 1
            else:
                failed += 1
                # If subscription expired, mark for removal
                if "410" in str(result.get("error", "")):
                    expired.append(sub.id)

        return {"sent": sent, "failed": failed, "expired_ids": expired}
