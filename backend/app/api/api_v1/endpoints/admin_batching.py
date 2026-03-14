"""
Admin endpoints for order batching and trip management.
"""
from datetime import datetime, timezone
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, func

from app.database import get_session
from app.core.security import get_current_admin_user, get_current_staff_user
from app.models.user import User, UserRole
from app.models.order import Order, OrderStatus, OrderWithItems, OrderItemRead, UserInfo
from app.models.trip import (
    Trip, TripStop, TripStatus, StopStatus,
    TripRead, TripWithStops, TripStopRead, TripUpdate
)
from app.models.driver import Driver, DriverVehicle, DriverStatus
from app.models.product import Product
from app.services.batching_service import (
    run_batching, preview_batching, set_order_full_load_status,
    get_pending_orders_with_details, create_trips_from_custom_batches
)
from app.services.smart_batching_service import (
    SmartBatchingService, preview_smart_batching, run_smart_batching
)
from sqlmodel import SQLModel


router = APIRouter()


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def build_trip_read(trip: Trip, session: Session) -> TripRead:
    """Build TripRead from Trip model."""
    # Count stops
    total_stops = len(trip.stops) if trip.stops else 0
    completed_stops = sum(1 for s in trip.stops if s.status == StopStatus.DELIVERED) if trip.stops else 0

    # Get driver info
    driver_name = None
    driver_phone = None
    if trip.driver_id:
        driver_user = session.get(User, trip.driver_id)
        if driver_user:
            driver_name = driver_user.full_name
            driver_phone = driver_user.phone

    return TripRead(
        id=trip.id,
        driver_id=trip.driver_id,
        status=trip.status,
        total_weight_kg=trip.total_weight_kg,
        total_volume_m3=trip.total_volume_m3,
        estimated_distance_km=trip.estimated_distance_km,
        estimated_duration_min=trip.estimated_duration_min,
        h3_zone=trip.h3_zone,
        total_earnings=trip.total_earnings,
        created_at=trip.created_at,
        updated_at=trip.updated_at,
        assigned_at=trip.assigned_at,
        started_at=trip.started_at,
        completed_at=trip.completed_at,
        total_stops=total_stops,
        completed_stops=completed_stops,
        driver_name=driver_name,
        driver_phone=driver_phone,
    )


def build_trip_with_stops(trip: Trip, session: Session) -> TripWithStops:
    """Build TripWithStops from Trip model."""
    trip_read = build_trip_read(trip, session)

    stops = []
    for stop in sorted(trip.stops, key=lambda s: s.sequence):
        order = session.get(Order, stop.order_id)
        customer_name = None
        shipping_address = None
        contact_phone = None
        order_total = None

        if order:
            if order.user:
                customer_name = order.user.full_name
            shipping_address = order.shipping_address
            contact_phone = order.contact_phone
            order_total = order.total_amount

        stops.append(TripStopRead(
            id=stop.id,
            trip_id=stop.trip_id,
            order_id=stop.order_id,
            sequence=stop.sequence,
            status=stop.status,
            estimated_arrival=stop.estimated_arrival,
            arrived_at=stop.arrived_at,
            delivered_at=stop.delivered_at,
            notes=stop.notes,
            customer_name=customer_name,
            shipping_address=shipping_address,
            contact_phone=contact_phone,
            order_total=order_total,
        ))

    return TripWithStops(
        **trip_read.model_dump(),
        stops=stops,
    )


# =============================================================================
# BATCHING ENDPOINTS
# =============================================================================

class BatchingPreviewResponse(SQLModel):
    """Response for batching preview"""
    orders_available: int
    proposed_trips: list[dict]
    orders_to_batch: int
    unbatched_orders: int


class BatchingRunResponse(SQLModel):
    """Response for batching run"""
    success: bool
    message: str
    orders_processed: int
    trips_created: int
    trips: list[dict]


