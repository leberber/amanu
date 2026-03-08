# Delivery & Logistics System

## Overview

A logistics system for calculating shipping costs and managing a driver fleet for deliveries. The system optimizes routes by combining multiple orders when they share the same path and fit within vehicle capacity.

---

## Phase 1: Shipping Cost Calculation

### Goal
Calculate delivery cost based on product weight, volume, and distance.

### Data Available
- `product.weight` (kg) - already added to products table
- `product.volume` (L) - already added to products table
- Customer address (from orders)
- Warehouse/store location

### To Implement

#### Backend
- [ ] Add shipping cost calculation service
- [ ] Create pricing formula: `base_cost + (weight_factor * total_weight) + (volume_factor * total_volume) + (distance_factor * distance_km)`
- [ ] Integrate with Google Maps Distance Matrix API or similar for distance calculation
- [ ] Store shipping zones/rates in database for flexibility

#### Frontend
- [ ] Display estimated shipping cost at checkout
- [ ] Show breakdown (weight cost, volume cost, distance cost)

### Pricing Formula (Draft)
```
shipping_cost = base_fee
              + (price_per_kg * total_weight_kg)
              + (price_per_liter * total_volume_L)
              + (price_per_km * distance_km)
```

---

## Phase 2: Driver Registration System

### Goal
Allow drivers to register with their vehicles and make themselves available for deliveries.

### New Models

#### Driver
```python
class Driver(SQLModel, table=True):
    id: int
    user_id: int  # FK to User (new role: DRIVER)
    phone: str
    license_number: str
    is_available: bool = True
    is_verified: bool = False
    current_location_lat: Optional[float]
    current_location_lng: Optional[float]
    created_at: datetime
```

#### Vehicle
```python
class Vehicle(SQLModel, table=True):
    id: int
    driver_id: int  # FK to Driver
    type: str  # 'motorcycle', 'car', 'van', 'truck'
    plate_number: str
    max_weight_kg: float  # Maximum cargo weight
    max_volume_liters: float  # Maximum cargo volume
    is_active: bool = True
```

### To Implement

#### Backend
- [ ] Add DRIVER role to UserRole enum
- [ ] Create Driver and Vehicle models
- [ ] Driver registration endpoint
- [ ] Driver verification workflow (admin approves)
- [ ] Driver availability toggle
- [ ] Driver location update endpoint (for tracking)

#### Frontend
- [ ] Driver registration page
- [ ] Driver dashboard (available orders, current deliveries)
- [ ] Vehicle management (add/edit vehicle info)
- [ ] Admin: driver verification/approval page

---

## Phase 3: Order Matching & Route Optimization

### Goal
- Drivers see available delivery trips
- System suggests combining orders on the same route
- Ensure combined orders fit in vehicle capacity

### Order Batching Logic

```
For each pending order:
  1. Get delivery destination (customer address)
  2. Find other pending orders with nearby destinations
  3. Check if combined weight <= vehicle.max_weight_kg
  4. Check if combined volume <= vehicle.max_volume_liters
  5. Calculate if route combination saves cost/time
  6. Group orders into a "Trip"
```

### New Models

#### Trip (Delivery Batch)
```python
class Trip(SQLModel, table=True):
    id: int
    driver_id: Optional[int]  # Assigned driver
    status: str  # 'pending', 'assigned', 'in_progress', 'completed'
    total_weight_kg: float
    total_volume_liters: float
    total_distance_km: float
    estimated_duration_minutes: int
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]

class TripOrder(SQLModel, table=True):
    id: int
    trip_id: int  # FK to Trip
    order_id: int  # FK to Order
    delivery_sequence: int  # Order of delivery (1, 2, 3...)
    status: str  # 'pending', 'delivered'
```

### To Implement

#### Backend
- [ ] Trip and TripOrder models
- [ ] Order batching algorithm
- [ ] Route optimization (Google Maps Directions API)
- [ ] Trip assignment (driver claims or admin assigns)
- [ ] Trip status updates
- [ ] Driver earnings calculation

#### Frontend
- [ ] Available trips list (for drivers)
- [ ] Trip details with map and delivery sequence
- [ ] Trip progress tracking
- [ ] Admin: manual trip creation/assignment
- [ ] Customer: delivery tracking

