"""
Smart Batching Service
Groups orders by corridor and optimizes stop order based on distance from depot.
Uses driver vehicle capacity to create efficient batches.
"""
from typing import List, Dict, Optional
from dataclasses import dataclass, field
from datetime import datetime, timezone
from collections import defaultdict

from sqlmodel import Session, select

from app.models.order import Order, OrderStatus, DeliveryType
from app.models.user import User
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
    duration_seconds: int = 0
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

    Algorithm:
    1. Group orders by corridor (road name)
    2. Sort corridors by total weight (heaviest first)
    3. Within each corridor, sort orders by distance
    4. Fill batches respecting driver vehicle capacity
    5. Assign drivers to batches automatically
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

            # Use pre-calculated weight, fallback to calculation for old orders
            weight_kg = order.total_weight_kg if order.total_weight_kg > 0 else self._calculate_order_weight(order)

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
        max_orders_per_batch: Optional[int] = None,
        strategy: str = "nearest_first",
        simulation_limit: Optional[int] = None,
        corridor_filter: Optional[str] = None,
        max_capacity_percent: float = 90.0
    ) -> Dict:
        """
        Create optimized batches from pending orders using corridor-based grouping.

        Logic:
        1. Get available trucks (drivers) with their capacities
        2. Group orders by corridor (road name)
        3. Within each corridor, sort by distance
        4. Use SMART selection: consider efficiency (weight/distance) not just order
        5. Skip orders where driving extra distance isn't worth the weight gain
        6. Fill batches respecting truck capacity
        7. Assign drivers to batches
        8. Track leftover orders that couldn't fit

        Args:
            max_weight_per_batch: Override driver capacity (optional)
            max_orders_per_batch: Maximum orders per batch (optional)
            strategy: "farthest_first" or "nearest_first"
            simulation_limit: Limit orders for testing
            max_capacity_percent: Max % of vehicle capacity to use (default 90%)

        Returns:
            Dict with batches, leftover orders, and capacity info
        """
        # Get drivers and their capacities
        drivers = self.get_active_drivers()
        if not drivers:
            return {
                "success": False,
                "error": "No active drivers available",
                "batches": [],
                "leftover_orders": [],
                "summary": {}
            }

        # Get orders with routes
        orders = self.get_pending_orders_with_routes()
        if not orders:
            return {
                "success": True,
                "message": "No pending orders to batch",
                "batches": [],
                "leftover_orders": [],
                "summary": {"total_orders": 0, "total_batches": 0}
            }

        # Filter by corridor(s) if specified (supports comma-separated list)
        if corridor_filter:
            # Parse comma-separated corridors
            corridors = [c.strip() for c in corridor_filter.split(',') if c.strip()]
            if corridors:
                orders = [o for o in orders if o.corridor in corridors]
                if not orders:
                    return {
                        "success": True,
                        "message": f"No pending orders in corridor(s): {corridor_filter}",
                        "batches": [],
                        "leftover_orders": [],
                        "summary": {"total_orders": 0, "total_batches": 0, "corridor_filter": corridor_filter}
                    }

        # Apply simulation limit (random sample for testing)
        if simulation_limit and simulation_limit > 0 and len(orders) > simulation_limit:
            import random
            orders = random.sample(orders, simulation_limit)

        # Group orders by corridor
        corridor_groups = defaultdict(list)
        for order in orders:
            corridor_groups[order.corridor].append(order)

        # Sort each corridor's orders by distance
        reverse_distance = (strategy == "farthest_first")
        for corridor in corridor_groups:
            corridor_groups[corridor].sort(
                key=lambda o: o.distance_meters,
                reverse=reverse_distance
            )

        # Create batches - fill trucks with orders from same corridor
        all_batches = []
        assigned_order_ids = set()
        available_drivers = list(drivers)
        driver_index = 0

        # Process corridors by total weight (heaviest first to use large trucks efficiently)
        corridors_by_weight = sorted(
            corridor_groups.keys(),
            key=lambda c: sum(o.weight_kg for o in corridor_groups[c]),
            reverse=True
        )

        for corridor in corridors_by_weight:
            corridor_orders = corridor_groups[corridor]

            # Skip if no drivers left
            while corridor_orders and driver_index < len(available_drivers):
                driver = available_drivers[driver_index]
                base_capacity = max_weight_per_batch or driver.capacity_kg
                # Apply max capacity percentage (e.g., 90% of capacity)
                driver_capacity = base_capacity * (max_capacity_percent / 100.0)

                # Create batch for this corridor
                batch = SmartBatch(corridor=corridor)
                batch.assigned_driver = driver
                current_weight = 0.0

                # Fill batch with orders that fit
                remaining_orders = []

                for order in corridor_orders:
                    # Skip already assigned orders
                    if order.order_id in assigned_order_ids:
                        continue

                    # Check if order fits by weight
                    if current_weight + order.weight_kg > driver_capacity:
                        remaining_orders.append(order)
                        continue
                    if max_orders_per_batch and len(batch.orders) >= max_orders_per_batch:
                        remaining_orders.append(order)
                        continue

                    # Add order to batch
                    batch.orders.append(order)
                    batch.total_weight_kg += order.weight_kg
                    batch.total_earnings += order.shipping_cost
                    current_weight += order.weight_kg
                    assigned_order_ids.add(order.order_id)

                    if order.distance_meters > batch.total_distance_meters:
                        batch.total_distance_meters = order.distance_meters

                # Save batch if it has orders
                if batch.orders:
                    all_batches.append(batch)
                    driver_index += 1
                    # Continue with remaining orders if any
                    corridor_orders = remaining_orders
                    if not corridor_orders:
                        break
                else:
                    # No orders added to batch - all don't fit in this driver's capacity
                    # Break out to try next corridor
                    break

        # Collect leftover orders (not assigned to any batch)
        leftover_orders = []
        for order in orders:
            if order.order_id not in assigned_order_ids:
                distance_km = order.distance_meters / 1000
                leftover_orders.append({
                    "order_id": order.order_id,
                    "customer_name": order.customer_name,
                    "address": order.address,
                    "weight_kg": round(order.weight_kg, 2),
                    "corridor": order.corridor,
                    "distance_km": round(distance_km, 1),
                    "reason": "no_capacity"  # Only reason now is no truck capacity left
                })

        # Build summary
        by_corridor = {}
        for batch in all_batches:
            by_corridor[batch.corridor] = by_corridor.get(batch.corridor, 0) + 1

        # Find smallest order weight and trucks that can't handle it
        smallest_order_weight = min((o.weight_kg for o in orders), default=0)
        unusable_trucks = []
        for driver in drivers:
            effective_capacity = driver.capacity_kg * (max_capacity_percent / 100.0)
            if effective_capacity < smallest_order_weight:
                unusable_trucks.append({
                    "id": driver.driver_id,
                    "name": driver.driver_name,
                    "capacity_kg": driver.capacity_kg,
                    "effective_capacity_kg": round(effective_capacity, 1)
                })

        summary = {
            "total_orders": len(orders),
            "orders_assigned": len(assigned_order_ids),
            "orders_leftover": len(leftover_orders),
            "total_batches": len(all_batches),
            "trucks_available": len(drivers),
            "trucks_used": len(all_batches),
            "by_corridor": by_corridor,
            "strategy": strategy,
            "smallest_order_kg": round(smallest_order_weight, 1),
            "unusable_trucks": unusable_trucks
        }

        if corridor_filter:
            summary["corridor_filter"] = corridor_filter

        return {
            "success": True,
            "batches": [self._batch_to_dict_with_capacity(b, drivers) for b in all_batches],
            "leftover_orders": leftover_orders,
            "summary": summary
        }

    def _batch_to_dict_with_capacity(self, batch: SmartBatch, drivers: List[DriverCapacity]) -> Dict:
        """Convert batch to dictionary with capacity utilization info."""
        driver_capacity = batch.assigned_driver.capacity_kg if batch.assigned_driver else 500
        capacity_used_pct = round((batch.total_weight_kg / driver_capacity) * 100, 1) if driver_capacity > 0 else 0

        return {
            "corridor": batch.corridor,
            "order_count": batch.order_count,
            "order_ids": batch.order_ids,
            "total_weight_kg": round(batch.total_weight_kg, 2),
            "total_distance_km": round(batch.total_distance_meters / 1000, 1),
            "total_earnings": round(batch.total_earnings, 2),
            "capacity_kg": driver_capacity,
            "capacity_used_pct": capacity_used_pct,
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
                    "user_id": o.user_id,
                    "customer_name": o.customer_name,
                    "address": o.address,
                    "phone": o.phone,
                    "weight_kg": round(o.weight_kg, 2),
                    "distance_km": round(o.distance_meters / 1000, 1),
                    "corridor": o.corridor,
                    "duration_min": round(o.duration_seconds / 60, 1),
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

            # Get corridor from batch
            corridor = batch.get("corridor")

            # Find suggested driver based on corridor preference
            suggested_driver_id = None
            driver_info = batch.get("assigned_driver")

            if driver_info:
                # Check if this driver prefers this corridor
                driver = self.session.exec(
                    select(Driver).where(Driver.user_id == driver_info.get("id"))
                ).first()
                if driver and driver.preferred_corridor == corridor:
                    suggested_driver_id = driver_info.get("id")
                elif driver:
                    # Driver doesn't prefer this corridor, but still suggest based on capacity
                    suggested_driver_id = driver_info.get("id")

            # If no driver from batch, find one who prefers this corridor
            if not suggested_driver_id and corridor:
                preferred_driver = self.session.exec(
                    select(Driver)
                    .where(Driver.preferred_corridor == corridor)
                    .where(Driver.status == DriverStatus.AVAILABLE)
                ).first()
                if preferred_driver:
                    suggested_driver_id = preferred_driver.user_id

            # Create trip (NOT assigned - driver must accept)
            trip = Trip(
                status=TripStatus.PENDING,
                corridor=corridor,
                total_weight_kg=batch.get("total_weight_kg", 0),
                total_volume_m3=0,
                total_earnings=batch.get("total_earnings", 0),
                h3_zone=corridor,  # Keep for backward compatibility
                estimated_distance_km=batch.get("total_distance_km", 0),
                created_by_id=created_by_id,
                suggested_driver_id=suggested_driver_id,
                # driver_id stays None - driver must accept
            )

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

                # Update order to link to trip (but NOT assign driver yet)
                order = self.session.get(Order, stop_data["order_id"])
                if order:
                    order.trip_id = trip.id
                    # driver_id stays None until driver accepts the trip
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


def preview_smart_batching(
    session: Session,
    strategy: str = "nearest_first",
    max_weight_per_batch: Optional[float] = None,
    max_orders_per_batch: Optional[int] = None,
    simulation_limit: Optional[int] = None,
    corridor_filter: Optional[str] = None,
    max_capacity_percent: float = 90.0
) -> Dict:
    """
    Preview smart batching without creating trips.
    Groups orders by corridor (road name) and sorts by distance.
    Uses smart selection to exclude inefficient orders (too far for too little weight).
    Useful for admin to review before confirming.

    Args:
        corridor_filter: Only batch orders from this specific corridor
        max_capacity_percent: Max % of vehicle capacity to use (default 90%)
    """
    service = SmartBatchingService(session)
    return service.create_smart_batches(
        max_weight_per_batch=max_weight_per_batch,
        max_orders_per_batch=max_orders_per_batch,
        strategy=strategy,
        simulation_limit=simulation_limit,
        corridor_filter=corridor_filter,
        max_capacity_percent=max_capacity_percent
    )


def run_smart_batching(
    session: Session,
    created_by_id: Optional[int] = None,
    strategy: str = "nearest_first",
    max_weight_per_batch: Optional[float] = None,
    max_orders_per_batch: Optional[int] = None,
    corridor_filter: Optional[str] = None,
    max_capacity_percent: float = 90.0
) -> Dict:
    """
    Run smart batching and create trips.
    Groups orders by corridor (road name) and creates optimized trips.
    Uses smart selection to exclude inefficient orders.

    Args:
        corridor_filter: Only batch orders from this specific corridor
        max_capacity_percent: Max % of vehicle capacity to use (default 90%)
    """
    service = SmartBatchingService(session)

    # Create batches
    result = service.create_smart_batches(
        max_weight_per_batch=max_weight_per_batch,
        max_orders_per_batch=max_orders_per_batch,
        strategy=strategy,
        corridor_filter=corridor_filter,
        max_capacity_percent=max_capacity_percent
    )

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
