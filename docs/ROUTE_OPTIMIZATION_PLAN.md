# Route-Based Delivery Optimization

## Overview

This document outlines the implementation plan for a smart delivery batching system that uses **actual road routes** instead of simple geographic proximity (H3 hexagons).

### Current Approach (Limited)
- H3 hexagonal clustering groups by area
- Doesn't consider actual roads
- Arbitrary batch limits (max 3 orders)
- No vehicle capacity consideration

### New Approach (Route Corridors)
- One-time fetch of driving routes from Google
- Store route data permanently
- Group customers by shared road corridors
- Respect driver vehicle capacity
- Optimal stop ordering by distance from depot

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FLOW DIAGRAM                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ONE-TIME     ┌──────────────────────────┐ │
│  │ Google Maps  │ ──────────────► │  customer_routes table   │ │
│  │ Directions   │   (~$1 total)   │  (polyline, distance,    │ │
│  │ API          │                 │   corridor, points)      │ │
│  └──────────────┘                 └──────────────────────────┘ │
│                                              │                  │
│                                              ▼                  │
│  ┌──────────────┐    DAILY        ┌──────────────────────────┐ │
│  │ Pending      │ ──────────────► │  Batching Algorithm      │ │
│  │ Orders       │   (FREE)        │  - Group by corridor     │ │
│  │              │                 │  - Sort by distance      │ │
│  └──────────────┘                 │  - Respect capacity      │ │
│                                   └──────────────────────────┘ │
│                                              │                  │
│                                              ▼                  │
│                                   ┌──────────────────────────┐ │
│                                   │  Optimized Trips         │ │
│                                   │  - Trip 1: A→B→C (15km)  │ │
│                                   │  - Trip 2: D→E (12km)    │ │
│                                   └──────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### New Tables

```sql
-- ============================================================
-- Table 1: Main delivery corridors (roads from depot)
-- ============================================================
CREATE TABLE delivery_corridors (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,     -- "N1_SOUTH", "N5_EAST", "ALGER_CENTER"
    name VARCHAR(100) NOT NULL,            -- "Route Nationale 1 - Blida"
    description TEXT,

    -- Corridor path (main road)
    path_polyline TEXT,                    -- Encoded polyline of main road
    path_points JSONB,                     -- Decoded points with distances

    -- Boundaries (for auto-detection)
    heading_min INTEGER,                   -- Min heading from depot (0-360)
    heading_max INTEGER,                   -- Max heading from depot

    -- Stats
    total_customers INTEGER DEFAULT 0,
    avg_distance_meters INTEGER,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Table 2: Customer route data (one row per customer)
-- ============================================================
CREATE TABLE customer_routes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Assigned corridor
    corridor_id INTEGER REFERENCES delivery_corridors(id),

    -- Google Directions data (stored once)
    route_polyline TEXT NOT NULL,          -- Encoded path from depot to customer
    route_distance_meters INTEGER NOT NULL,
    route_duration_seconds INTEGER NOT NULL,

    -- Decoded path with distances (for corridor matching)
    route_points JSONB,                    -- [{lat, lng, distance_from_depot}, ...]

    -- Quick access fields
    distance_from_depot_km DECIMAL(10,2) GENERATED ALWAYS AS (route_distance_meters / 1000.0) STORED,
    duration_from_depot_min DECIMAL(10,2) GENERATED ALWAYS AS (route_duration_seconds / 60.0) STORED,

    -- For corridor matching
    initial_heading INTEGER,               -- Direction from depot (0-360 degrees)
    perpendicular_distance_meters INTEGER, -- How far off the main corridor road

    -- Metadata
    fetched_at TIMESTAMP DEFAULT NOW(),
    last_verified_at TIMESTAMP,
    needs_refresh BOOLEAN DEFAULT FALSE,   -- Flag if customer moved

    CONSTRAINT valid_distance CHECK (route_distance_meters > 0)
);

-- Indexes for fast queries
CREATE INDEX idx_customer_routes_corridor ON customer_routes(corridor_id);
CREATE INDEX idx_customer_routes_distance ON customer_routes(route_distance_meters);
CREATE INDEX idx_customer_routes_user ON customer_routes(user_id);

-- ============================================================
-- Table 3: Route cache for customer-to-customer segments (optional)
-- ============================================================
CREATE TABLE route_segments (
    id SERIAL PRIMARY KEY,
    from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    segment_polyline TEXT,
    segment_distance_meters INTEGER NOT NULL,
    segment_duration_seconds INTEGER NOT NULL,

    fetched_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(from_user_id, to_user_id)
);

CREATE INDEX idx_route_segments_from ON route_segments(from_user_id);
```

