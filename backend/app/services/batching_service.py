"""
Batching service for grouping orders into trips.
Groups STANDARD orders by geographic proximity (H3 zone) and creates trips.
"""
from typing import Optional
from datetime import datetime, timezone
from collections import defaultdict

from sqlmodel import Session, select
from sqlalchemy.orm import selectinload

from app.models.order import Order, OrderStatus, DeliveryType
from app.models.trip import Trip, TripStop, TripStatus, StopStatus
from app.models.driver import Driver, DriverVehicle, DriverStatus
from app.models.product import Product
from app.models.shipping import H3DeliveryZone
from app.models.customer_route import CustomerRoute


# Configuration constants
FULL_LOAD_THRESHOLD = 0.80  # 80% of vehicle capacity = full load
MAX_STOPS_PER_TRIP = 3  # Maximum orders per batched trip
STANDARD_DISCOUNT_PERCENT = 30  # Discount for standard delivery (shared cost)

# Default vehicle capacities (kg) - used when checking full load
DEFAULT_VEHICLE_CAPACITIES = {
    "mini_van": 500,
    "van": 800,
    "truck": 1100,
}


def calculate_order_weight(order: Order, session: Session) -> float:
    """Calculate total weight of an order in kg."""
    if not order.items:
        return 0.0

    total_weight = 0.0
    product_ids = [item.product_id for item in order.items]

    if product_ids:
        products = session.exec(
            select(Product).where(Product.id.in_(product_ids))
        ).all()
        product_map = {p.id: p for p in products}

        for item in order.items:
            product = product_map.get(item.product_id)
            if product and product.weight:
                total_weight += product.weight * item.quantity

    return total_weight


def calculate_order_volume(order: Order, session: Session) -> float:
    """Calculate total volume of an order in m³."""
    if not order.items:
        return 0.0

    total_volume = 0.0
    product_ids = [item.product_id for item in order.items]

    if product_ids:
        products = session.exec(
            select(Product).where(Product.id.in_(product_ids))
        ).all()
        product_map = {p.id: p for p in products}

        for item in order.items:
            product = product_map.get(item.product_id)
            if product and product.volume:
                total_volume += product.volume * item.quantity

    return total_volume


def check_full_load(order_weight_kg: float) -> tuple[bool, Optional[float]]:
    """
    Check if order is a full load and what capacity is needed.
    Returns (is_full_load, min_capacity_needed)
    """
    sorted_capacities = sorted(DEFAULT_VEHICLE_CAPACITIES.items(), key=lambda x: x[1])

    for vehicle_type, capacity in sorted_capacities:
        if order_weight_kg <= capacity:
            load_percentage = order_weight_kg / capacity
            if load_percentage >= FULL_LOAD_THRESHOLD:
                return True, capacity
            else:
                return False, None

    # Order exceeds all vehicles - needs largest
    return True, max(DEFAULT_VEHICLE_CAPACITIES.values())


def get_order_h3_zone(order: Order, session: Session) -> Optional[str]:
    """
    Get the H3 zone for an order based on shipping address.
    This is a simplified version - in production, you'd geocode the address.
    For now, we'll try to find a matching zone from existing delivery zones.
    """
    # In a real implementation, you would:
    # 1. Geocode the shipping address to lat/lng
    # 2. Convert lat/lng to H3 index using h3 library
    # For now, we'll use a placeholder approach based on the order's existing data
    # or return None to indicate unknown zone

    # Try to get from user's location if available
    if order.user and order.user.commune:
        # Use commune as a proxy for zone grouping
        return f"zone_{order.user.commune.lower().replace(' ', '_')}"

    return None


def set_order_full_load_status(order: Order, session: Session) -> None:
    """
    Calculate and set the full load status for an order.
    Should be called when order is created.
    """
    weight_kg = calculate_order_weight(order, session)
    is_full_load, min_capacity = check_full_load(weight_kg)

    order.is_full_load = is_full_load
    order.min_vehicle_capacity_kg = min_capacity