---

## Geolocation & Maps Integration

### APIs to Consider
- **Google Maps Platform**
  - Distance Matrix API (calculate distances)
  - Directions API (route optimization)
  - Geocoding API (address to coordinates)

- **Alternatives**
  - Mapbox
  - OpenRouteService (open source)
  - HERE Maps

### Implementation Notes
- Store coordinates for all addresses
- Cache distance calculations to reduce API costs
- Consider offline fallback for distance estimation

---

## Database Changes Summary

### New Tables
1. `drivers` - Driver profiles
2. `vehicles` - Vehicle information
3. `trips` - Delivery batches
4. `trip_orders` - Orders in each trip
5. `shipping_zones` - Pricing zones (optional)
6. `shipping_rates` - Rate configuration

### Modified Tables
- `users` - Add DRIVER role
- `orders` - Add `trip_id` FK, shipping cost breakdown

---

## API Endpoints (Draft)

### Shipping
- `POST /api/v1/shipping/calculate` - Calculate shipping cost for cart
- `GET /api/v1/shipping/rates` - Get current shipping rates

### Drivers
- `POST /api/v1/drivers/register` - Driver registration
- `GET /api/v1/drivers/me` - Current driver profile
- `PATCH /api/v1/drivers/availability` - Toggle availability
- `POST /api/v1/drivers/location` - Update current location

### Vehicles
- `POST /api/v1/vehicles` - Add vehicle
- `GET /api/v1/vehicles` - List driver's vehicles
- `PATCH /api/v1/vehicles/{id}` - Update vehicle

### Trips
- `GET /api/v1/trips/available` - List available trips (for drivers)
- `POST /api/v1/trips/{id}/claim` - Driver claims a trip
- `PATCH /api/v1/trips/{id}/status` - Update trip status
- `GET /api/v1/trips/{id}` - Trip details with orders

### Admin
- `GET /api/v1/admin/drivers` - List all drivers
- `PATCH /api/v1/admin/drivers/{id}/verify` - Verify driver
- `POST /api/v1/admin/trips` - Manually create trip
- `POST /api/v1/admin/trips/{id}/assign` - Assign driver to trip

---

---

## Architecture: Built for Extension

The system uses **Strategy Pattern** - start simple, swap implementations later without changing other code.

### Project Structure

```
backend/app/
├── services/
│   └── delivery/
│       ├── __init__.py
│       ├── service.py          # Main service (glues everything)
│       ├── calculators/
│       │   ├── base.py         # ABC interface
│       │   ├── zone.py         # Simple (start here)
│       │   └── distance.py     # Add later (Google Maps)
│       ├── batchers/
│       │   ├── base.py         # ABC interface
│       │   ├── zone.py         # Simple (start here)
│       │   └── optimized.py    # Add later (route optimization)
│       └── assigners/
│           ├── base.py         # ABC interface
│           ├── manual.py       # Start here (admin assigns)
│           └── nearest.py      # Add later (auto-assign)
```

### 1. Shipping Calculator - Strategy Pattern

```python
# delivery/calculators/base.py
from abc import ABC, abstractmethod

class ShippingCalculator(ABC):
    """Base interface - all calculators implement this"""

    @abstractmethod
    def calculate(self, order: Order, destination: Address) -> ShippingCost:
        pass
```

```python
# delivery/calculators/zone.py (START WITH THIS)
class ZoneBasedCalculator(ShippingCalculator):
    """Simple: same wilaya = X, different = Y"""

    def calculate(self, order, destination):
        if destination.wilaya == WAREHOUSE_WILAYA:
            return ShippingCost(amount=200, method="zone")
        return ShippingCost(amount=500 + (order.total_weight * 10), method="zone")
```

```python
# delivery/calculators/distance.py (ADD LATER)
class DistanceBasedCalculator(ShippingCalculator):
    """Uses Google Maps API for precise distance"""

    def calculate(self, order, destination):
        distance = google_maps.get_distance(WAREHOUSE, destination)
        return ShippingCost(
            amount=100 + (distance.km * 15) + (order.total_weight * 10),
            method="distance"
        )
```

### 2. Trip Assignment - Same Pattern

```python
# delivery/assigners/base.py
class TripAssigner(ABC):
    @abstractmethod
    def assign(self, trip: Trip) -> Optional[Driver]:
        pass
```