### Modifications to Existing Tables

```sql
-- Add vehicle capacity to driver profiles
ALTER TABLE driver_profiles
ADD COLUMN vehicle_capacity_kg DECIMAL(10,2) DEFAULT 500.0,
ADD COLUMN vehicle_type VARCHAR(50) DEFAULT 'van';

-- Add route status to users table
ALTER TABLE users
ADD COLUMN route_calculated BOOLEAN DEFAULT FALSE,
ADD COLUMN route_calculation_error TEXT;
```

---

## Implementation Phases

### Phase 1: Database Setup
**Duration: 1 day**

1. Create migration files for new tables
2. Add vehicle_capacity_kg to driver_profiles
3. Create indexes
4. Test schema

**Files to create/modify:**
```
backend/
├── alembic/versions/
│   └── xxx_add_route_optimization_tables.py
├── app/models/
│   ├── delivery_corridor.py (NEW)
│   └── customer_route.py (NEW)
```

---

### Phase 2: Google Routes Fetcher Service
**Duration: 2 days**

Create a service to fetch and store routes from Google Directions API.

**File: `backend/app/services/route_fetcher_service.py`**

```python
import googlemaps
import polyline
from math import atan2, degrees
from typing import List, Dict, Optional
from sqlmodel import Session

from app.models.customer_route import CustomerRoute
from app.models.user import User
from app.core.config import settings

class RouteFetcherService:
    """Service to fetch and store driving routes from Google Maps API"""

    DEPOT_LOCATION = (36.7538, 3.0588)  # Warehouse coordinates

    def __init__(self, db: Session):
        self.db = db
        self.gmaps = googlemaps.Client(key=settings.GOOGLE_MAPS_API_KEY)

    def fetch_route_for_customer(self, user_id: int) -> Optional[CustomerRoute]:
        """Fetch and store route for a single customer"""
        user = self.db.get(User, user_id)
        if not user or not user.latitude or not user.longitude:
            return None

        # Check if already fetched
        existing = self.db.query(CustomerRoute).filter_by(user_id=user_id).first()
        if existing and not existing.needs_refresh:
            return existing

        # Fetch from Google
        try:
            result = self.gmaps.directions(
                origin=self.DEPOT_LOCATION,
                destination=(user.latitude, user.longitude),
                mode="driving",
                language="fr",
                region="dz"
            )

            if not result:
                return None

            route_data = result[0]
            leg = route_data['legs'][0]
            overview_polyline = route_data['overview_polyline']['points']

            # Decode polyline to points
            decoded_points = polyline.decode(overview_polyline)
            points_with_distance = self._calculate_distances_along_path(decoded_points)

            # Calculate initial heading (direction from depot)
            initial_heading = self._calculate_heading(
                self.DEPOT_LOCATION,
                decoded_points[1] if len(decoded_points) > 1 else decoded_points[0]
            )

            # Create or update route record
            if existing:
                existing.route_polyline = overview_polyline
                existing.route_distance_meters = leg['distance']['value']
                existing.route_duration_seconds = leg['duration']['value']
                existing.route_points = points_with_distance
                existing.initial_heading = initial_heading
                existing.needs_refresh = False
                existing.fetched_at = datetime.utcnow()
                route = existing
            else:
                route = CustomerRoute(
                    user_id=user_id,
                    route_polyline=overview_polyline,
                    route_distance_meters=leg['distance']['value'],
                    route_duration_seconds=leg['duration']['value'],
                    route_points=points_with_distance,
                    initial_heading=initial_heading
                )
                self.db.add(route)

            self.db.commit()
            return route

        except Exception as e:
            user.route_calculation_error = str(e)
            self.db.commit()
            return None

    def fetch_routes_for_all_customers(self, batch_size: int = 50) -> Dict:
        """Fetch routes for all customers without routes"""
        customers = self.db.query(User).filter(
            User.role == 'customer',
            User.latitude.isnot(None),
            User.longitude.isnot(None),
            User.route_calculated == False
        ).limit(batch_size).all()

        results = {"success": 0, "failed": 0, "skipped": 0}

        for customer in customers:
            route = self.fetch_route_for_customer(customer.id)
            if route:
                customer.route_calculated = True
                results["success"] += 1
            else:
                results["failed"] += 1

        self.db.commit()
        return results

    def _calculate_distances_along_path(self, points: List[tuple]) -> List[Dict]:
        """Calculate cumulative distance for each point along path"""
        result = []
        cumulative_distance = 0

        for i, point in enumerate(points):
            if i > 0:
                cumulative_distance += self._haversine_distance(points[i-1], point)

            result.append({
                "lat": point[0],
                "lng": point[1],
                "distance_from_depot": round(cumulative_distance)
            })

        return result

    def _calculate_heading(self, from_point: tuple, to_point: tuple) -> int:
        """Calculate compass heading from one point to another"""
        lat1, lon1 = from_point
        lat2, lon2 = to_point

        dlon = lon2 - lon1
        x = cos(radians(lat2)) * sin(radians(dlon))
        y = cos(radians(lat1)) * sin(radians(lat2)) - \
            sin(radians(lat1)) * cos(radians(lat2)) * cos(radians(dlon))

        heading = degrees(atan2(x, y))
        return int((heading + 360) % 360)

    def _haversine_distance(self, point1: tuple, point2: tuple) -> float:
        """Calculate distance between two points in meters"""
        from math import radians, cos, sin, sqrt, atan2

        R = 6371000  # Earth's radius in meters
        lat1, lon1 = radians(point1[0]), radians(point1[1])
        lat2, lon2 = radians(point2[0]), radians(point2[1])

        dlat = lat2 - lat1
        dlon = lon2 - lon1

        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))

        return R * c
```

