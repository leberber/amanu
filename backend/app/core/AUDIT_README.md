# Audit Logging System

## How it works

Every mutating action writes one row to the `audit_logs` table via the `log_audit()` helper.

The table is generic — `entity_type` is a plain string so any entity can be tracked without schema changes.

```
audit_logs
├── id
├── user_id       → FK to users
├── user_name     → denormalized (no join needed for display)
├── action        → e.g. "create", "status_change", "delete"
├── entity_type   → e.g. "purchase_order"
├── entity_id     → ID of the affected record
├── changes       → JSON  { field: { old: ..., new: ... } }  (nullable)
└── created_at
```

---

## Adding audit logging to a new entity

1. Import the helper in your endpoint file:

```python
from app.core.audit import log_audit
```

2. Add `current_user` to your endpoint signature:

```python
from app.models.user import User
from app.core.security import get_current_staff_user

@router.put("/{id}")
async def update_something(
    id: int,
    data: SomeUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
):
```

3. Call `log_audit()` **before** `session.commit()`:

```python
log_audit(session, current_user, "update", "your_entity_type", id,
          {"field_name": {"old": old_value, "new": new_value}})
session.commit()
```

4. Add a GET endpoint to expose the logs for that entity:

```python
@router.get("/{id}/audit-logs")
async def get_audit_logs(id: int, session: Session = Depends(get_session)):
    logs = session.exec(
        select(AuditLog)
        .where(AuditLog.entity_type == "your_entity_type")
        .where(AuditLog.entity_id == id)
        .order_by(AuditLog.created_at.desc())
    ).all()
    return logs
```

---

## Entities currently tracked

| entity_type      | File                                          | Actions logged                                                      |
|------------------|-----------------------------------------------|---------------------------------------------------------------------|
| `purchase_order` | `api/api_v1/endpoints/purchase_orders.py`     | `create`, `status_change`, `confirm_delivery`, `update_order`, `update_facture`, `delete_item`, `delete` |

---

## Action name conventions

Use snake_case. Keep names consistent across entities:

| Action            | Meaning                        |
|-------------------|--------------------------------|
| `create`          | Record created                 |
| `update`          | General field update           |
| `status_change`   | Status field changed           |
| `delete`          | Record deleted                 |
| `delete_item`     | Child record deleted           |
| `confirm_delivery`| Domain-specific workflow step  |
| `update_facture`  | Invoice data updated           |