def get_pending_batchable_orders(session: Session) -> list[Order]:
    """
    Get all orders that can be batched.
    These are STANDARD delivery orders that are CONFIRMED and not assigned.
    Eagerly loads user relationship to avoid N+1 queries.
    """
    orders = session.exec(
        select(Order)
        .options(selectinload(Order.user))  # Eagerly load users in one query
        .where(Order.status == OrderStatus.CONFIRMED)
        .where(Order.driver_id == None)
        .where(Order.trip_id == None)
        .where(Order.delivery_type == DeliveryType.STANDARD)
        .where(Order.is_full_load == False)  # Exclude full load orders
        .order_by(Order.created_at.asc())
    ).all()

    return list(orders)


def cluster_orders_by_zone(orders: list[Order], session: Session) -> dict[str, list[Order]]:
    """
    Group orders by their H3 zone.
    Returns a dictionary mapping zone -> list of orders.
    """
    clusters: dict[str, list[Order]] = defaultdict(list)

    for order in orders:
        zone = get_order_h3_zone(order, session)
        if zone:
            clusters[zone].append(order)
        else:
            # Orders without zone go into "unknown" bucket
            clusters["unknown"].append(order)

    return dict(clusters)


def create_trips_from_clusters(
    clusters: dict[str, list[Order]],
    session: Session,
    created_by_id: Optional[int] = None
) -> list[Trip]:
    """
    Create trips from order clusters.
    Each trip has max MAX_STOPS_PER_TRIP orders.
    """
    created_trips = []

    for zone, orders in clusters.items():
        # Split orders into groups of MAX_STOPS_PER_TRIP
        for i in range(0, len(orders), MAX_STOPS_PER_TRIP):
            batch = orders[i:i + MAX_STOPS_PER_TRIP]

            if len(batch) < 2:
                # Skip single orders - they don't benefit from batching
                continue

            # Calculate totals
            total_weight = sum(o.total_weight_kg or 0 for o in batch)
            total_volume = sum(o.total_volume or 0 for o in batch)
            total_earnings = sum(o.shipping_cost for o in batch)

            # Create trip
            trip = Trip(
                status=TripStatus.PENDING,
                total_weight_kg=total_weight,
                total_volume_m3=total_volume,
                total_earnings=total_earnings,
                h3_zone=zone if zone != "unknown" else None,
                created_by_id=created_by_id,
            )
            session.add(trip)
            session.commit()
            session.refresh(trip)

            # Create stops for each order
            for sequence, order in enumerate(batch, start=1):
                stop = TripStop(
                    trip_id=trip.id,
                    order_id=order.id,
                    sequence=sequence,
                    status=StopStatus.PENDING,
                )
                session.add(stop)

                # Update order to link to trip
                order.trip_id = trip.id
                order.updated_at = datetime.now(timezone.utc)
                session.add(order)

            session.commit()
            created_trips.append(trip)

    return created_trips


def run_batching(session: Session, created_by_id: Optional[int] = None) -> dict:
    """
    Main batching function. Clusters pending orders and creates trips.
    Returns a summary of the batching operation.
    """
    # Get batchable orders
    orders = get_pending_batchable_orders(session)

    if not orders:
        return {
            "success": True,
            "message": "No orders available for batching",
            "orders_processed": 0,
            "trips_created": 0,
            "trips": []
        }

    # Cluster by zone
    clusters = cluster_orders_by_zone(orders, session)

    # Create trips
    trips = create_trips_from_clusters(clusters, session, created_by_id)

    # Count orders that were batched
    batched_order_count = sum(len(t.stops) for t in trips)

    return {
        "success": True,
        "message": f"Created {len(trips)} trips from {batched_order_count} orders",
        "orders_processed": batched_order_count,
        "trips_created": len(trips),
        "trips": [
            {
                "id": t.id,
                "zone": t.h3_zone,
                "stops": len(t.stops),
                "total_weight_kg": t.total_weight_kg,
                "total_earnings": t.total_earnings,
            }
            for t in trips
        ]
    }