---

### Phase 3: Corridor Detection Service
**Duration: 1 day**

Automatically assign customers to delivery corridors based on their route.

**File: `backend/app/services/corridor_service.py`**

```python
class CorridorService:
    """Service to manage delivery corridors and assign customers"""

    # Pre-defined corridors (can be configured in DB later)
    DEFAULT_CORRIDORS = [
        {"code": "SOUTH_BLIDA", "name": "Sud - Blida", "heading_min": 160, "heading_max": 200},
        {"code": "WEST_CHERAGA", "name": "Ouest - Cheraga", "heading_min": 250, "heading_max": 290},
        {"code": "EAST_ROUIBA", "name": "Est - Rouiba", "heading_min": 70, "heading_max": 110},
        {"code": "CENTER_ALGER", "name": "Centre - Alger", "heading_min": 0, "heading_max": 360},  # Fallback
    ]

    def __init__(self, db: Session):
        self.db = db

    def assign_corridor_to_customer(self, customer_route: CustomerRoute) -> None:
        """Assign a corridor based on initial heading from depot"""
        heading = customer_route.initial_heading

        for corridor in self.db.query(DeliveryCorridor).all():
            if corridor.heading_min <= heading <= corridor.heading_max:
                customer_route.corridor_id = corridor.id
                break

        # Fallback to CENTER if no match
        if not customer_route.corridor_id:
            center = self.db.query(DeliveryCorridor).filter_by(code="CENTER_ALGER").first()
            if center:
                customer_route.corridor_id = center.id

        self.db.commit()

    def get_customers_in_corridor(self, corridor_id: int) -> List[CustomerRoute]:
        """Get all customers in a corridor, ordered by distance"""
        return self.db.query(CustomerRoute) \
            .filter_by(corridor_id=corridor_id) \
            .order_by(CustomerRoute.route_distance_meters) \
            .all()
```

