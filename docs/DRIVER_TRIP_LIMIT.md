# Driver Trip Limit Feature

## Overview

Limit drivers to a configurable number of active trips at a time. When a driver has an active trip, they cannot accept new ones until they complete the current trip.

## Requirements

1. **Configurable limit** - Admin can set max active trips per driver (default: 1)
2. **Backend validation** - Prevent accepting trips when limit reached
3. **Frontend UX** - Grey out unavailable trips, show informative messages

---

## Backend Implementation

### 1. Config Model

**File:** `backend/app/models/driver_config.py`

Add field to `DriverSystemConfig`:

```python
max_active_trips_per_driver: int = Field(
    default=1,
    ge=1,
    le=10,
    description="Maximum concurrent trips a driver can have"
)
```

### 2. Accept Trip Validation

**File:** `backend/app/api/api_v1/endpoints/driver_trips.py`

In `accept_batched_trip()` endpoint, add validation:

```python
# Check active trips count
active_trips_count = session.exec(
    select(func.count(Trip.id))
    .where(Trip.driver_id == user.id)
    .where(Trip.status.in_([TripStatus.ASSIGNED, TripStatus.IN_PROGRESS]))
).one() or 0

config = get_system_config(session)

if active_trips_count >= config.max_active_trips_per_driver:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Maximum active trips ({config.max_active_trips_per_driver}) reached. Complete current trip first."
    )
```

### 3. Admin Config Endpoint

**File:** `backend/app/api/api_v1/endpoints/admin_drivers.py`

Add/update endpoint to manage config:

```python
class DriverConfigUpdate(SQLModel):
    max_active_trips_per_driver: Optional[int] = None
    # ... other config fields

@router.patch("/config")
def update_driver_config(
    config_update: DriverConfigUpdate,
    current_user: User = Depends(get_current_admin_user),
    session: Session = Depends(get_session),
):
    config = get_or_create_system_config(session)

    if config_update.max_active_trips_per_driver is not None:
        config.max_active_trips_per_driver = config_update.max_active_trips_per_driver

    session.add(config)
    session.commit()
    session.refresh(config)

    return config
```

---

## Frontend Implementation

### 1. Driver Service

**File:** `frontend/src/app/services/driver.service.ts`

Add computed signal for active trip status:

```typescript
// Check if driver has an active trip
readonly hasActiveTrip = computed(() => {
  const trips = this._activeMultiTrips();
  return trips.some(t =>
    t.status === 'assigned' || t.status === 'in_progress'
  );
});

readonly activeTrip = computed(() => {
  return this._activeMultiTrips().find(t =>
    t.status === 'assigned' || t.status === 'in_progress'
  ) || null;
});
```

### 2. Pending Trips List

**File:** `frontend/src/app/driver/pages/available-trips/` (or similar)

```html
@for (trip of pendingTrips(); track trip.id) {
  <div
    class="trip-card"
    [class.trip-card--disabled]="hasActiveTrip()"
    (click)="!hasActiveTrip() && viewTrip(trip)">

    <!-- Trip content -->

    @if (hasActiveTrip()) {
      <div class="trip-card__overlay">
        <span>{{ 'driver.complete_current_trip' | translate }}</span>
      </div>
    }
  </div>
}
```

**Styles:**

```scss
.trip-card {
  &--disabled {
    opacity: 0.5;
    pointer-events: none;

    .trip-card__overlay {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 8px;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      font-size: 0.875rem;
      text-align: center;
    }
  }
}
```

### 3. Trip Detail Page

**File:** `frontend/src/app/driver/pages/trip-detail/driver-trip-detail.component.ts`

```typescript
// Inject driver service
private readonly driverService = inject(DriverService);

// Check if can accept this trip
canAcceptTrip = computed(() => {
  const trip = this.trip();
  if (!trip || trip.status !== 'pending') return false;
  return !this.driverService.hasActiveTrip();
});
```

**Template:**