def preview_batching(session: Session) -> dict:
    """
    Preview what batching would do without actually creating trips.
    Returns a preview of the proposed trips.
    """
    # Get batchable orders
    orders = get_pending_batchable_orders(session)

    if not orders:
        return {
            "orders_available": 0,
            "proposed_trips": [],
            "unbatched_orders": 0,
        }

    # Cluster by zone
    clusters = cluster_orders_by_zone(orders, session)

    proposed_trips = []
    batched_count = 0
    unbatched_orders_list = []

    for zone, zone_orders in clusters.items():
        for i in range(0, len(zone_orders), MAX_STOPS_PER_TRIP):
            batch = zone_orders[i:i + MAX_STOPS_PER_TRIP]

            if len(batch) < 2:
                # Track unbatched orders with details
                for o in batch:
                    unbatched_orders_list.append({
                        "order_id": o.id,
                        "customer_name": o.user.full_name if o.user else "Unknown",
                        "address": o.shipping_address,
                        "zone": zone,
                        "reason": "only_one_in_zone",
                        "shipping_cost": float(o.shipping_cost) if o.shipping_cost else 0
                    })
                continue

            total_weight = sum(o.total_weight_kg or 0 for o in batch)
            total_earnings = sum(o.shipping_cost for o in batch)
            batched_count += len(batch)

            proposed_trips.append({
                "zone": zone,
                "order_count": len(batch),
                "order_ids": [o.id for o in batch],
                "total_weight_kg": round(total_weight, 2),
                "total_earnings": round(total_earnings, 2),
                "customers": [
                    {
                        "order_id": o.id,
                        "name": o.user.full_name if o.user else "Unknown",
                        "address": o.shipping_address,
                    }
                    for o in batch
                ]
            })

    return {
        "orders_available": len(orders),
        "proposed_trips": proposed_trips,
        "orders_to_batch": batched_count,
        "unbatched_orders": len(unbatched_orders_list),
        "unbatched_orders_list": unbatched_orders_list,
    }


def calculate_standard_shipping_discount(original_cost: float) -> float:
    """
    Calculate discounted shipping cost for STANDARD delivery.
    Standard orders get a discount because they're batched.
    """
    discount = original_cost * (STANDARD_DISCOUNT_PERCENT / 100)
    return round(original_cost - discount, 2)


def get_pending_orders_with_details(
    session: Session,
    limit: Optional[int] = None,
    random_sample: bool = False
) -> list[dict]:
    """
    Get all pending batchable orders with details for the UI.
    Returns order info needed for drag-drop interface including coordinates for map display.
    Includes corridor and heading from pre-computed customer routes.

    Args:
        session: Database session
        limit: Maximum number of orders to return (for simulation testing)
        random_sample: If True with limit, returns random orders instead of first N
    """
    import random as rand

    orders = get_pending_batchable_orders(session)

    # Apply limit and random sampling for simulation
    if limit and limit > 0 and len(orders) > limit:
        if random_sample:
            orders = rand.sample(list(orders), limit)
        else:
            orders = orders[:limit]

    # Fetch all routes in ONE query (avoid N+1)
    user_ids = [order.user_id for order in orders if order.user_id]
    routes = session.exec(
        select(CustomerRoute).where(CustomerRoute.user_id.in_(user_ids))
    ).all() if user_ids else []
    route_map = {route.user_id: route for route in routes}

    result = []
    for order in orders:
        weight_kg = order.total_weight_kg or 0
        zone = get_order_h3_zone(order, session)
        route = route_map.get(order.user_id)

        result.append({
            "id": order.id,
            "user_id": order.user_id,
            "customer_name": order.user.full_name if order.user else "Unknown",
            "address": order.shipping_address,
            "zone": zone or "unknown",
            "corridor": route.corridor if route else None,
            "heading": round(route.heading, 1) if route and route.heading else None,
            "distance_km": route.distance_km if route else None,
            "duration_min": route.duration_min if route else None,
            "shipping_cost": float(order.shipping_cost) if order.shipping_cost else 0,
            "weight_kg": round(weight_kg, 2),
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "latitude": order.user.latitude if order.user else None,
            "longitude": order.user.longitude if order.user else None,
            "h3_index": order.user.h3_index if order.user else None,
        })

    return result