---

### Phase 4: Smart Batching Service
**Duration: 2 days**

The main batching algorithm that creates optimized trips.

**File: `backend/app/services/smart_batching_service.py`**

```python
from typing import List, Dict, Optional
from dataclasses import dataclass
from sqlmodel import Session

@dataclass
class BatchedTrip:
    corridor_id: int
    corridor_name: str
    driver_id: Optional[int]
    orders: List[Dict]  # Ordered by distance from depot
    total_weight_kg: float
    total_distance_meters: int
    estimated_duration_seconds: int
    route_polyline: str  # Combined route for display

class SmartBatchingService:
    """Service to create optimized delivery batches"""

    def __init__(self, db: Session):
        self.db = db

    def create_optimized_batches(
        self,
        pending_order_ids: List[int],
        driver_capacities: Optional[Dict[int, float]] = None  # {driver_id: capacity_kg}
    ) -> List[BatchedTrip]:
        """
        Create optimized batches from pending orders.

        Algorithm:
        1. Get routes for all orders
        2. Group by corridor
        3. Sort by distance within corridor
        4. Fill batches respecting capacity
        """

        # Get orders with their route data
        orders_with_routes = self._get_orders_with_routes(pending_order_ids)

        # Group by corridor
        corridors = self._group_by_corridor(orders_with_routes)

        # Get available driver capacities
        if not driver_capacities:
            driver_capacities = self._get_available_driver_capacities()

        # Create batches for each corridor
        batches = []
        available_capacities = list(driver_capacities.values())

        for corridor_id, orders in corridors.items():
            corridor_batches = self._create_batches_for_corridor(
                corridor_id,
                orders,
                available_capacities
            )
            batches.extend(corridor_batches)

        return batches

    def _get_orders_with_routes(self, order_ids: List[int]) -> List[Dict]:
        """Fetch orders with their customer route data"""
        results = self.db.execute("""
            SELECT
                o.id as order_id,
                o.user_id,
                o.total_weight_kg,
                o.shipping_address,
                u.full_name as customer_name,
                u.phone as customer_phone,
                cr.corridor_id,
                cr.route_distance_meters,
                cr.route_duration_seconds,
                cr.route_polyline,
                dc.name as corridor_name
            FROM orders o
            JOIN users u ON o.user_id = u.id
            LEFT JOIN customer_routes cr ON cr.user_id = o.user_id
            LEFT JOIN delivery_corridors dc ON dc.id = cr.corridor_id
            WHERE o.id IN :order_ids
            ORDER BY cr.route_distance_meters
        """, {"order_ids": tuple(order_ids)}).fetchall()

        return [dict(r) for r in results]

    def _group_by_corridor(self, orders: List[Dict]) -> Dict[int, List[Dict]]:
        """Group orders by their corridor"""
        corridors = defaultdict(list)
        for order in orders:
            corridor_id = order.get('corridor_id') or 0  # 0 = unassigned
            corridors[corridor_id].append(order)

        # Sort each corridor's orders by distance
        for corridor_id in corridors:
            corridors[corridor_id].sort(key=lambda x: x.get('route_distance_meters', 0))

        return corridors

    def _create_batches_for_corridor(
        self,
        corridor_id: int,
        orders: List[Dict],
        capacities: List[float]
    ) -> List[BatchedTrip]:
        """Create batches for a single corridor"""

        if not orders:
            return []

        corridor = self.db.get(DeliveryCorridor, corridor_id)
        batches = []

        current_batch = []
        current_weight = 0.0
        current_capacity = capacities[0] if capacities else 500.0  # Default capacity

        for order in orders:
            order_weight = order.get('total_weight_kg', 0) or 0

            # Check if order fits in current batch
            if current_weight + order_weight > current_capacity:
                # Save current batch
                if current_batch:
                    batches.append(self._create_trip(corridor, current_batch))

                # Start new batch
                current_batch = []
                current_weight = 0.0

            current_batch.append(order)
            current_weight += order_weight

        # Don't forget last batch
        if current_batch:
            batches.append(self._create_trip(corridor, current_batch))

        return batches

    def _create_trip(self, corridor: DeliveryCorridor, orders: List[Dict]) -> BatchedTrip:
        """Create a BatchedTrip from orders"""
        total_weight = sum(o.get('total_weight_kg', 0) or 0 for o in orders)
        max_distance = max(o.get('route_distance_meters', 0) for o in orders)
        total_duration = sum(o.get('route_duration_seconds', 0) or 0 for o in orders)

        # Use the last order's polyline (covers full route)
        route_polyline = orders[-1].get('route_polyline', '') if orders else ''

        return BatchedTrip(
            corridor_id=corridor.id if corridor else 0,
            corridor_name=corridor.name if corridor else "Non assigné",
            driver_id=None,
            orders=orders,
            total_weight_kg=total_weight,
            total_distance_meters=max_distance,
            estimated_duration_seconds=total_duration,
            route_polyline=route_polyline
        )

    def _get_available_driver_capacities(self) -> Dict[int, float]:
        """Get capacity for all available drivers"""
        drivers = self.db.execute("""
            SELECT dp.user_id, dp.vehicle_capacity_kg
            FROM driver_profiles dp
            JOIN users u ON u.id = dp.user_id
            WHERE u.is_active = true
        """).fetchall()

        return {d.user_id: d.vehicle_capacity_kg for d in drivers}
```