@router.get("/preview", response_model=BatchingPreviewResponse)
def preview_order_batching(
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Preview what batching would do without creating trips.
    Shows proposed trip groupings.
    """
    result = preview_batching(session)
    return result


@router.post("/run", response_model=BatchingRunResponse)
def run_order_batching(
    current_user: User = Depends(get_current_admin_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Run the batching algorithm to create trips from pending orders.
    Groups STANDARD delivery orders by zone (max 3 per trip).
    """
    result = run_batching(session, created_by_id=current_user.id)
    return result


# =============================================================================
# SMART BATCHING ENDPOINTS (Corridor-based, capacity-aware)
# =============================================================================

class SmartBatchingParams(SQLModel):
    """Parameters for smart batching algorithm"""
    strategy: str = "nearest_first"  # or "farthest_first"
    max_weight_per_batch: Optional[float] = None
    max_orders_per_batch: Optional[int] = None


@router.get("/smart-preview")
def preview_smart_order_batching(
    strategy: str = "nearest_first",
    max_weight: Optional[float] = None,
    max_orders: Optional[int] = None,
    simulation_limit: Optional[int] = None,
    corridor_filter: Optional[str] = None,
    max_capacity_percent: float = 90.0,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Preview smart corridor-based batching.

    Parameters:
    - strategy: "nearest_first" (recommended) or "farthest_first"
    - max_weight: Maximum weight per batch in kg (default: smallest driver capacity)
    - max_orders: Maximum orders per batch (default: unlimited)
    - simulation_limit: Limit orders for simulation/testing
    - corridor_filter: Only batch orders from this specific corridor
    - max_capacity_percent: Max % of vehicle capacity to use (default: 90%)

    Uses SMART selection:
    - Groups orders by corridor (road name)
    - Sorts by distance
    - Excludes orders where extra distance isn't worth the weight gain
    - Skips orders that are too far for their weight
    """
    result = preview_smart_batching(
        session,
        strategy=strategy,
        max_weight_per_batch=max_weight,
        max_orders_per_batch=max_orders,
        simulation_limit=simulation_limit,
        corridor_filter=corridor_filter,
        max_capacity_percent=max_capacity_percent
    )
    return result


@router.post("/smart-run")
def run_smart_order_batching(
    strategy: str = "nearest_first",
    max_weight: Optional[float] = None,
    max_orders: Optional[int] = None,
    corridor_filter: Optional[str] = None,
    max_capacity_percent: float = 90.0,
    current_user: User = Depends(get_current_admin_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Run smart corridor-based batching and create trips.

    Parameters:
    - strategy: "nearest_first" (recommended) or "farthest_first"
    - max_weight: Maximum weight per batch in kg
    - max_orders: Maximum orders per batch
    - corridor_filter: Only batch orders from this specific corridor
    - max_capacity_percent: Max % of vehicle capacity to use (default: 90%)

    Uses SMART selection to create optimized trips:
    - Groups orders on the same road
    - Sorts by distance (nearest first = efficient routing)
    - Excludes inefficient orders (too far for their weight)
    - Respects driver vehicle capacity
    - Assigns drivers automatically
    """
    result = run_smart_batching(
        session,
        created_by_id=current_user.id,
        strategy=strategy,
        max_weight_per_batch=max_weight,
        max_orders_per_batch=max_orders,
        corridor_filter=corridor_filter,
        max_capacity_percent=max_capacity_percent
    )
    return result


@router.get("/smart-drivers")
def get_available_drivers_for_batching(
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get available drivers with their vehicle capacity.
    Useful for planning batches manually.
    """
    service = SmartBatchingService(session)
    drivers = service.get_active_drivers()

    return {
        "drivers": [
            {
                "id": d.driver_id,
                "name": d.driver_name,
                "phone": d.phone,
                "capacity_kg": d.capacity_kg,
                "vehicle_type": d.vehicle_type,
            }
            for d in drivers
        ],
        "total": len(drivers),
        "min_capacity_kg": min(d.capacity_kg for d in drivers) if drivers else 0,
        "max_capacity_kg": max(d.capacity_kg for d in drivers) if drivers else 0,
    }


# =============================================================================
# PENDING ORDERS ENDPOINT
# =============================================================================

class PendingOrderResponse(SQLModel):
    """Response for a pending batchable order"""
    id: int
    customer_name: str
    address: Optional[str]
    zone: str
    shipping_cost: float
    weight_kg: float
    created_at: Optional[str]


class PendingOrdersListResponse(SQLModel):
    """Response for listing pending orders"""
    orders: List[dict]
    total: int


@router.get("/orders", response_model=PendingOrdersListResponse)
def get_pending_orders(
    limit: Optional[int] = None,
    random_sample: bool = False,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get all pending batchable orders for the drag-drop UI.
    Returns orders that can be grouped into trips.

    Parameters:
    - limit: Maximum number of orders to return (for simulation)
    - random_sample: If True with limit, returns random orders instead of first N
    """
    orders = get_pending_orders_with_details(session, limit=limit, random_sample=random_sample)
    return {
        "orders": orders,
        "total": len(orders)
    }


# =============================================================================
# CUSTOM BATCHING ENDPOINT
# =============================================================================

class CustomBatch(SQLModel):
    """A single batch definition"""
    order_ids: List[int]


class CustomBatchingRequest(SQLModel):
    """Request to create trips from custom batches"""
    batches: List[CustomBatch]


@router.post("/run-custom", response_model=BatchingRunResponse)
def run_custom_batching(
    request: CustomBatchingRequest,
    current_user: User = Depends(get_current_admin_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Create trips from custom user-defined batches.
    Allows admins to manually group orders before creating trips.

    Rules:
    - Each batch must have 2-3 orders
    - Same order cannot appear in multiple batches
    - All orders must be valid pending batchable orders
    """
    batches = [{"order_ids": b.order_ids} for b in request.batches]
    result = create_trips_from_custom_batches(batches, session, created_by_id=current_user.id)

    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("message", "Custom batching failed")
        )

    return result


# =============================================================================
# TRIP MANAGEMENT ENDPOINTS
# =============================================================================

@router.get("/trips", response_model=List[TripRead])
def list_trips(
    status_filter: Optional[TripStatus] = None,
    driver_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    List all trips with optional filtering.
    """
    query = select(Trip)

    if status_filter:
        query = query.where(Trip.status == status_filter)

    if driver_id:
        query = query.where(Trip.driver_id == driver_id)

    query = query.order_by(Trip.created_at.desc()).offset(skip).limit(limit)
    trips = session.exec(query).all()

    return [build_trip_read(t, session) for t in trips]


@router.get("/trips/{trip_id}", response_model=TripWithStops)
def get_trip(
    trip_id: int,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get a specific trip with all stops.
    """
    trip = session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found"
        )

    return build_trip_with_stops(trip, session)


class AssignTripRequest(SQLModel):
    """Request to assign trip to driver"""
    driver_id: int


class AssignTripResponse(SQLModel):
    """Response after assigning trip"""
    success: bool
    message: str
    trip: Optional[TripWithStops] = None


@router.post("/trips/{trip_id}/assign", response_model=AssignTripResponse)
def assign_trip_to_driver(
    trip_id: int,
    assign_request: AssignTripRequest,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Assign a trip to a driver.
    """
    trip = session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found"
        )

    if trip.status != TripStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot assign trip with status: {trip.status}"
        )

    # Get driver
    driver_user = session.get(User, assign_request.driver_id)
    if not driver_user or driver_user.role != UserRole.DRIVER:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found"
        )

    driver = session.exec(
        select(Driver).where(Driver.user_id == driver_user.id)
    ).first()

    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver record not found"
        )

    if driver.status == DriverStatus.SUSPENDED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot assign to suspended driver"
        )

    # Check vehicle capacity
    primary_vehicle = session.exec(
        select(DriverVehicle)
        .where(DriverVehicle.driver_id == driver.id)
        .where(DriverVehicle.is_primary == True)
        .where(DriverVehicle.is_active == True)
    ).first()

    if primary_vehicle and primary_vehicle.capacity_kg:
        if trip.total_weight_kg > primary_vehicle.capacity_kg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Trip weight ({trip.total_weight_kg}kg) exceeds vehicle capacity ({primary_vehicle.capacity_kg}kg)"
            )

    now = datetime.now(timezone.utc)

    # Assign trip
    trip.driver_id = driver_user.id
    trip.status = TripStatus.ASSIGNED
    trip.assigned_at = now
    trip.updated_at = now
    session.add(trip)

    # Update all orders in the trip
    for stop in trip.stops:
        order = session.get(Order, stop.order_id)
        if order:
            order.driver_id = driver_user.id
            order.status = OrderStatus.ASSIGNED
            order.assigned_at = now
            order.updated_at = now
            session.add(order)

    # Update driver status
    if driver.status == DriverStatus.AVAILABLE:
        driver.status = DriverStatus.BUSY
        driver.updated_at = now
        session.add(driver)

    session.commit()
    session.refresh(trip)

    return AssignTripResponse(
        success=True,
        message=f"Trip assigned to {driver_user.full_name}",
        trip=build_trip_with_stops(trip, session)
    )


