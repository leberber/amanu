from typing import Optional, Any
from datetime import datetime, timezone
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, JSON


class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_logs"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    user_name: str  # denormalized — no join needed for display
    action: str    # e.g. "create", "status_change", "confirm_delivery", "update_facture", "delete_item", "delete"
    entity_type: str  # e.g. "purchase_order" — extensible to any future entity
    entity_id: int    # ID of the affected entity
    changes: Optional[Any] = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
