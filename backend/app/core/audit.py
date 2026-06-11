from sqlmodel import Session
from app.models.audit_log import AuditLog


def log_audit(
    session: Session,
    user,
    action: str,
    entity_type: str,
    entity_id: int,
    changes: dict = None,
) -> None:
    """
    Write one audit log entry.

    Usage:
        log_audit(session, current_user, "status_change", "purchase_order", order.id,
                  {"status": {"old": "sent", "new": "delivered"}})

    Call this BEFORE session.commit() so it is part of the same transaction.
    To add audit logging to another entity, just pass a different entity_type string.
    """
    audit = AuditLog(
        user_id=user.id,
        user_name=user.full_name or user.email,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        changes=changes,
    )
    session.add(audit)