```html
@if (isPendingTrip()) {
  @if (canAcceptTrip()) {
    <button class="action-btn" (click)="acceptTrip()">
      {{ 'driver.trip.accept' | translate }}
    </button>
  } @else {
    <div class="info-banner">
      <i class="pi pi-info-circle"></i>
      {{ 'driver.complete_current_trip_first' | translate }}
    </div>
    <button class="action-btn" disabled>
      {{ 'driver.trip.accept' | translate }}
    </button>
  }
}
```

### 4. Admin Settings UI

**File:** `frontend/src/app/admin/pages/settings/` (or driver config section)

```html
<div class="setting-item">
  <label>{{ 'admin.settings.max_active_trips' | translate }}</label>
  <p-inputNumber
    [(ngModel)]="config.max_active_trips_per_driver"
    [min]="1"
    [max]="10"
    [showButtons]="true"
  />
  <small>{{ 'admin.settings.max_active_trips_hint' | translate }}</small>
</div>
```

---

## Translations

### French (fr.json)

```json
{
  "driver": {
    "complete_current_trip": "Terminez votre trajet en cours",
    "complete_current_trip_first": "Terminez votre trajet actuel avant d'en accepter un nouveau"
  },
  "admin": {
    "settings": {
      "max_active_trips": "Trajets actifs max par chauffeur",
      "max_active_trips_hint": "Nombre de trajets qu'un chauffeur peut avoir simultanément"
    }
  }
}
```

### English (en.json)

```json
{
  "driver": {
    "complete_current_trip": "Complete your current trip",
    "complete_current_trip_first": "Complete your current trip before accepting a new one"
  },
  "admin": {
    "settings": {
      "max_active_trips": "Max active trips per driver",
      "max_active_trips_hint": "Number of trips a driver can have at the same time"
    }
  }
}
```

### Arabic (ar.json)

```json
{
  "driver": {
    "complete_current_trip": "أكمل رحلتك الحالية",
    "complete_current_trip_first": "أكمل رحلتك الحالية قبل قبول رحلة جديدة"
  },
  "admin": {
    "settings": {
      "max_active_trips": "الحد الأقصى للرحلات النشطة لكل سائق",
      "max_active_trips_hint": "عدد الرحلات التي يمكن للسائق القيام بها في نفس الوقت"
    }
  }
}
```

---

## User Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     DRIVER APP FLOW                         │
└─────────────────────────────────────────────────────────────┘

1. Driver opens app
   │
   ├─► Has active trip?
   │   │
   │   ├─► YES: Show active trip prominently
   │   │        Grey out pending trips list
   │   │        "Complete current trip first" message
   │   │
   │   └─► NO: Show all pending trips as normal
   │           Driver can accept any trip
   │
2. Driver tries to accept trip
   │
   ├─► Backend checks: active_trips < max_limit?
   │   │
   │   ├─► YES: Accept trip, status → ASSIGNED
   │   │
   │   └─► NO: Return error 400
   │           "Maximum active trips reached"
   │
3. Driver completes trip
   │
   └─► Can now accept new trips
```

---

## Database Migration

If using Alembic, create migration:

```python
"""Add max_active_trips_per_driver to driver_system_config

Revision ID: xxxx
"""

from alembic import op
import sqlalchemy as sa

def upgrade():
    op.add_column(
        'driver_system_config',
        sa.Column('max_active_trips_per_driver', sa.Integer(), nullable=False, server_default='1')
    )

def downgrade():
    op.drop_column('driver_system_config', 'max_active_trips_per_driver')
```

Or run SQL directly:

```sql
ALTER TABLE driver_system_config
ADD COLUMN max_active_trips_per_driver INTEGER NOT NULL DEFAULT 1;
```

---

## Testing Checklist

- [ ] Backend: Config default is 1
- [ ] Backend: Accept endpoint rejects when limit reached
- [ ] Backend: Admin can update config
- [ ] Frontend: Pending trips greyed out when driver has active trip
- [ ] Frontend: Accept button disabled with message
- [ ] Frontend: Admin can change setting in UI
- [ ] Translations: All 3 languages have new keys