---

### Phase 5: API Endpoints
**Duration: 1 day**

**File: `backend/app/api/api_v1/endpoints/route_optimization.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session

from app.database import get_session
from app.services.route_fetcher_service import RouteFetcherService
from app.services.smart_batching_service import SmartBatchingService
from app.core.auth import get_current_admin_user

router = APIRouter()

@router.post("/fetch-routes")
async def fetch_customer_routes(
    background_tasks: BackgroundTasks,
    batch_size: int = 50,
    db: Session = Depends(get_session),
    admin = Depends(get_current_admin_user)
):
    """Fetch routes for customers (runs in background)"""
    service = RouteFetcherService(db)

    # Run in background for large batches
    background_tasks.add_task(service.fetch_routes_for_all_customers, batch_size)

    return {"message": f"Route fetching started for up to {batch_size} customers"}

@router.get("/fetch-routes/status")
async def get_route_fetch_status(
    db: Session = Depends(get_session),
    admin = Depends(get_current_admin_user)
):
    """Get status of route fetching"""
    total_customers = db.execute(
        "SELECT COUNT(*) FROM users WHERE role = 'customer'"
    ).scalar()

    with_routes = db.execute(
        "SELECT COUNT(*) FROM customer_routes"
    ).scalar()

    pending = db.execute(
        "SELECT COUNT(*) FROM users WHERE role = 'customer' AND route_calculated = false"
    ).scalar()

    return {
        "total_customers": total_customers,
        "with_routes": with_routes,
        "pending": pending,
        "progress_percent": round((with_routes / total_customers) * 100, 1) if total_customers > 0 else 0
    }

@router.post("/optimize")
async def create_optimized_batches(
    order_ids: List[int] = None,  # If None, use all pending
    db: Session = Depends(get_session),
    admin = Depends(get_current_admin_user)
):
    """Create optimized delivery batches"""

    # Get pending orders if not specified
    if not order_ids:
        order_ids = [r[0] for r in db.execute(
            "SELECT id FROM orders WHERE status = 'processing' AND delivery_method = 'delivery'"
        ).fetchall()]

    if not order_ids:
        raise HTTPException(status_code=400, detail="No pending orders to batch")

    service = SmartBatchingService(db)
    batches = service.create_optimized_batches(order_ids)

    return {
        "batches": [
            {
                "corridor": b.corridor_name,
                "orders": len(b.orders),
                "total_weight_kg": b.total_weight_kg,
                "total_distance_km": round(b.total_distance_meters / 1000, 1),
                "estimated_duration_min": round(b.estimated_duration_seconds / 60),
                "order_details": [
                    {
                        "order_id": o["order_id"],
                        "customer": o["customer_name"],
                        "address": o["shipping_address"],
                        "distance_km": round(o["route_distance_meters"] / 1000, 1)
                    }
                    for o in b.orders
                ],
                "route_polyline": b.route_polyline
            }
            for b in batches
        ],
        "summary": {
            "total_batches": len(batches),
            "total_orders": sum(len(b.orders) for b in batches),
            "total_weight_kg": sum(b.total_weight_kg for b in batches)
        }
    }

@router.get("/corridors")
async def get_corridors(
    db: Session = Depends(get_session),
    admin = Depends(get_current_admin_user)
):
    """Get all delivery corridors with stats"""
    corridors = db.execute("""
        SELECT
            dc.*,
            COUNT(cr.id) as customer_count,
            AVG(cr.route_distance_meters) as avg_distance
        FROM delivery_corridors dc
        LEFT JOIN customer_routes cr ON cr.corridor_id = dc.id
        GROUP BY dc.id
        ORDER BY dc.name
    """).fetchall()

    return [dict(c) for c in corridors]

@router.get("/customer/{user_id}/route")
async def get_customer_route(
    user_id: int,
    db: Session = Depends(get_session),
    admin = Depends(get_current_admin_user)
):
    """Get stored route for a customer"""
    route = db.query(CustomerRoute).filter_by(user_id=user_id).first()

    if not route:
        raise HTTPException(status_code=404, detail="Route not found for customer")

    return {
        "user_id": route.user_id,
        "corridor_id": route.corridor_id,
        "distance_km": route.distance_from_depot_km,
        "duration_min": route.duration_from_depot_min,
        "polyline": route.route_polyline,
        "points": route.route_points,
        "fetched_at": route.fetched_at
    }
```