def create_trips_from_custom_batches(
    batches: list[dict],
    session: Session,
    created_by_id: Optional[int] = None
) -> dict:
    """
    Create trips from custom user-defined batches.
    Each batch contains order_ids to group together.

    Args:
        batches: List of dicts with 'order_ids' key
        session: Database session
        created_by_id: ID of admin creating trips

    Returns:
        Summary of the operation with created trips
    """
    # Validate all orders exist and are batchable
    all_order_ids = set()
    for batch in batches:
        for order_id in batch.get("order_ids", []):
            if order_id in all_order_ids:
                return {
                    "success": False,
                    "message": f"Order {order_id} appears in multiple batches",
                    "orders_processed": 0,
                    "trips_created": 0,
                    "trips": []
                }
            all_order_ids.add(order_id)

    # Get valid batchable orders
    valid_orders = get_pending_batchable_orders(session)
    valid_order_ids = {o.id for o in valid_orders}
    valid_order_map = {o.id: o for o in valid_orders}

    # Check all requested orders are valid
    invalid_orders = all_order_ids - valid_order_ids
    if invalid_orders:
        return {
            "success": False,
            "message": f"Invalid or non-batchable order IDs: {list(invalid_orders)}",
            "orders_processed": 0,
            "trips_created": 0,
            "trips": []
        }

    # Create trips from batches
    created_trips = []
    total_batched = 0

    for batch in batches:
        order_ids = batch.get("order_ids", [])

        if len(order_ids) < 2:
            # Skip single orders - they don't benefit from batching
            continue

        if len(order_ids) > MAX_STOPS_PER_TRIP:
            return {
                "success": False,
                "message": f"Batch exceeds maximum stops ({MAX_STOPS_PER_TRIP}): {order_ids}",
                "orders_processed": 0,
                "trips_created": 0,
                "trips": []
            }

        # Get orders for this batch
        batch_orders = [valid_order_map[oid] for oid in order_ids]

        # Calculate totals
        total_weight = sum(o.total_weight_kg or 0 for o in batch_orders)
        total_volume = sum(o.total_volume or 0 for o in batch_orders)
        total_earnings = sum(o.shipping_cost for o in batch_orders)

        # Determine zone (use first order's zone or mixed)
        zones = set(get_order_h3_zone(o, session) for o in batch_orders)
        zone = zones.pop() if len(zones) == 1 else "mixed"

        # Create trip
        trip = Trip(
            status=TripStatus.PENDING,
            total_weight_kg=total_weight,
            total_volume_m3=total_volume,
            total_earnings=total_earnings,
            h3_zone=zone if zone not in ("unknown", "mixed") else None,
            created_by_id=created_by_id,
        )
        session.add(trip)
        session.commit()
        session.refresh(trip)

        # Create stops for each order
        for sequence, order in enumerate(batch_orders, start=1):
            stop = TripStop(
                trip_id=trip.id,
                order_id=order.id,
                sequence=sequence,
                status=StopStatus.PENDING,
            )
            session.add(stop)

            # Update order to link to trip
            order.trip_id = trip.id
            order.updated_at = datetime.now(timezone.utc)
            session.add(order)

        session.commit()
        created_trips.append(trip)
        total_batched += len(batch_orders)

    return {
        "success": True,
        "message": f"Created {len(created_trips)} trips from {total_batched} orders",
        "orders_processed": total_batched,
        "trips_created": len(created_trips),
        "trips": [
            {
                "id": t.id,
                "zone": t.h3_zone,
                "stops": len(t.stops),
                "total_weight_kg": t.total_weight_kg,
                "total_earnings": t.total_earnings,
            }
            for t in created_trips
        ]
    }