@router.post("/trips/{trip_id}/unassign", response_model=AssignTripResponse)
def unassign_trip(
    trip_id: int,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Unassign a trip from driver (return to pool).
    """
    trip = session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found"
        )

    if trip.driver_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Trip is not assigned to any driver"
        )

    if trip.status in [TripStatus.COMPLETED, TripStatus.CANCELLED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot unassign trip with status: {trip.status}"
        )

    old_driver_id = trip.driver_id
    now = datetime.now(timezone.utc)

    # Unassign trip
    trip.driver_id = None
    trip.status = TripStatus.PENDING
    trip.assigned_at = None
    trip.started_at = None
    trip.updated_at = now
    session.add(trip)

    # Update all orders in the trip
    for stop in trip.stops:
        order = session.get(Order, stop.order_id)
        if order:
            order.driver_id = None
            order.status = OrderStatus.CONFIRMED
            order.assigned_at = None
            order.picked_up_at = None
            order.in_transit_at = None
            order.updated_at = now
            session.add(order)

        # Reset stop status
        stop.status = StopStatus.PENDING
        stop.arrived_at = None
        stop.delivered_at = None
        session.add(stop)

    session.commit()

    # Update old driver status if no more active orders
    if old_driver_id:
        driver = session.exec(
            select(Driver).where(Driver.user_id == old_driver_id)
        ).first()

        if driver:
            active_count = session.exec(
                select(func.count(Order.id))
                .where(Order.driver_id == old_driver_id)
                .where(Order.status.in_([OrderStatus.ASSIGNED, OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT]))
            ).one() or 0

            if active_count == 0 and driver.status == DriverStatus.BUSY:
                driver.status = DriverStatus.AVAILABLE
                driver.updated_at = now
                session.add(driver)
                session.commit()

    session.refresh(trip)

    return AssignTripResponse(
        success=True,
        message="Trip unassigned and returned to pool",
        trip=build_trip_with_stops(trip, session)
    )


@router.delete("/trips/{trip_id}")
def cancel_trip(
    trip_id: int,
    current_user: User = Depends(get_current_admin_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Cancel a trip and return orders to pool.
    """
    trip = session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found"
        )

    if trip.status == TripStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel a completed trip"
        )

    now = datetime.now(timezone.utc)

    # Return orders to pool
    for stop in trip.stops:
        order = session.get(Order, stop.order_id)
        if order:
            order.trip_id = None
            order.driver_id = None
            order.status = OrderStatus.CONFIRMED
            order.assigned_at = None
            order.picked_up_at = None
            order.in_transit_at = None
            order.updated_at = now
            session.add(order)

    # Update trip status
    trip.status = TripStatus.CANCELLED
    trip.updated_at = now
    session.add(trip)

    session.commit()

    return {"message": "Trip cancelled and orders returned to pool"}