---

### Phase 6: One-Time Migration Script
**Duration: 1 day**

Script to populate routes for all existing customers.

**File: `backend/scripts/populate_customer_routes.py`**

```python
#!/usr/bin/env python3
"""
One-time script to fetch and store routes for all existing customers.

Usage:
    python scripts/populate_customer_routes.py --batch-size 50 --delay 1

Cost estimate:
    - 200 customers = ~$1.00 (Google Directions API)
    - 1000 customers = ~$5.00
"""

import argparse
import time
from sqlmodel import Session

from app.database import engine
from app.services.route_fetcher_service import RouteFetcherService
from app.services.corridor_service import CorridorService

def main():
    parser = argparse.ArgumentParser(description='Populate customer routes from Google API')
    parser.add_argument('--batch-size', type=int, default=50, help='Customers per batch')
    parser.add_argument('--delay', type=float, default=1.0, help='Delay between batches (seconds)')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done')
    args = parser.parse_args()

    with Session(engine) as db:
        # Count customers needing routes
        pending_count = db.execute("""
            SELECT COUNT(*) FROM users
            WHERE role = 'customer'
            AND latitude IS NOT NULL
            AND route_calculated = false
        """).scalar()

        print(f"Customers needing routes: {pending_count}")
        print(f"Estimated API cost: ${pending_count * 0.005:.2f}")
        print(f"Batches: {(pending_count // args.batch_size) + 1}")

        if args.dry_run:
            print("Dry run - no changes made")
            return

        input("Press Enter to continue...")

        route_service = RouteFetcherService(db)
        corridor_service = CorridorService(db)

        total_processed = 0
        batch_num = 0

        while True:
            batch_num += 1
            print(f"\nBatch {batch_num}...")

            results = route_service.fetch_routes_for_all_customers(args.batch_size)

            if results["success"] == 0 and results["failed"] == 0:
                print("No more customers to process")
                break

            total_processed += results["success"]
            print(f"  Success: {results['success']}, Failed: {results['failed']}")
            print(f"  Total processed: {total_processed}/{pending_count}")

            # Assign corridors
            new_routes = db.query(CustomerRoute).filter(
                CustomerRoute.corridor_id.is_(None)
            ).all()

            for route in new_routes:
                corridor_service.assign_corridor_to_customer(route)

            print(f"  Assigned {len(new_routes)} customers to corridors")

            time.sleep(args.delay)

        print(f"\nDone! Processed {total_processed} customers")

if __name__ == "__main__":
    main()
```

