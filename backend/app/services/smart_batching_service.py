"""
Smart Batching Service
Groups orders by corridor and optimizes stop order based on distance from depot.
Uses driver vehicle capacity to create efficient batches.
"""
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timezone
from collections import defaultdict

from sqlmodel import Session, select

from app.models.order import Order, OrderStatus, DeliveryType
from app.models.user import User, UserRole
from app.models.driver import Driver, DriverVehicle, DriverStatus
from app.models.customer_route import CustomerRoute
from app.models.trip import Trip, TripStop, TripStatus, StopStatus
from app.models.product import Product


@dataclass
class OrderWithRoute:
    """Order with its route data for batching."""
    order_id: int
    user_id: int
    customer_name: str
    address: str
    phone: str
    weight_kg: float
    shipping_cost: float
    corridor: str
    distance_meters: int
    duration_seconds: int
    latitude: Optional[float] = None
    longitude: Optional[float] = None


@dataclass
class DriverCapacity:
    """Driver with their vehicle capacity."""
    driver_id: int
    driver_name: str
    phone: str
    capacity_kg: float
    vehicle_type: str


@dataclass
class SmartBatch:
    """A batch of orders for a single trip."""
    corridor: str
    orders: List[OrderWithRoute] = field(default_factory=list)
    total_weight_kg: float = 0.0
    total_distance_meters: int = 0
    total_earnings: float = 0.0
    assigned_driver: Optional[DriverCapacity] = None

    @property
    def order_count(self) -> int:
        return len(self.orders)

    @property
    def order_ids(self) -> List[int]:
        return [o.order_id for o in self.orders]