# =============================================================================
# STATISTICS
# =============================================================================

class BatchingStats(SQLModel):
    """Statistics for batching system"""
    pending_batchable_orders: int
    pending_trips: int
    assigned_trips: int
    in_progress_trips: int
    completed_trips_today: int
    total_trips: int


@router.get("/stats", response_model=BatchingStats)
def get_batching_stats(
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get statistics for the batching system.
    """
    from app.models.order import DeliveryType

    # Pending batchable orders
    pending_batchable = session.exec(
        select(func.count(Order.id))
        .where(Order.status == OrderStatus.CONFIRMED)
        .where(Order.driver_id == None)
        .where(Order.trip_id == None)
        .where(Order.delivery_type == DeliveryType.STANDARD)
        .where(Order.is_full_load == False)
    ).one() or 0

    # Trip counts by status
    pending_trips = session.exec(
        select(func.count(Trip.id))
        .where(Trip.status == TripStatus.PENDING)
    ).one() or 0

    assigned_trips = session.exec(
        select(func.count(Trip.id))
        .where(Trip.status == TripStatus.ASSIGNED)
    ).one() or 0

    in_progress_trips = session.exec(
        select(func.count(Trip.id))
        .where(Trip.status == TripStatus.IN_PROGRESS)
    ).one() or 0

    # Today's completed trips
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    completed_today = session.exec(
        select(func.count(Trip.id))
        .where(Trip.status == TripStatus.COMPLETED)
        .where(Trip.completed_at >= today_start)
    ).one() or 0

    total_trips = session.exec(
        select(func.count(Trip.id))
    ).one() or 0

    return BatchingStats(
        pending_batchable_orders=pending_batchable,
        pending_trips=pending_trips,
        assigned_trips=assigned_trips,
        in_progress_trips=in_progress_trips,
        completed_trips_today=completed_today,
        total_trips=total_trips,
    )


# =============================================================================
# RESET ALL TRIPS
# =============================================================================

class ResetTripsResponse(SQLModel):
    """Response for resetting all trips"""
    success: bool
    message: str
    trips_deleted: int
    orders_reset: int


@router.post("/reset", response_model=ResetTripsResponse)
def reset_all_trips(
    current_user: User = Depends(get_current_admin_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Reset all trips and return orders to pending state.
    This deletes all trip_stops, all trips, and resets orders.
    Used to reinitialize the smart batching system.
    Admin only.
    """
    now = datetime.now(timezone.utc)

    # Get all trips (excluding completed ones)
    trips_to_delete = session.exec(
        select(Trip).where(Trip.status != TripStatus.COMPLETED)
    ).all()

    if not trips_to_delete:
        return ResetTripsResponse(
            success=True,
            message="No trips to reset",
            trips_deleted=0,
            orders_reset=0
        )

    trip_ids = [t.id for t in trips_to_delete]
    orders_reset = 0

    # Reset all orders linked to these trips
    orders_to_reset = session.exec(
        select(Order).where(Order.trip_id.in_(trip_ids))
    ).all()

    for order in orders_to_reset:
        order.trip_id = None
        order.driver_id = None
        order.status = OrderStatus.CONFIRMED
        order.assigned_at = None
        order.picked_up_at = None
        order.in_transit_at = None
        order.updated_at = now
        session.add(order)
        orders_reset += 1

    # Delete all trip stops for these trips
    stops_to_delete = session.exec(
        select(TripStop).where(TripStop.trip_id.in_(trip_ids))
    ).all()

    for stop in stops_to_delete:
        session.delete(stop)

    # Delete the trips
    for trip in trips_to_delete:
        session.delete(trip)

    session.commit()

    return ResetTripsResponse(
        success=True,
        message=f"Reset {len(trips_to_delete)} trips and {orders_reset} orders",
        trips_deleted=len(trips_to_delete),
        orders_reset=orders_reset
    )