---

### Phase 7: Frontend Updates
**Duration: 2 days**

Update the batching UI to display route-based batches.

**Changes needed:**

1. **Display corridors on map** with different colors
2. **Show route lines** (decode polyline) for each batch
3. **Update batch creation** to use new API
4. **Add route fetch status** indicator

**Key frontend files:**
```
frontend/src/app/
├── services/
│   └── batching.service.ts      # Add new API calls
├── pages/admin/admin-batching/
│   ├── admin-batching.component.ts    # Update to use corridors
│   └── admin-batching.component.html  # Display routes
└── models/
    └── trip.model.ts            # Add corridor and route fields
```

---

## Cost Summary

| Item | One-time Cost | Monthly Cost |
|------|--------------|--------------|
| Initial route fetch (200 customers) | ~$1.00 | - |
| New customer routes (~20/month) | - | ~$0.10 |
| Google OR-Tools | Free | Free |
| Database storage | Negligible | Negligible |
| **Total** | **~$1.00** | **~$0.10** |

---

## Configuration

Add to `backend/app/core/config.py`:

```python
class Settings(BaseSettings):
    # ... existing settings ...

    # Google Maps
    GOOGLE_MAPS_API_KEY: str = ""

    # Depot location
    DEPOT_LATITUDE: float = 36.7538
    DEPOT_LONGITUDE: float = 3.0588

    # Batching defaults
    DEFAULT_VEHICLE_CAPACITY_KG: float = 500.0
    MAX_ORDERS_PER_TRIP: int = 20
```

Add to `.env`:
```
GOOGLE_MAPS_API_KEY=your_api_key_here
```

---

## Testing Checklist

- [ ] Database migrations run successfully
- [ ] Route fetcher retrieves and stores routes correctly
- [ ] Polylines can be decoded and displayed on map
- [ ] Corridors are assigned correctly based on heading
- [ ] Batching algorithm respects vehicle capacity
- [ ] Orders within batch are ordered by distance
- [ ] API endpoints return expected data
- [ ] Frontend displays routes on map
- [ ] New customer registration triggers route fetch

---

## Future Enhancements

1. **Time windows** - Some customers prefer morning/afternoon delivery
2. **Traffic data** - Adjust routes based on typical traffic
3. **Multi-depot** - Support multiple warehouses
4. **Real-time tracking** - Update ETAs based on driver location
5. **Route recalculation** - Periodically verify stored routes are still optimal
6. **Manual corridor override** - Admin can reassign customer to different corridor

---

## Custom Corridors Configuration

### Current Analysis (March 2026)

