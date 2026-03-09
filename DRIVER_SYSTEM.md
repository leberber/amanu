# Driver System - Implementation Specification

## Overview

The driver system enables delivery drivers to claim and fulfill orders through a dedicated mobile-first interface. Drivers see a completely different app experience than customers, focused on available trips, active deliveries, and earnings.

---

## Table of Contents

1. [Roles & Access](#roles--access)
2. [Order Flow](#order-flow)
3. [Configuration](#configuration)
4. [Data Models](#data-models)
5. [API Endpoints](#api-endpoints)
6. [Frontend Pages](#frontend-pages)
7. [Background Jobs](#background-jobs)
8. [Safeguards](#safeguards)
9. [Implementation Order](#implementation-order)

---

## Roles & Access

### User Roles

| Role | Access |
|------|--------|
| `customer` | Shop, place orders, view order history |
| `driver` | View available trips, accept/deliver orders, view earnings |
| `staff` | Manage orders, view reports |
| `admin` | Full access + user management, settings, driver management |

### App Experience by Role

- **Customer**: Product catalog, cart, checkout, order tracking
- **Driver**: Available trips dashboard, active deliveries, earnings (completely separate UI)
- **Staff/Admin**: Admin panel with order management, driver management

---

## Order Flow

### Status Progression

```
PENDING → CONFIRMED → ASSIGNED → PICKED_UP → IN_TRANSIT → DELIVERED
                ↓
           CANCELLED
```

### Status Definitions

| Status | Description | Triggered By |
|--------|-------------|--------------|
| `pending` | Order placed, awaiting confirmation | Customer checkout |
| `confirmed` | Order confirmed, available in driver pool | Admin/Auto |
| `assigned` | Driver has claimed the order | Driver accepts |
| `picked_up` | Driver has collected items from warehouse | Driver confirms |
| `in_transit` | Driver is en route to customer | Driver starts delivery |
| `delivered` | Order successfully delivered | Driver confirms |
| `cancelled` | Order cancelled | Admin/Customer/System |

### Assignment Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        ORDER CONFIRMED                          │
│                              ↓                                  │
│                    Available in Driver Pool                     │
│                              ↓                                  │
│         ┌────────────────────┴────────────────────┐            │
│         ↓                                         ↓            │
│   Driver Self-Assign                      Admin Manual Assign   │
│   (from available trips)                  (from admin panel)    │
│         ↓                                         ↓            │
│         └────────────────────┬────────────────────┘            │
│                              ↓                                  │
│                      ORDER ASSIGNED                             │
│                    (assignment_expires_at set)                  │
│                              ↓                                  │
│              ┌───────────────┴───────────────┐                 │
│              ↓                               ↓                 │
│      Driver picks up              Timeout expires              │
│      within time limit            (no pickup)                  │
│              ↓                               ↓                 │
│        PICKED_UP                   Back to Pool                │
│              ↓                     (status = confirmed)        │
│        IN_TRANSIT                                              │
│              ↓                                                 │
│         DELIVERED                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Configuration

### Driver Configuration Settings

Stored in database, editable by admin.

```typescript
interface DriverConfig {
  // Assignment Timeout
  assignment_timeout_minutes: number;     // Default: 30
                                          // Time driver has to pick up after accepting

  // Driver Limits
  max_active_orders: number;              // Default: 2
                                          // Max concurrent orders per driver

  // Cancellation Policy
  max_cancellations_per_day: number;      // Default: 3
  cancellation_warning_threshold: number; // Default: 2
  auto_suspend_on_exceed: boolean;        // Default: false
                                          // Auto-suspend driver if exceeded

  // Assignment Mode
  allow_driver_self_assign: boolean;      // Default: true
                                          // false = admin-only assignment

  // Notifications
  notify_admin_on_timeout: boolean;       // Default: true
  notify_admin_on_cancellation: boolean;  // Default: true
}
```

### Default Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `assignment_timeout_minutes` | 30 | Minutes before unassigned order returns to pool |
| `max_active_orders` | 2 | Maximum concurrent orders per driver |
| `max_cancellations_per_day` | 3 | Daily cancellation limit |
| `cancellation_warning_threshold` | 2 | Show warning after this many cancellations |
| `auto_suspend_on_exceed` | false | Auto-suspend when limits exceeded |
| `allow_driver_self_assign` | true | Allow drivers to claim from pool |

---

## Data Models

### Order Model (Extended)

```typescript
interface Order {
  // Existing fields
  id: number;
  user_id: number;
  status: OrderStatus;
  shipping_address: string;
  contact_phone: string;
  total_amount: number;
  subtotal: number;
  items: OrderItem[];
  created_at: string;
  updated_at: string;

  // NEW: Driver-related fields
  driver_id: number | null;
  assigned_at: string | null;
  assignment_expires_at: string | null;
  picked_up_at: string | null;
  in_transit_at: string | null;
  delivered_at: string | null;

  // NEW: Cancellation tracking
  driver_cancelled_at: string | null;
  driver_cancel_reason: string | null;
  cancellation_count: number;  // Times this order was cancelled by drivers

  // NEW: Delivery info
  delivery_notes: string | null;
  customer_latitude: number | null;
  customer_longitude: number | null;
  customer_h3_index: string | null;
  estimated_delivery_minutes: number | null;
  actual_delivery_minutes: number | null;
}
```

### Driver Profile Model (Extended)

```typescript
interface DriverProfile {
  id: number;
  user_id: number;

  // Vehicle info
  vehicle_type: 'truck' | 'van' | 'mini_van';
  vehicle_plate: string | null;
  capacity_kg: number | null;
  capacity_volume: number | null;  // in liters

  // Availability
  is_available: boolean;          // Driver's toggle
  is_active: boolean;             // Admin's control (can suspend)
  is_flagged: boolean;            // Flagged for review
  flagged_at: string | null;
  flag_reason: string | null;

  // Statistics
  total_deliveries: number;
  total_earnings: number;
  total_distance_km: number;
  average_rating: number | null;

  // Cancellation tracking
  cancellations_today: number;
  total_cancellations: number;
  last_cancellation_at: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
  last_active_at: string | null;
}
```

### Driver Earnings Model

```typescript
interface DriverEarning {
  id: number;
  driver_id: number;
  order_id: number;

  // Earnings breakdown
  base_amount: number;
  distance_bonus: number;
  tip_amount: number;
  total_amount: number;

  // Status
  status: 'pending' | 'paid' | 'cancelled';
  paid_at: string | null;

  created_at: string;
}
```

### Driver Configuration Model

```typescript
interface DriverSystemConfig {
  id: number;

  assignment_timeout_minutes: number;
  max_active_orders: number;
  max_cancellations_per_day: number;
  cancellation_warning_threshold: number;
  auto_suspend_on_exceed: boolean;
  allow_driver_self_assign: boolean;
  notify_admin_on_timeout: boolean;
  notify_admin_on_cancellation: boolean;

  // Earnings config
  base_delivery_fee: number;
  price_per_km: number;

  updated_at: string;
  updated_by: number;
}
```

---

## API Endpoints

### Driver App Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/driver/profile` | Get driver's profile |
| `PATCH` | `/api/v1/driver/profile` | Update profile (vehicle, availability) |
| `GET` | `/api/v1/driver/trips/available` | List available orders in pool |
| `GET` | `/api/v1/driver/trips/active` | List driver's active orders |
| `GET` | `/api/v1/driver/trips/history` | List completed deliveries |
| `GET` | `/api/v1/driver/trips/{order_id}` | Get order details |
| `POST` | `/api/v1/driver/trips/{order_id}/accept` | Claim an order |
| `POST` | `/api/v1/driver/trips/{order_id}/pickup` | Mark as picked up |
| `POST` | `/api/v1/driver/trips/{order_id}/start-delivery` | Mark in transit |
| `POST` | `/api/v1/driver/trips/{order_id}/deliver` | Mark as delivered |
| `POST` | `/api/v1/driver/trips/{order_id}/cancel` | Cancel assignment |
| `GET` | `/api/v1/driver/stats` | Get earnings & stats summary |
| `GET` | `/api/v1/driver/earnings` | Get detailed earnings history |

### Admin Driver Management Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/admin/drivers` | List all drivers |
| `GET` | `/api/v1/admin/drivers/{id}` | Get driver details |
| `POST` | `/api/v1/admin/drivers/{id}/activate` | Activate driver |
| `POST` | `/api/v1/admin/drivers/{id}/suspend` | Suspend driver |
| `POST` | `/api/v1/admin/drivers/{id}/unflag` | Remove flag |
| `DELETE` | `/api/v1/admin/drivers/{id}` | Delete driver profile |
| `GET` | `/api/v1/admin/driver-config` | Get driver system config |
| `PATCH` | `/api/v1/admin/driver-config` | Update config |

### Admin Order Assignment Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/admin/orders/{id}/assign` | Assign order to driver |
| `POST` | `/api/v1/admin/orders/{id}/unassign` | Remove driver from order |
| `POST` | `/api/v1/admin/orders/{id}/reassign` | Reassign to different driver |

---

## Frontend Pages

### Driver App Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/driver` | `DriverDashboardComponent` | Available trips list |
| `/driver/active` | `ActiveTripsComponent` | Current active deliveries |
| `/driver/trip/:id` | `TripDetailComponent` | Order details + action buttons |
| `/driver/history` | `DeliveryHistoryComponent` | Past deliveries |
| `/driver/earnings` | `EarningsComponent` | Earnings summary & history |
| `/driver/profile` | `DriverProfileComponent` | Vehicle info, availability toggle |

### Driver Dashboard UI

```
┌─────────────────────────────────────────────┐
│  ┌─────┐                                    │
│  │ 🚚  │  Driver Name            [Online] 🟢│
│  └─────┘  3 deliveries today               │
├─────────────────────────────────────────────┤
│                                             │
│  Available Trips (3)                        │
│                                             │
│  ┌─────────────────────────────────────────┐│
│  │ 📦 Order #1234          350 DZD        ││
│  │ 📍 Ouadhia • 2.5 km • ~8 min           ││
│  │ 🛒 4 items                              ││
│  │                                         ││
│  │ [View Details]          [Accept Trip]   ││
│  └─────────────────────────────────────────┘│
│                                             │
│  ┌─────────────────────────────────────────┐│
│  │ 📦 Order #1235          520 DZD        ││
│  │ 📍 Tizi Centre • 4.2 km • ~12 min      ││
│  │ 🛒 7 items                              ││
│  │                                         ││
│  │ [View Details]          [Accept Trip]   ││
│  └─────────────────────────────────────────┘│
│                                             │
└─────────────────────────────────────────────┘
│  🏠     📦      📋      💰      👤         │
│ Home  Active  History Earnings Profile     │
└─────────────────────────────────────────────┘
```

### Trip Detail UI

```
┌─────────────────────────────────────────────┐
│  ← Back              Order #1234            │
├─────────────────────────────────────────────┤
│                                             │
│  Status: ASSIGNED                           │
│  ⏱️ Pick up within 28 minutes              │
│                                             │
├─────────────────────────────────────────────┤
│  📍 Pickup Location                         │
│  Warehouse Ouadhia                          │
│  [Open in Maps]                             │
├─────────────────────────────────────────────┤
│  📍 Delivery Location                       │
│  123 Rue Example, Tizi Ouzou               │
│  📞 0555 123 456                           │
│  [Open in Maps]  [Call Customer]           │
├─────────────────────────────────────────────┤
│  🛒 Items (4)                               │
│  • 2x Tomatoes (5kg)                       │
│  • 1x Potatoes (10kg)                      │
│  • 3x Oranges (3kg)                        │
│  • 1x Lettuce                              │
│                                             │
│  Total Weight: 18kg                         │
├─────────────────────────────────────────────┤
│  💰 Delivery Fee: 350 DZD                  │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────────┐│
│  │         [Confirm Pickup]                ││
│  └─────────────────────────────────────────┘│
│                                             │
│  [Cancel Trip]                              │
│                                             │
└─────────────────────────────────────────────┘
```

### Active Trip UI (In Transit)

```
┌─────────────────────────────────────────────┐
│  Active Delivery                            │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────────┐│
│  │                                         ││
│  │            [MAP VIEW]                   ││
│  │     Customer location pinned            ││
│  │                                         ││
│  └─────────────────────────────────────────┘│
│                                             │
│  📦 Order #1234                             │
│  📍 123 Rue Example, Tizi Ouzou            │
│  📞 0555 123 456           [Call]          │
│                                             │
│  ⏱️ ~5 min remaining                       │
│                                             │
│  ┌─────────────────────────────────────────┐│
│  │       [✓ Mark as Delivered]            ││
│  └─────────────────────────────────────────┘│
│                                             │
└─────────────────────────────────────────────┘
```

### Admin Driver Management Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/admin/drivers` | `AdminDriversListComponent` | List all drivers with filters |
| `/admin/drivers/:id` | `AdminDriverDetailComponent` | Driver detail + actions |
| `/admin/driver-config` | `AdminDriverConfigComponent` | System configuration |

---

## Background Jobs

### 1. Assignment Timeout Checker

**Frequency:** Every 5 minutes

```python
def check_assignment_timeouts():
    """
    Find orders where assignment has expired and return to pool.
    """
    expired_orders = Order.query.filter(
        Order.status == 'assigned',
        Order.assignment_expires_at < datetime.utcnow()
    ).all()

    for order in expired_orders:
        # Log the timeout
        log_driver_timeout(order)

        # Increment cancellation count
        order.cancellation_count += 1

        # Return to pool
        order.status = 'confirmed'
        order.driver_id = None
        order.assigned_at = None
        order.assignment_expires_at = None

        # Notify admin if configured
        if config.notify_admin_on_timeout:
            notify_admin_order_timeout(order)

    db.session.commit()
```

### 2. Daily Cancellation Reset

**Frequency:** Daily at midnight

```python
def reset_daily_cancellations():
    """
    Reset daily cancellation counters for all drivers.
    """
    DriverProfile.query.update({
        DriverProfile.cancellations_today: 0
    })
    db.session.commit()
```

### 3. Driver Activity Checker

**Frequency:** Every hour

```python
def check_driver_activity():
    """
    Flag inactive drivers or those with concerning patterns.
    """
    # Flag drivers with high cancellation rates
    flagged = DriverProfile.query.filter(
        DriverProfile.total_cancellations > threshold,
        DriverProfile.is_flagged == False
    ).all()

    for driver in flagged:
        driver.is_flagged = True
        driver.flagged_at = datetime.utcnow()
        driver.flag_reason = "High cancellation rate"

        notify_admin_driver_flagged(driver)
```

---

## Safeguards

### 1. Assignment Timeout

- **Configurable** timeout (default 30 minutes)
- Order automatically returns to pool if not picked up
- Driver's assignment is cleared
- Admin notified (if configured)

### 2. Admin Override

- Admin can reassign any order at any time
- Admin can unassign driver from order
- Admin can manually assign orders to specific drivers
- All actions logged for audit

### 3. Manual Assignment

- Admin can assign orders before drivers claim
- Useful for VIP customers or specific requirements
- Assigned order won't appear in available pool

### 4. Driver Limits

- Maximum concurrent active orders (default: 2)
- Driver cannot accept new orders if at limit
- Configurable per-system (not per-driver currently)

### 5. Cancellation Penalty

- Daily cancellation limit tracked
- Warning shown after threshold reached
- Optional auto-suspend when limit exceeded
- Driver flagged for admin review
- All cancellations logged with reasons

### 6. Driver Suspension

- Admin can suspend any driver
- Suspended drivers:
  - Cannot log into driver app
  - Current orders reassigned or returned to pool
  - Profile shows suspended status
- Admin can reactivate at any time

---

## Implementation Order

### Phase 1: Backend Foundation

1. Add `driver` role to User model
2. Extend Order model with driver fields
3. Create DriverProfile model extensions
4. Create DriverSystemConfig model
5. Create driver API endpoints
6. Create admin driver management endpoints
7. Implement background jobs

### Phase 2: Frontend Driver App

1. Add `driver` to USER_ROLES constant
2. Create `driverGuard`
3. Implement role-based layout switching in `app.component`
4. Create `DriverLayoutComponent`
5. Create driver pages:
   - Dashboard (available trips)
   - Active trips
   - Trip detail
   - History
   - Earnings
   - Profile

### Phase 3: Admin Extensions

1. Add driver management page
2. Add driver detail page
3. Add driver config settings page
4. Add assign/reassign UI to order detail
5. Add driver column to orders list

### Phase 4: Notifications & Polish

1. Push notifications for new orders
2. Real-time updates (WebSocket or polling)
3. Driver location tracking (optional)
4. Customer delivery tracking (optional)

---

## Future Enhancements

- **Driver ratings**: Customers rate drivers after delivery
- **Route optimization**: Suggest optimal order for multiple deliveries
- **Shift scheduling**: Drivers set availability schedules
- **Zone restrictions**: Limit drivers to specific delivery zones
- **Performance bonuses**: Automatic bonuses for high performers
- **In-app chat**: Driver-customer communication
- **Photo proof**: Require delivery photo confirmation

---

## Files to Create/Modify

### Backend

| File | Action | Description |
|------|--------|-------------|
| `app/models/user.py` | Modify | Add `driver` role |
| `app/models/order.py` | Modify | Add driver fields |
| `app/models/driver.py` | Create | Driver profile, config, earnings |
| `app/api/api_v1/endpoints/driver.py` | Create | Driver app endpoints |
| `app/api/api_v1/endpoints/admin_drivers.py` | Create | Admin driver management |
| `app/core/background_jobs.py` | Create | Timeout checker, etc. |

### Frontend

| File | Action | Description |
|------|--------|-------------|
| `src/app/core/constants/user.constants.ts` | Modify | Add `driver` role |
| `src/app/shared/guards/driver.guard.ts` | Create | Driver route guard |
| `src/app/app.component.ts` | Modify | Role-based layout switching |
| `src/app/driver/` | Create | Driver module with all pages |
| `src/app/pages/admin/admin-drivers/` | Create | Admin driver management |

---

## Code Style Requirements

### Angular Standards

1. **Control Flow**: Use Angular 20 syntax
   ```html
   <!-- DO -->
   @if (loading()) {
     <app-skeleton />
   } @else if (error()) {
     <app-error-state />
   } @else {
     <div>Content</div>
   }

   @for (trip of trips(); track trip.id) {
     <app-trip-card [trip]="trip" />
   } @empty {
     <app-empty-state />
   }

   <!-- DON'T -->
   *ngIf="loading"
   *ngFor="let trip of trips"
   ```

2. **Signals & Computed**: Use modern Angular reactivity
   ```typescript
   // DO
   loading = signal(false);
   trips = signal<Trip[]>([]);
   activeCount = computed(() => this.trips().filter(t => t.status === 'active').length);

   // DON'T
   loading: boolean = false;
   trips: Trip[] = [];
   ```

3. **Inject Pattern**: Use `inject()` not constructor injection
   ```typescript
   // DO
   private tripService = inject(TripService);
   private destroyRef = inject(DestroyRef);

   // DON'T
   constructor(private tripService: TripService) {}
   ```

### Loading States

Use skeleton loading from `_skeleton.scss`:

```html
@if (loading()) {
  <div class="trip-list">
    @for (_ of [1,2,3]; track $index) {
      <div class="trip-card trip-card--skeleton">
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text skeleton-text--short"></div>
        <div class="skeleton skeleton-button"></div>
      </div>
    }
  </div>
} @else {
  <!-- Actual content -->
}
```

### Empty & Error States

Use global states from `_states.scss`:

```html
@if (error()) {
  <div class="state state--error">
    <div class="state__icon">
      <i class="pi pi-exclamation-triangle"></i>
    </div>
    <h3 class="state__title">{{ 'common.error' | translate }}</h3>
    <p class="state__description">{{ error() }}</p>
    <button class="state__action" (click)="retry()">
      {{ 'common.retry' | translate }}
    </button>
  </div>
}

@if (trips().length === 0) {
  <div class="state state--empty">
    <div class="state__icon">
      <i class="pi pi-inbox"></i>
    </div>
    <h3 class="state__title">{{ 'driver.no_trips' | translate }}</h3>
    <p class="state__description">{{ 'driver.no_trips_desc' | translate }}</p>
  </div>
}
```

### BEM Naming Convention

Follow the pattern used in `/admin/products/add`:

```scss
// Block
.trip-card {
  // Element
  &__header { }
  &__body { }
  &__footer { }
  &__icon { }
  &__title { }
  &__meta { }
  &__actions { }

  // Modifier
  &--active { }
  &--completed { }
  &--skeleton { }
}

// Another block
.driver-stats {
  &__item { }
  &__label { }
  &__value { }

  &--highlight { }
}
```

### SCSS Organization

**Separation of Concerns:**

```
src/styles/
├── _variables.scss      # Design tokens (colors, spacing, etc.)
├── _skeleton.scss       # Skeleton loading utilities
├── _states.scss         # Empty/error state styles
├── _cards.scss          # Reusable card patterns
└── _buttons.scss        # Button variants

src/app/driver/
├── driver.component.scss           # Driver layout only
├── pages/
│   ├── dashboard/
│   │   └── dashboard.component.scss   # Dashboard-specific only
│   ├── trip-detail/
│   │   └── trip-detail.component.scss # Trip detail-specific only
```

**Component SCSS Rules:**

1. **Only component-specific styles** in component `.scss` files
2. **Reuse global patterns** from `src/styles/`
3. **No duplicate utility classes** - use existing ones
4. **Use CSS variables** for theming:
   ```scss
   // DO
   background: var(--surface-card);
   color: var(--text-color);
   border-radius: var(--radius-lg);
   padding: var(--space-4);

   // DON'T
   background: #ffffff;
   color: #333;
   border-radius: 12px;
   padding: 16px;
   ```

### Reusable Components

Create shared driver components:

```
src/app/driver/components/
├── trip-card/              # Reusable trip card
├── driver-header/          # Driver app header
├── status-badge/           # Order status badge
├── earnings-card/          # Earnings display
└── action-button/          # Primary action buttons
```

### File Structure

```
src/app/driver/
├── driver.routes.ts
├── driver.component.ts
├── driver.component.html
├── driver.component.scss
├── guards/
│   └── driver.guard.ts
├── services/
│   └── driver.service.ts       # Already exists
├── models/
│   └── driver.model.ts         # Already exists
├── components/
│   ├── trip-card/
│   ├── driver-header/
│   └── status-badge/
└── pages/
    ├── dashboard/
    ├── active-trips/
    ├── trip-detail/
    ├── history/
    ├── earnings/
    └── profile/
```

### No Hardcoded Values

All constants must be in constant files:

```typescript
// src/app/driver/constants/driver.constants.ts

export const DRIVER_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  BUSY: 'busy'
} as const;

export const TRIP_STATUS = {
  AVAILABLE: 'confirmed',
  ASSIGNED: 'assigned',
  PICKED_UP: 'picked_up',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled'
} as const;

export const DRIVER_LIMITS = {
  MAX_ACTIVE_ORDERS: 2,
  DEFAULT_TIMEOUT_MINUTES: 30,
  MAX_CANCELLATIONS_PER_DAY: 3
} as const;

export const DRIVER_ROUTES = {
  DASHBOARD: '/driver',
  ACTIVE: '/driver/active',
  TRIP_DETAIL: '/driver/trip',
  HISTORY: '/driver/history',
  EARNINGS: '/driver/earnings',
  PROFILE: '/driver/profile'
} as const;

export const DRIVER_ANIMATION = {
  STAGGER_DELAY: 50,
  FADE_DURATION: 200
} as const;
```

**Usage:**

```typescript
// DO
import { TRIP_STATUS, DRIVER_ROUTES } from '../../constants/driver.constants';

if (trip.status === TRIP_STATUS.ASSIGNED) { }
this.router.navigate([DRIVER_ROUTES.ACTIVE]);

// DON'T
if (trip.status === 'assigned') { }
this.router.navigate(['/driver/active']);
```

```html
<!-- DO -->
@if (trip.status === TRIP_STATUS.DELIVERED) {
  <span class="badge badge--success">{{ 'driver.delivered' | translate }}</span>
}

<!-- DON'T -->
@if (trip.status === 'delivered') {
  <span class="badge badge--success">Delivered</span>
}
```

**No hardcoded strings in templates:**

```html
<!-- DO -->
{{ 'driver.no_trips' | translate }}
{{ 'driver.accept_trip' | translate }}

<!-- DON'T -->
No trips available
Accept Trip
```

### TypeScript Standards

```typescript
@Component({
  selector: 'app-driver-dashboard',
  standalone: true,
  imports: [
    TranslateModule,
    TripCardComponent,
    SkeletonComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DriverDashboardComponent implements OnInit {
  // Services (inject pattern)
  private driverService = inject(DriverService);
  private destroyRef = inject(DestroyRef);

  // State (signals)
  loading = signal(true);
  error = signal<string | null>(null);
  trips = signal<Trip[]>([]);

  // Computed
  availableCount = computed(() =>
    this.trips().filter(t => t.status === 'confirmed').length
  );

  ngOnInit(): void {
    this.loadTrips();
  }

  private loadTrips(): void {
    this.loading.set(true);
    this.error.set(null);

    this.driverService.getAvailableTrips()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (trips) => {
          this.trips.set(trips);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err.message);
          this.loading.set(false);
        }
      });
  }

  // Public methods for template
  acceptTrip(tripId: number): void { }

  retry(): void {
    this.loadTrips();
  }
}
```

---

## Notes

- All times stored in UTC
- All monetary values in DZD (Algerian Dinar)
- Driver earnings calculated at delivery completion
- Cancellation reasons are required when driver cancels