```python
# delivery/assigners/manual.py (START WITH THIS)
class ManualAssigner(TripAssigner):
    """Admin assigns manually - returns None, admin picks driver"""
    def assign(self, trip):
        return None  # No auto-assignment
```

```python
# delivery/assigners/nearest.py (ADD LATER)
class NearestDriverAssigner(TripAssigner):
    """Auto-assign to nearest available driver"""
    def assign(self, trip):
        available = Driver.query.filter(is_available=True).all()
        return min(available, key=lambda d: distance(d.location, trip.pickup))
```

### 3. Order Batching - Same Pattern

```python
# delivery/batchers/base.py
class OrderBatcher(ABC):
    @abstractmethod
    def create_batches(self, orders: List[Order]) -> List[Trip]:
        pass
```

```python
# delivery/batchers/zone.py (START WITH THIS)
class ZoneBatcher(OrderBatcher):
    """Group by wilaya only"""
    def create_batches(self, orders):
        by_wilaya = group_by(orders, lambda o: o.destination.wilaya)
        return [Trip(orders=group) for group in by_wilaya.values()]
```

```python
# delivery/batchers/optimized.py (ADD LATER)
class RouteOptimizedBatcher(OrderBatcher):
    """Use Google Routes API to optimize"""
    def create_batches(self, orders):
        # Call Google API with optimizeWaypointOrder=true
        pass
```

### 4. Configuration - Feature Flags

```python
# core/config.py
class DeliverySettings(BaseSettings):
    # Which implementation to use
    SHIPPING_CALCULATOR: str = "zone"      # "zone" | "distance"
    TRIP_ASSIGNMENT: str = "manual"        # "manual" | "nearest" | "smart"
    ORDER_BATCHING: str = "zone"           # "zone" | "capacity" | "optimized"

    # Feature flags
    ENABLE_DRIVER_APP: bool = False
    ENABLE_LIVE_TRACKING: bool = False
    ENABLE_AUTO_BATCHING: bool = False
```

### 5. Main Service - Glues It Together

```python
# delivery/service.py
class DeliveryService:
    def __init__(self):
        self.calculator = get_shipping_calculator()  # Returns right implementation based on config
        self.batcher = get_order_batcher()
        self.assigner = get_trip_assigner()

    def calculate_shipping(self, order, destination):
        return self.calculator.calculate(order, destination)

    def create_trips(self, orders):
        trips = self.batcher.create_batches(orders)
        if settings.ENABLE_AUTO_ASSIGNMENT:
            for trip in trips:
                trip.driver = self.assigner.assign(trip)
        return trips
```

### Extension Summary

| Start With | Add Later | Code Change Required |
|------------|-----------|---------------------|
| `ZoneBasedCalculator` | `DistanceBasedCalculator` | New file only + config |
| `ManualAssigner` | `NearestDriverAssigner` | New file only + config |
| `ZoneBatcher` | `RouteOptimizedBatcher` | New file only + config |

**Key principle:** Code to interfaces, not implementations. Swap behavior via config, not code rewrites.

---

## Implementation Timeline

### Week 1: Shipping Cost (Foundation)
- [ ] Create `ShippingCalculator` base class
- [ ] Implement `ZoneBasedCalculator`
- [ ] Add shipping cost to checkout flow
- [ ] Store shipping zones in database

### Week 2: Driver System
- [ ] Add DRIVER role to users
- [ ] Create Driver and Vehicle models
- [ ] Driver registration endpoint
- [ ] Admin driver management page

### Week 3: Basic Trips
- [ ] Create Trip and TripOrder models
- [ ] Manual trip creation by admin
- [ ] Implement `ManualAssigner`
- [ ] Driver sees assigned trips

### Week 4+: Automation (when needed)
- [ ] Implement `ZoneBatcher` for auto-batching
- [ ] Add Google Maps integration
- [ ] Implement `DistanceBasedCalculator`
- [ ] Implement `NearestDriverAssigner`

---

## Future Enhancements

- Real-time driver tracking
- Push notifications for new trips
- Driver ratings
- Automated trip assignment (nearest available driver)
- Delivery time windows
- Proof of delivery (photo/signature)
- Driver earnings/payments management