class SmartBatchingService:
    """
    Service to create optimized delivery batches using corridor-based routing.

    Strategy:
    1. Group orders by corridor (same road)
    2. Sort by distance from depot (farthest first for efficient routing)
    3. Fill batches respecting driver capacity
    4. Assign drivers to batches
    """

    def __init__(self, session: Session):
        self.session = session

    def get_active_drivers(self) -> List[DriverCapacity]:
        """Get all active drivers with their vehicle capacity."""
        # Get available drivers with their primary vehicle
        drivers = self.session.exec(
            select(Driver, User)
            .join(User, Driver.user_id == User.id)
            .where(Driver.status == DriverStatus.AVAILABLE)
            .where(User.is_active == True)
        ).all()

        result = []
        for driver, user in drivers:
            # Get primary vehicle for capacity
            primary_vehicle = self.session.exec(
                select(DriverVehicle)
                .where(DriverVehicle.driver_id == driver.id)
                .where(DriverVehicle.is_primary == True)
                .where(DriverVehicle.is_active == True)
            ).first()

            capacity = primary_vehicle.capacity_kg if primary_vehicle and primary_vehicle.capacity_kg else 500.0
            vehicle_type = primary_vehicle.vehicle_type.value if primary_vehicle and primary_vehicle.vehicle_type else "van"

            result.append(DriverCapacity(
                driver_id=user.id,
                driver_name=user.full_name,
                phone=user.phone or "",
                capacity_kg=capacity,
                vehicle_type=vehicle_type
            ))

        return result

    def get_pending_orders_with_routes(self) -> List[OrderWithRoute]:
        """Get all pending batchable orders with their route data."""
        # Get pending orders that are CONFIRMED, not assigned, STANDARD delivery
        orders = self.session.exec(
            select(Order)
            .where(Order.status == OrderStatus.CONFIRMED)
            .where(Order.driver_id == None)
            .where(Order.trip_id == None)
            .where(Order.delivery_type == DeliveryType.STANDARD)
            .where(Order.is_full_load == False)
        ).all()

        result = []
        for order in orders:
            # Get customer route data
            route = self.session.exec(
                select(CustomerRoute).where(CustomerRoute.user_id == order.user_id)
            ).first()

            # Calculate order weight
            weight_kg = self._calculate_order_weight(order)

            result.append(OrderWithRoute(
                order_id=order.id,
                user_id=order.user_id,
                customer_name=order.user.full_name if order.user else "Unknown",
                address=order.shipping_address or "",
                phone=order.user.phone if order.user else "",
                weight_kg=weight_kg,
                shipping_cost=float(order.shipping_cost or 0),
                corridor=route.corridor if route else "OTHER",
                distance_meters=route.distance_meters if route else 0,
                duration_seconds=route.duration_seconds if route else 0,
                latitude=order.user.latitude if order.user else None,
                longitude=order.user.longitude if order.user else None,
            ))

        return result

    def _calculate_order_weight(self, order: Order) -> float:
        """Calculate total weight of an order in kg."""
        if not order.items:
            return 0.0

        total_weight = 0.0
        product_ids = [item.product_id for item in order.items]

        if product_ids:
            products = self.session.exec(
                select(Product).where(Product.id.in_(product_ids))
            ).all()
            product_map = {p.id: p for p in products}

            for item in order.items:
                product = product_map.get(item.product_id)
                if product and product.weight:
                    total_weight += product.weight * item.quantity

        return total_weight

    def create_smart_batches(
        self,
        max_weight_per_batch: Optional[float] = None,
        strategy: str = "farthest_first"
    ) -> Dict:
        """
        Create optimized batches from pending orders.

        Args:
            max_weight_per_batch: Override driver capacity (optional)
            strategy: "farthest_first" (default) or "nearest_first"
                - farthest_first: Go to farthest customer first, deliver on way back
                - nearest_first: Start with nearest, work outward

        Returns:
            Dict with batches grouped by corridor
        """
        # Get drivers and their capacities
        drivers = self.get_active_drivers()
        if not drivers:
            return {
                "success": False,
                "error": "No active drivers available",
                "batches": [],
                "summary": {}
            }

        # Use smallest driver capacity as default batch limit (or override)
        default_capacity = min(d.capacity_kg for d in drivers)
        batch_capacity = max_weight_per_batch or default_capacity

        # Get orders with routes
        orders = self.get_pending_orders_with_routes()
        if not orders:
            return {
                "success": True,
                "message": "No pending orders to batch",
                "batches": [],
                "summary": {"total_orders": 0, "total_batches": 0}
            }

        # Group by corridor
        corridors = defaultdict(list)
        for order in orders:
            corridors[order.corridor].append(order)

        # Sort each corridor by distance
        # farthest_first: descending (farthest first in list = first stop)
        # nearest_first: ascending (nearest first in list = first stop)
        reverse = (strategy == "farthest_first")
        for corridor in corridors:
            corridors[corridor].sort(key=lambda x: x.distance_meters, reverse=reverse)

        # Create batches respecting capacity
        all_batches = []

        for corridor, corridor_orders in corridors.items():
            corridor_batches = self._create_batches_for_corridor(
                corridor, corridor_orders, batch_capacity
            )
            all_batches.extend(corridor_batches)

        # Assign drivers to batches (simple round-robin for now)
        available_drivers = list(drivers)
        for i, batch in enumerate(all_batches):
            if available_drivers:
                # Find a driver with enough capacity
                for driver in available_drivers:
                    if driver.capacity_kg >= batch.total_weight_kg:
                        batch.assigned_driver = driver
                        break

        return {
            "success": True,
            "batches": [self._batch_to_dict(b) for b in all_batches],
            "summary": {
                "total_orders": len(orders),
                "total_batches": len(all_batches),
                "by_corridor": {
                    corridor: len([b for b in all_batches if b.corridor == corridor])
                    for corridor in corridors.keys()
                },
                "drivers_available": len(drivers),
                "batch_capacity_kg": batch_capacity,
                "strategy": strategy
            }
        }

    def _create_batches_for_corridor(
        self,
        corridor: str,
        orders: List[OrderWithRoute],
        capacity_kg: float
    ) -> List[SmartBatch]:
        """Create batches for a single corridor, respecting capacity."""
        batches = []
        current_batch = SmartBatch(corridor=corridor)

        for order in orders:
            # Check if order fits in current batch
            if current_batch.total_weight_kg + order.weight_kg > capacity_kg:
                # Save current batch if it has orders
                if current_batch.orders:
                    batches.append(current_batch)
                # Start new batch
                current_batch = SmartBatch(corridor=corridor)

            # Add order to current batch
            current_batch.orders.append(order)
            current_batch.total_weight_kg += order.weight_kg
            current_batch.total_earnings += order.shipping_cost
            # Update max distance (farthest point in batch)
            if order.distance_meters > current_batch.total_distance_meters:
                current_batch.total_distance_meters = order.distance_meters

        # Don't forget the last batch
        if current_batch.orders:
            batches.append(current_batch)

        return batches

    def _batch_to_dict(self, batch: SmartBatch) -> Dict:
        """Convert batch to dictionary for API response."""
        return {
            "corridor": batch.corridor,
            "order_count": batch.order_count,
            "order_ids": batch.order_ids,
            "total_weight_kg": round(batch.total_weight_kg, 2),
            "total_distance_km": round(batch.total_distance_meters / 1000, 1),
            "total_earnings": round(batch.total_earnings, 2),
            "assigned_driver": {
                "id": batch.assigned_driver.driver_id,
                "name": batch.assigned_driver.driver_name,
                "capacity_kg": batch.assigned_driver.capacity_kg,
                "vehicle_type": batch.assigned_driver.vehicle_type
            } if batch.assigned_driver else None,
            "stops": [
                {
                    "sequence": i + 1,
                    "order_id": o.order_id,
                    "customer_name": o.customer_name,
                    "address": o.address,
                    "phone": o.phone,
                    "weight_kg": round(o.weight_kg, 2),
                    "distance_km": round(o.distance_meters / 1000, 1),
                    "latitude": o.latitude,
                    "longitude": o.longitude,
                }
                for i, o in enumerate(batch.orders)
            ]
        }

    def create_trips_from_batches(
        self,
        batches: List[Dict],
        created_by_id: Optional[int] = None
    ) -> Dict:
        """
        Create actual Trip records from smart batches.

        Args:
            batches: List of batch dicts (from create_smart_batches)
            created_by_id: Admin user ID creating the trips

        Returns:
            Result with created trips
        """
        created_trips = []

        for batch in batches:
            order_ids = batch.get("order_ids", [])
            if len(order_ids) < 1:
                continue

            # Get orders
            orders = self.session.exec(
                select(Order).where(Order.id.in_(order_ids))
            ).all()

            if not orders:
                continue

            # Create trip
            trip = Trip(
                status=TripStatus.PENDING,
                total_weight_kg=batch.get("total_weight_kg", 0),
                total_volume_m3=0,  # TODO: calculate if needed
                total_earnings=batch.get("total_earnings", 0),
                h3_zone=batch.get("corridor"),
                estimated_distance_km=batch.get("total_distance_km", 0),
                created_by_id=created_by_id,
            )

            # Assign driver if specified
            driver_info = batch.get("assigned_driver")
            if driver_info:
                trip.driver_id = driver_info.get("id")
                trip.status = TripStatus.ASSIGNED
                trip.assigned_at = datetime.now(timezone.utc)

            self.session.add(trip)
            self.session.commit()
            self.session.refresh(trip)

            # Create stops in order (sequence from batch)
            for stop_data in batch.get("stops", []):
                stop = TripStop(
                    trip_id=trip.id,
                    order_id=stop_data["order_id"],
                    sequence=stop_data["sequence"],
                    status=StopStatus.PENDING,
                )
                self.session.add(stop)

                # Update order to link to trip
                order = self.session.get(Order, stop_data["order_id"])
                if order:
                    order.trip_id = trip.id
                    if driver_info:
                        order.driver_id = driver_info.get("id")
                    order.updated_at = datetime.now(timezone.utc)
                    self.session.add(order)

            self.session.commit()
            created_trips.append(trip)

        return {
            "success": True,
            "message": f"Created {len(created_trips)} trips",
            "trips_created": len(created_trips),
            "trips": [
                {
                    "id": t.id,
                    "corridor": t.h3_zone,
                    "stops": len(t.stops),
                    "driver_id": t.driver_id,
                    "status": t.status.value,
                }
                for t in created_trips
            ]
        }


def preview_smart_batching(session: Session, strategy: str = "farthest_first") -> Dict:
    """
    Preview smart batching without creating trips.
    Useful for admin to review before confirming.
    """
    service = SmartBatchingService(session)
    return service.create_smart_batches(strategy=strategy)


def run_smart_batching(
    session: Session,
    created_by_id: Optional[int] = None,
    strategy: str = "farthest_first"
) -> Dict:
    """
    Run smart batching and create trips.
    """
    service = SmartBatchingService(session)

    # Create batches
    result = service.create_smart_batches(strategy=strategy)

    if not result.get("success") or not result.get("batches"):
        return result

    # Create trips from batches
    trips_result = service.create_trips_from_batches(
        result["batches"],
        created_by_id=created_by_id
    )

    return {
        **result,
        **trips_result
    }