Based on analysis of 48 stored customer routes from the Ouadhia depot, customers are concentrated in **only 2 corridors**:

```
HEADING HISTOGRAM
======================================================================
    0°-29 ° (N    ):                                          0
   30°-59 ° (NE   ):                                          0
   60°-89 ° (NE/E ):                                          0
   90°-119° (E    ):                                          0
  120°-149° (SE   ): █████████████                            13
  150°-179° (S/SE ):                                          0
  180°-209° (S    ):                                          0
  210°-239° (SW   ):                                          0
  240°-269° (W/SW ):                                          0
  270°-299° (W    ):                                          0
  300°-329° (NW   ): ██████████████████████████████████       34
  330°-359° (N/NW ):                                          0
```

### Active Corridors

| Corridor | Heading | Customers | Avg Distance | Max Distance | Main Road |
|----------|---------|-----------|--------------|--------------|-----------|
| **NORTHWEST** | 302° | 34 | 4.3 km | 12.5 km | N30 → Tizi Ouzou / Ait Bouaddou |
| **SOUTHEAST** | 124°-127° | 13 | 6.7 km | 17.1 km | Road → Agouni Gueghrane |

### Recommended Custom Configuration

The default 8-direction compass (NORTH, NORTHEAST, EAST, etc.) is **overkill** for this delivery area.

Replace the generic `CORRIDOR_RANGES` in `customer_route_service.py` with business-specific corridors:

```python
# Custom corridors for Ouadhia depot
CORRIDOR_RANGES = {
    'TIZI_OUZOU': (280, 340),      # N30 road north toward Tizi Ouzou
    'AGOUNI_GUEGHRANE': (100, 150), # Southeast road toward Agouni Gueghrane
    'OTHER': (0, 360),              # Fallback for new areas
}
```

### How to Define New Corridors

When expanding to new delivery areas:

1. **Analyze headings**: Run the heading histogram query to see where customers cluster
2. **Identify roads**: Match heading clusters to actual road names
3. **Define ranges**: Create heading ranges that capture each road corridor
4. **Update config**: Modify `CORRIDOR_RANGES` in the service

```sql
-- Query to analyze heading distribution
SELECT
    (initial_heading / 30) * 30 as heading_bucket,
    COUNT(*) as customer_count
FROM customer_routes
WHERE initial_heading IS NOT NULL
GROUP BY heading_bucket
ORDER BY heading_bucket;
```

### Benefits of Custom Corridors

1. **Better batching**: Orders on same road get grouped together
2. **Realistic ETAs**: Distance along actual roads, not as-the-crow-flies
3. **Driver familiarity**: Drivers learn their corridor routes
4. **Scalable**: Easy to add new corridors as business grows

---

## Files to Create

```
backend/
├── alembic/versions/
│   └── xxxx_add_route_optimization.py
├── app/
│   ├── models/
│   │   ├── delivery_corridor.py
│   │   └── customer_route.py
│   ├── services/
│   │   ├── route_fetcher_service.py
│   │   ├── corridor_service.py
│   │   └── smart_batching_service.py
│   └── api/api_v1/endpoints/
│       └── route_optimization.py
├── scripts/
│   └── populate_customer_routes.py
└── requirements.txt  # Add: googlemaps, polyline

frontend/
├── src/app/services/
│   └── route-optimization.service.ts
└── src/app/models/
    └── route.model.ts
```

---

## Quick Start Commands

```bash
# 1. Install dependencies
cd backend
pip install googlemaps polyline

# 2. Run migrations
alembic upgrade head

# 3. Set up corridors (one-time)
python -c "from app.services.corridor_service import CorridorService; ..."

# 4. Fetch routes for existing customers
python scripts/populate_customer_routes.py --batch-size 50

# 5. Test the API
curl -X POST http://localhost:8000/api/v1/route-optimization/optimize \
  -H "Authorization: Bearer $TOKEN"
```
