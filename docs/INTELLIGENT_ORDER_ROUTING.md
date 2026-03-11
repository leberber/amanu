# Intelligent Order Routing & Batching System

## Summary

A smart delivery routing system that optimizes order assignment based on vehicle capacity and geographic proximity, reducing shipping costs for customers while maximizing driver efficiency.

---

## How It Works

### For Large Orders (Full Truck Load)
When an order fills **≥80% of a vehicle's capacity**, it becomes a "Full Load" order:

1. **Capacity Check**: System identifies which vehicle types can handle the order
2. **Driver Filtering**: Order is only visible to drivers with sufficient vehicle capacity
3. **Driver Pickup**: Eligible drivers can see and accept the order
4. **Direct Assignment**: First driver to accept gets the exclusive assignment

```
Order: 900kg
  ↓
System checks vehicle capacities:
  - Mini Van (500kg)  → Cannot handle ❌
  - Van (800kg)       → Cannot handle ❌
  - Truck (1100kg)    → 82% capacity ✓
  ↓
Order sent to TRUCK drivers only
  ↓
Driver accepts → Direct Assignment (1 order, 1 driver)
```

### For Small Orders (Batchable)
Small orders (< 80% of any vehicle capacity) are grouped with other orders going to the **same area** (max 3 stops per trip).

```
Order A: 100kg (Zone 5) ─┐
Order B: 150kg (Zone 5) ─┼─→ Batched Trip → 1 Driver, 3 Stops
Order C: 80kg  (Zone 5) ─┘
```

### Customer Delivery Options

| Option | Description | Pricing |
|--------|-------------|---------|
| **Priority** | Immediate dedicated delivery | Full shipping cost |
| **Standard** | Wait to batch with other orders | Discounted (shared cost) |

---

## Implementation Phases

### Phase 1: Foundation (Backend)
**Capacity Validation & Trip Model**

1. Add `delivery_type` to Order model (STANDARD, PRIORITY)
2. Add `is_full_load` flag to Order model
3. Create Trip & TripStop models for batch management
4. Add capacity validation before driver assignment
5. Filter available orders by driver's vehicle capacity
6. Implement driver order pickup endpoint

**Files:**
- `backend/app/models/order.py` - Add delivery_type, trip_id, is_full_load
- `backend/app/models/trip.py` - NEW: Trip, TripStop models
- `backend/app/api/api_v1/endpoints/driver_admin.py` - Capacity check
- `backend/app/api/api_v1/endpoints/drivers.py` - Available orders endpoint, pickup endpoint

---

### Phase 2: Batching Algorithm (Backend)
**Geographic Clustering Service**

1. Cluster pending STANDARD orders by H3 zone
2. Calculate combined weight/volume per cluster
3. Match cluster to driver with sufficient capacity
4. Create Trip with optimized stop sequence (max 3 stops)

**Files:**
- `backend/app/services/batching_service.py` - NEW: Clustering logic
- `backend/app/api/api_v1/endpoints/admin_batching.py` - NEW: Manual trigger API

---

### Phase 3: Checkout Options (Frontend + Backend)
**Priority Delivery Selection**

1. Show delivery type choice at checkout
2. Display both pricing options
3. Pass delivery_type to order creation

**Files:**
- `frontend/src/app/pages/checkout/checkout.component.ts`
- `frontend/src/app/pages/checkout/checkout.component.html`
- `backend/app/api/api_v1/endpoints/shipping.py` - Return both prices

---

### Phase 4: Driver Multi-Stop UI (Frontend)
**Trip Management Interface**

1. Show trip with all stops and sequence
2. Navigate to each stop
3. Mark individual stops as delivered
4. Complete trip when all stops done

**Files:**
- `frontend/src/app/models/trip.model.ts` - NEW: Trip interfaces
- `frontend/src/app/driver/pages/trip-detail/` - Multi-stop support
- `frontend/src/app/services/driver.service.ts` - Trip API methods

---

## Data Models

### Trip
```python
class Trip:
    id: int
    driver_id: int
    status: TripStatus  # PENDING, IN_PROGRESS, COMPLETED
    total_weight_kg: float
    total_volume_m3: float
    estimated_distance_km: float
    stops: List[TripStop]
```

### TripStop
```python
class TripStop:
    id: int
    trip_id: int
    order_id: int
    sequence: int      # 1, 2, 3
    status: StopStatus # PENDING, ARRIVED, DELIVERED
    estimated_arrival: datetime
```

### Order (Updated)
```python
class Order:
    # ... existing fields ...
    delivery_type: DeliveryType  # STANDARD, PRIORITY
    is_full_load: bool           # True if order ≥80% of a vehicle capacity
    min_vehicle_capacity_kg: Optional[float]  # Minimum vehicle capacity needed
    trip_id: Optional[int]       # FK to Trip (if batched)
```

---

## Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| Full load threshold | 80% | Orders ≥80% capacity = full load |
| Max stops per trip | 3 | Maximum orders in one batch |
| Batching trigger | Manual | Admin triggers via button/API |
| Priority price | Full cost | Current shipping calculation |
| Standard price | Discounted | Cost shared between batched orders |

---

## Full Load Detection Logic

When an order is created, the system determines if it's a "Full Load":

```python
# Vehicle capacities (from driver_vehicles table)
VEHICLE_CAPACITIES = {
    "mini_van": 500,   # kg
    "van": 800,        # kg
    "truck": 1100,     # kg
}

def check_full_load(order_weight_kg: float) -> tuple[bool, float]:
    """
    Check if order is a full load and what capacity is needed.
    Returns (is_full_load, min_capacity_needed)
    """
    for vehicle_type, capacity in sorted(VEHICLE_CAPACITIES.items(), key=lambda x: x[1]):
        if order_weight_kg <= capacity:
            # Order fits in this vehicle
            load_percentage = (order_weight_kg / capacity) * 100
            if load_percentage >= 80:
                # Full load - needs at least this vehicle
                return True, capacity
            else:
                # Not a full load - can be batched
                return False, None

    # Order exceeds all vehicles - needs truck (largest)
    return True, max(VEHICLE_CAPACITIES.values())
```

### Examples:
| Order Weight | Smallest Fit | Load % | Result |
|--------------|--------------|--------|--------|
| 100kg | Mini Van (500kg) | 20% | Batchable |
| 450kg | Mini Van (500kg) | 90% | Full Load (min: Mini Van) |
| 600kg | Van (800kg) | 75% | Batchable |
| 700kg | Van (800kg) | 87.5% | Full Load (min: Van) |
| 900kg | Truck (1100kg) | 82% | Full Load (min: Truck) |

---

## API Endpoints

### New Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/driver/available-orders` | Get orders available for driver (filtered by vehicle capacity) |
| POST | `/api/v1/driver/orders/{id}/pickup` | Driver accepts/picks up an order |
| POST | `/api/v1/admin/batching/run` | Trigger batching algorithm |
| GET | `/api/v1/admin/batching/preview` | Preview batch groupings |
| GET | `/api/v1/trips/{id}` | Get trip with all stops |
| PUT | `/api/v1/trips/{id}/stops/{stop_id}` | Update stop status |

### Modified Endpoints
| Method | Path | Change |
|--------|------|--------|
| POST | `/api/v1/shipping/calculate` | Return standard & priority prices |
| POST | `/api/v1/orders` | Accept delivery_type field |
| POST | `/api/v1/admin/orders/{id}/assign` | Validate vehicle capacity |

---

## User Flows

### Customer Checkout
```
1. Add items to cart
2. Go to checkout
3. See delivery options:
   ┌─────────────────────────────────────┐
   │ ○ Standard Delivery     350 DA     │
   │   May be grouped with nearby orders │
   │                                     │
   │ ● Priority Delivery     500 DA     │
   │   Dedicated immediate delivery      │
   └─────────────────────────────────────┘
4. Complete order
```

### Admin Batching
```
1. View pending STANDARD orders
2. Click "Run Batching"
3. Preview grouped trips
4. Confirm → Trips created
5. Assign trips to drivers
```

### Driver - Full Load Order
```
1. Driver sees available orders (filtered by vehicle capacity)
2. Full Load orders show:
   ┌─────────────────────────────────────┐
   │ 🚛 FULL LOAD                        │
   │ Order #1234 - 900kg                 │
   │ Customer: Ahmed                     │
   │ Zone: Bab Ezzouar                   │
   │ Earnings: 1,500 DA                  │
   │                                     │
   │ [Accept Order]                      │
   └─────────────────────────────────────┘
3. Driver accepts → Order assigned exclusively
4. Navigate to customer
5. Mark delivered → Complete
```

### Driver - Batched Trip (Multiple Stops)
```
1. Driver sees available trips
2. Accept trip (shows all stops)
3. See optimized route:
   Stop 1: Ahmed - Zone 5
   Stop 2: Fatima - Zone 5
   Stop 3: Karim - Zone 5
4. Navigate to Stop 1
5. Mark delivered → Move to Stop 2
6. Complete all stops → Trip done
```

---

## Verification Checklist

### Full Load Orders (≥80% capacity)
- [ ] System identifies order as "Full Load" when ≥80% of vehicle capacity
- [ ] Order is only visible to drivers with sufficient vehicle capacity
- [ ] Drivers with smaller vehicles cannot see the order
- [ ] Driver can accept/pickup the order
- [ ] Once accepted, order is assigned exclusively to that driver
- [ ] Other drivers no longer see the order

### Small Orders (Batchable)
- [ ] Small order → Can be batched
- [ ] Checkout shows both delivery options (Standard/Priority)
- [ ] Priority order → Not batched, immediate delivery
- [ ] Standard orders in same zone → Grouped into trip
- [ ] Trip has max 3 stops
- [ ] Driver sees all stops with sequence
- [ ] Each stop can be marked delivered
- [ ] Trip completes when all stops done
