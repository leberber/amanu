from datetime import datetime, timezone, timedelta
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select, func, and_, or_

from app.database import get_session
from app.core.security import get_current_user
from app.models.user import User, UserRole
from app.models.order import (
    Order, OrderStatus, OrderRead, OrderWithItems, OrderItemRead,
    UserInfo, DriverInfo, DeliveryType
)
from app.models.driver import (
    Driver, DriverVehicle, DriverStatus, DriverStats,
    DriverEarning, DriverEarningsResponse
)
from app.models.driver_config import DriverSystemConfig
from app.models.shipping import ShippingPriceConfig
from app.models.product import Product
from app.models.trip import Trip, TripStop, TripStatus, TripRead, TripWithStops, TripStopRead, StopStatus
from app.models.customer_route import CustomerRoute
from app.core.config import settings
from sqlmodel import SQLModel
from geoalchemy2.shape import to_shape


router = APIRouter()


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_driver_user(current_user: User, session: Session) -> tuple[User, Driver]:
    """Verify user is a driver and get their driver record"""
    if current_user.role != UserRole.DRIVER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a driver"
        )

    driver = session.exec(
        select(Driver).where(Driver.user_id == current_user.id)
    ).first()

    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver record not found"
        )

    return current_user, driver


def get_active_orders_count(session: Session, driver_id: int) -> int:
    """Compute active orders count from orders table"""
    count = session.exec(
        select(func.count(Order.id))
        .where(Order.driver_id == driver_id)
        .where(Order.status.in_([OrderStatus.ASSIGNED, OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT]))
    ).one()
    return count or 0


def get_system_config(session: Session) -> DriverSystemConfig:
    """Get or create system configuration"""
    config = session.exec(select(DriverSystemConfig)).first()
    if not config:
        config = DriverSystemConfig()
        session.add(config)
        session.commit()
        session.refresh(config)
    return config


def get_shipping_config(session: Session) -> ShippingPriceConfig:
    """Get shipping price config (default warehouse)"""
    config = session.exec(
        select(ShippingPriceConfig).where(ShippingPriceConfig.warehouse_id == "default")
    ).first()
    if not config:
        # Create default config if not exists
        config = ShippingPriceConfig(warehouse_id="default")
        session.add(config)
        session.commit()
        session.refresh(config)
    return config


def order_to_response(order: Order, session: Session) -> OrderWithItems:
    """Convert Order to OrderWithItems response"""
    # Get user info
    user_info = None
    if order.user:
        user_info = UserInfo(
            id=order.user.id,
            full_name=order.user.full_name,
            email=order.user.email,
            store_name=order.user.store_name,
            daira=order.user.daira,
            commune=order.user.commune
        )

    # Get driver info
    driver_info = None
    if order.driver:
        vehicle_type = None
        # Get primary vehicle from driver's vehicles
        if order.driver.driver:
            primary_vehicle = session.exec(
                select(DriverVehicle)
                .where(DriverVehicle.driver_id == order.driver.driver.id)
                .where(DriverVehicle.is_primary == True)
            ).first()
            if primary_vehicle:
                vehicle_type = primary_vehicle.vehicle_type
        driver_info = DriverInfo(
            id=order.driver.id,
            full_name=order.driver.full_name,
            phone=order.driver.phone,
            vehicle_type=vehicle_type
        )

    # Get items
    items = [
        OrderItemRead(
            id=item.id,
            order_id=item.order_id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=item.unit_price,
            product_name=item.product_name,
            product_unit=item.product_unit,
            pieces_per_box=item.pieces_per_box
        )
        for item in order.items
    ]

    # Calculate total weight and volume from products
    total_weight = 0.0
    total_volume = 0.0
    if order.items:
        product_ids = [item.product_id for item in order.items]
        products = session.exec(
            select(Product).where(Product.id.in_(product_ids))
        ).all()
        product_map = {p.id: p for p in products}
        for item in order.items:
            product = product_map.get(item.product_id)
            if product:
                if product.weight:
                    total_weight += product.weight * item.quantity
                if product.volume:
                    total_volume += product.volume * item.quantity

    return OrderWithItems(
        id=order.id,
        user_id=order.user_id,
        status=order.status,
        shipping_address=order.shipping_address,
        contact_phone=order.contact_phone,
        total_amount=order.total_amount,
        subtotal=order.subtotal,
        discount_amount=order.discount_amount,
        shipping_cost=order.shipping_cost,
        promotion_id=order.promotion_id,
        cross_sell_discount_amount=order.cross_sell_discount_amount,
        volume_discount_amount=order.volume_discount_amount,
        created_at=order.created_at,
        updated_at=order.updated_at,
        user=user_info,
        driver_id=order.driver_id,
        driver=driver_info,
        assigned_at=order.assigned_at,
        assignment_expires_at=order.assignment_expires_at,
        picked_up_at=order.picked_up_at,
        in_transit_at=order.in_transit_at,
        delivered_at=order.delivered_at,
        delivery_notes=order.delivery_notes,
        estimated_delivery_minutes=order.estimated_delivery_minutes,
        actual_delivery_minutes=order.actual_delivery_minutes,
        items=items,
        promotion_info=None,
        total_weight=total_weight if total_weight > 0 else None,
        total_volume=total_volume if total_volume > 0 else None
    )


# =============================================================================
# BATCHED TRIPS (Multi-stop trips from smart batching)
# =============================================================================

def trip_to_response(trip: Trip, session: Session) -> TripWithStops:
    """Convert Trip to TripWithStops response with all details."""
    # Get driver info
    driver_name = None
    driver_phone = None
    if trip.driver_id:
        driver_user = session.get(User, trip.driver_id)
        if driver_user:
            driver_name = driver_user.full_name
            driver_phone = driver_user.phone

    # Get suggested driver info
    suggested_driver_name = None
    if trip.suggested_driver_id:
        suggested_user = session.get(User, trip.suggested_driver_id)
        if suggested_user:
            suggested_driver_name = suggested_user.full_name

    # Get stops with order details, sorted by sequence
    stops_read = []
    completed_stops = 0
    all_route_coords = []

    # Sort stops by sequence for proper route order
    sorted_stops = sorted(trip.stops, key=lambda s: s.sequence)

    # Build route using actual road polylines from customer_routes
    # Strategy: For multi-stop trips, combine depot→customer routes intelligently
    # 1. First stop: use full depot → stop1 polyline
    # 2. Subsequent stops: find closest point in their route to previous stop, use from there

    # First, collect all route polylines for stops
    stop_routes = []  # List of (user_id, lat, lng, route_coords)

    for stop in sorted_stops:
        order = session.get(Order, stop.order_id)
        customer_name = None
        shipping_address = None
        contact_phone = None
        order_total = None
        latitude = None
        longitude = None
        route_coords = None

        if order:
            customer_name = order.user.full_name if order.user else None
            shipping_address = order.shipping_address
            contact_phone = order.contact_phone
            order_total = float(order.total_amount) if order.total_amount else None

            if order.user:
                latitude = order.user.latitude
                longitude = order.user.longitude

                # Get route polyline for this customer
                customer_route = session.exec(
                    select(CustomerRoute).where(CustomerRoute.user_id == order.user.id)
                ).first()

                if customer_route and customer_route.route_geom:
                    try:
                        shape = to_shape(customer_route.route_geom)
                        # Convert [(lng, lat), ...] to [[lat, lng], ...]
                        route_coords = [[coord[1], coord[0]] for coord in shape.coords]
                    except Exception:
                        route_coords = None

                stop_routes.append({
                    'lat': latitude,
                    'lng': longitude,
                    'route': route_coords
                })

        if stop.status == StopStatus.DELIVERED:
            completed_stops += 1

        stops_read.append(TripStopRead(
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
            latitude=latitude,
            longitude=longitude,
        ))

    # Build combined route from all stop routes
    # Helper function to find closest point index in a route to a given location
    def find_closest_point_index(route: list, target_lat: float, target_lng: float) -> int:
        min_dist = float('inf')
        min_idx = 0
        for i, coord in enumerate(route):
            # Simple euclidean distance (sufficient for nearby points)
            dist = (coord[0] - target_lat) ** 2 + (coord[1] - target_lng) ** 2
            if dist < min_dist:
                min_dist = dist
                min_idx = i
        return min_idx

    prev_lat = settings.DEPOT_LATITUDE
    prev_lng = settings.DEPOT_LONGITUDE

    for i, stop_data in enumerate(stop_routes):
        route = stop_data.get('route')
        lat = stop_data.get('lat')
        lng = stop_data.get('lng')

        if route and len(route) > 0:
            if i == 0:
                # First stop: use full depot → stop route
                all_route_coords.extend(route)
            else:
                # Subsequent stops: find closest point to previous stop, use from there
                closest_idx = find_closest_point_index(route, prev_lat, prev_lng)
                # Use route from closest point to the end (customer location)
                segment = route[closest_idx:]
                if len(segment) > 0:
                    all_route_coords.extend(segment)
                elif lat and lng:
                    # Fallback: straight line
                    all_route_coords.append([lat, lng])
        else:
            # No route data - use straight line
            if i == 0:
                all_route_coords.append([settings.DEPOT_LATITUDE, settings.DEPOT_LONGITUDE])
            if lat and lng:
                all_route_coords.append([lat, lng])

        # Update previous location for next iteration
        if lat and lng:
            prev_lat = lat
            prev_lng = lng

    return TripWithStops(
        id=trip.id,
        driver_id=trip.driver_id,
        suggested_driver_id=trip.suggested_driver_id,
        status=trip.status,
        corridor=trip.corridor,
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
        picked_up_at=trip.picked_up_at,
        completed_at=trip.completed_at,
        cancelled_at=trip.cancelled_at,
        total_stops=len(trip.stops),
        completed_stops=completed_stops,
        driver_name=driver_name,
        driver_phone=driver_phone,
        suggested_driver_name=suggested_driver_name,
        stops=stops_read,
        route_coords=all_route_coords,
    )


@router.get("/batched/pending", response_model=List[TripWithStops])
def get_pending_batched_trips(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get all pending batched trips.
    Returns all trips with status PENDING that are available for drivers to accept.
    """
    user, driver = get_driver_user(current_user, session)

    # Check if driver is available
    if driver.status == DriverStatus.SUSPENDED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Driver account is suspended"
        )

    # Get ALL pending trips (drivers can see and accept any pending trip)
    trips = session.exec(
        select(Trip)
        .where(Trip.status == TripStatus.PENDING)
        .order_by(Trip.created_at.desc())
    ).all()

    return [trip_to_response(trip, session) for trip in trips]


class AcceptBatchedTripResponse(SQLModel):
    """Response after accepting a batched trip"""
    success: bool
    message: str
    trip: Optional[TripWithStops] = None


@router.post("/batched/{trip_id}/accept", response_model=AcceptBatchedTripResponse)
def accept_batched_trip(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Accept a batched trip (multi-stop delivery).
    Assigns the driver to the trip and all its orders.
    """
    user, driver = get_driver_user(current_user, session)
    config = get_system_config(session)

    # Verify driver can accept trips
    if driver.status == DriverStatus.SUSPENDED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Driver account is suspended"
        )

    # Get trip
    trip = session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found"
        )

    # Verify trip is pending
    if trip.status != TripStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Trip is not available (status: {trip.status})"
        )

    # Note: Any driver can accept any pending trip, even if suggested to another driver
    # The suggested_driver_id is just a recommendation, not a restriction

    now = datetime.now(timezone.utc)

    # Assign trip to driver
    trip.driver_id = user.id
    trip.status = TripStatus.ASSIGNED
    trip.assigned_at = now
    trip.updated_at = now
    session.add(trip)

    # Assign all orders in this trip to the driver
    for stop in trip.stops:
        order = session.get(Order, stop.order_id)
        if order:
            order.driver_id = user.id
            order.status = OrderStatus.ASSIGNED
            order.assigned_at = now
            order.assignment_expires_at = now + timedelta(minutes=config.assignment_timeout_minutes)
            order.updated_at = now
            session.add(order)

    # Update driver status to BUSY
    if driver.status == DriverStatus.AVAILABLE:
        driver.status = DriverStatus.BUSY
        driver.updated_at = now
        session.add(driver)

    session.commit()
    session.refresh(trip)

    return AcceptBatchedTripResponse(
        success=True,
        message=f"Trip accepted with {len(trip.stops)} stops",
        trip=trip_to_response(trip, session)
    )


@router.post("/batched/{trip_id}/start", response_model=AcceptBatchedTripResponse)
def start_batched_trip(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Start a batched trip (multi-stop delivery).
    Changes trip status from ASSIGNED to IN_PROGRESS.
    """
    user, driver = get_driver_user(current_user, session)

    # Get trip
    trip = session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found"
        )

    # Verify trip belongs to this driver
    if trip.driver_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This trip is not assigned to you"
        )

    # Verify trip is assigned (ready to start)
    if trip.status != TripStatus.ASSIGNED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Trip cannot be started (status: {trip.status})"
        )

    now = datetime.now(timezone.utc)

    # Start the trip
    trip.status = TripStatus.IN_PROGRESS
    trip.started_at = now
    trip.updated_at = now
    session.add(trip)

    # Update all orders to IN_TRANSIT
    for stop in trip.stops:
        order = session.get(Order, stop.order_id)
        if order:
            order.status = OrderStatus.IN_TRANSIT
            order.updated_at = now
            session.add(order)

    session.commit()
    session.refresh(trip)

    return AcceptBatchedTripResponse(
        success=True,
        message="Trip started",
        trip=trip_to_response(trip, session)
    )


@router.post("/batched/{trip_id}/pickup", response_model=AcceptBatchedTripResponse)
def pickup_batched_trip(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Mark orders as picked up from warehouse.
    Driver must be at warehouse and have collected all packages.
    """
    user, driver = get_driver_user(current_user, session)

    # Get trip
    trip = session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found"
        )

    # Verify trip belongs to this driver
    if trip.driver_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This trip is not assigned to you"
        )

    # Verify trip is in progress (started)
    if trip.status != TripStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Trip must be in progress to pickup (status: {trip.status})"
        )

    # Verify not already picked up
    if trip.picked_up_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Orders already picked up"
        )

    now = datetime.now(timezone.utc)

    # Mark as picked up
    trip.picked_up_at = now
    trip.updated_at = now
    session.add(trip)

    # Update all orders to PICKED_UP status
    for stop in trip.stops:
        order = session.get(Order, stop.order_id)
        if order:
            order.status = OrderStatus.PICKED_UP
            order.picked_up_at = now
            order.updated_at = now
            session.add(order)

    session.commit()
    session.refresh(trip)

    return AcceptBatchedTripResponse(
        success=True,
        message=f"Picked up {len(trip.stops)} orders from warehouse",
        trip=trip_to_response(trip, session)
    )


class CancelBatchedTripRequest(SQLModel):
    """Request body for cancelling a batched trip"""
    reason: Optional[str] = None


@router.post("/batched/{trip_id}/cancel", response_model=AcceptBatchedTripResponse)
def cancel_batched_trip(
    trip_id: int,
    cancel_request: Optional[CancelBatchedTripRequest] = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Cancel an accepted batched trip (unaccept).
    Returns the trip to PENDING status so other drivers can accept it.
    Only works for ASSIGNED trips (not started yet).
    """
    user, driver = get_driver_user(current_user, session)

    # Get trip
    trip = session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found"
        )

    # Verify trip belongs to this driver
    if trip.driver_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This trip is not assigned to you"
        )

    # Can only cancel if trip is ASSIGNED (accepted but not started)
    if trip.status != TripStatus.ASSIGNED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel trip (status: {trip.status}). Only assigned trips can be cancelled."
        )

    now = datetime.now(timezone.utc)

    # Return trip to PENDING status
    trip.status = TripStatus.PENDING
    trip.driver_id = None
    trip.assigned_at = None
    trip.updated_at = now
    session.add(trip)

    # Return all orders to CONFIRMED status (back to pool)
    for stop in trip.stops:
        order = session.get(Order, stop.order_id)
        if order:
            order.driver_id = None
            order.status = OrderStatus.CONFIRMED
            order.assigned_at = None
            order.assignment_expires_at = None
            order.updated_at = now
            session.add(order)

    # Update driver status to AVAILABLE if no other active trips
    active_trips_count = session.exec(
        select(func.count(Trip.id)).where(
            Trip.driver_id == user.id,
            Trip.status.in_([TripStatus.ASSIGNED, TripStatus.IN_PROGRESS])
        )
    ).one()

    if active_trips_count == 0 and driver.status == DriverStatus.BUSY:
        driver.status = DriverStatus.AVAILABLE
        driver.updated_at = now
        session.add(driver)

    session.commit()

    return AcceptBatchedTripResponse(
        success=True,
        message=f"Trip cancelled. {len(trip.stops)} orders returned to pool.",
        trip=None
    )


@router.post("/batched/{trip_id}/complete", response_model=AcceptBatchedTripResponse)
def complete_batched_trip(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Complete a batched trip (multi-stop delivery).
    All stops must be delivered before completing.
    """
    user, driver = get_driver_user(current_user, session)

    # Get trip
    trip = session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found"
        )

    # Verify trip belongs to this driver
    if trip.driver_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This trip is not assigned to you"
        )

    # Verify trip is in progress
    if trip.status != TripStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Trip cannot be completed (status: {trip.status})"
        )

    # Verify all stops are delivered
    for stop in trip.stops:
        if stop.status != StopStatus.DELIVERED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="All stops must be delivered before completing the trip"
            )

    now = datetime.now(timezone.utc)

    # Complete the trip
    trip.status = TripStatus.COMPLETED
    trip.completed_at = now
    trip.updated_at = now
    session.add(trip)

    # Update all orders to DELIVERED
    for stop in trip.stops:
        order = session.get(Order, stop.order_id)
        if order:
            order.status = OrderStatus.DELIVERED
            order.delivered_at = now
            order.updated_at = now
            session.add(order)

    # Update driver status to AVAILABLE if no other active trips
    active_trips_count = session.exec(
        select(func.count(Trip.id)).where(
            Trip.driver_id == user.id,
            Trip.status == TripStatus.IN_PROGRESS
        )
    ).one()

    if active_trips_count == 0 and driver.status == DriverStatus.BUSY:
        driver.status = DriverStatus.AVAILABLE
        driver.updated_at = now
        session.add(driver)

    session.commit()
    session.refresh(trip)

    return AcceptBatchedTripResponse(
        success=True,
        message="Trip completed",
        trip=trip_to_response(trip, session)
    )


class UpdateStopStatusRequest(SQLModel):
    """Request body for updating stop status"""
    status: StopStatus
    notes: Optional[str] = None


@router.put("/batched/{trip_id}/stops/{stop_id}", response_model=AcceptBatchedTripResponse)
def update_batched_stop_status(
    trip_id: int,
    stop_id: int,
    request: UpdateStopStatusRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Update the status of a stop within a batched trip.
    Valid transitions: pending -> arrived -> delivered
    """
    user, driver = get_driver_user(current_user, session)

    # Get trip
    trip = session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found"
        )

    # Verify trip belongs to this driver
    if trip.driver_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This trip is not assigned to you"
        )

    # Verify trip is in progress
    if trip.status != TripStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Trip must be in progress to update stops"
        )

    # Verify orders have been picked up
    if not trip.picked_up_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Orders must be picked up before marking stops"
        )

    # Find the stop
    stop = session.get(TripStop, stop_id)
    if not stop or stop.trip_id != trip_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stop not found"
        )

    # Validate status transition
    valid_transitions = {
        StopStatus.PENDING: [StopStatus.ARRIVED],
        StopStatus.ARRIVED: [StopStatus.DELIVERED],
        StopStatus.DELIVERED: [],  # Cannot change from delivered
    }

    if request.status not in valid_transitions.get(stop.status, []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status transition from {stop.status} to {request.status}"
        )

    now = datetime.now(timezone.utc)

    # Update stop status
    stop.status = request.status
    stop.notes = request.notes

    if request.status == StopStatus.ARRIVED:
        stop.arrived_at = now
    elif request.status == StopStatus.DELIVERED:
        stop.delivered_at = now
        # Update order status to DELIVERED
        order = session.get(Order, stop.order_id)
        if order:
            order.status = OrderStatus.DELIVERED
            order.delivered_at = now
            order.updated_at = now
            session.add(order)

    session.add(stop)
    session.commit()

    # Refresh the stop to get updated status
    session.refresh(stop)
    # Expire the trip's stops relationship to reload fresh data
    session.expire(trip, ['stops'])
    session.refresh(trip)

    return AcceptBatchedTripResponse(
        success=True,
        message=f"Stop marked as {request.status}",
        trip=trip_to_response(trip, session)
    )


class DeclineBatchedTripRequest(SQLModel):
    """Request body for declining a batched trip"""
    reason: Optional[str] = None


@router.post("/batched/{trip_id}/decline", response_model=AcceptBatchedTripResponse)
def decline_batched_trip(
    trip_id: int,
    decline_request: Optional[DeclineBatchedTripRequest] = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Decline a batched trip.
    Cancels the trip and returns all orders to pending status.
    """
    user, driver = get_driver_user(current_user, session)

    # Get trip
    trip = session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found"
        )

    # Verify trip is pending and suggested to this driver
    if trip.status != TripStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Trip is not pending (status: {trip.status})"
        )

    if trip.suggested_driver_id and trip.suggested_driver_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This trip is not suggested to you"
        )

    now = datetime.now(timezone.utc)

    # Return all orders to pending status (CONFIRMED, no driver, no trip)
    for stop in trip.stops:
        order = session.get(Order, stop.order_id)
        if order:
            order.driver_id = None
            order.trip_id = None
            order.status = OrderStatus.CONFIRMED
            order.assigned_at = None
            order.assignment_expires_at = None
            order.updated_at = now
            session.add(order)

    # Cancel the trip
    trip.status = TripStatus.CANCELLED
    trip.cancelled_at = now
    trip.updated_at = now
    session.add(trip)

    session.commit()

    return AcceptBatchedTripResponse(
        success=True,
        message=f"Trip declined. {len(trip.stops)} orders returned to pending.",
        trip=None
    )


@router.get("/batched/active", response_model=List[TripWithStops])
def get_active_batched_trips(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get driver's active batched trips (ASSIGNED or IN_PROGRESS).
    """
    user, driver = get_driver_user(current_user, session)

    trips = session.exec(
        select(Trip)
        .where(Trip.driver_id == user.id)
        .where(Trip.status.in_([TripStatus.ASSIGNED, TripStatus.IN_PROGRESS]))
        .order_by(Trip.assigned_at.desc())
    ).all()

    return [trip_to_response(trip, session) for trip in trips]


@router.get("/batched/{trip_id}", response_model=TripWithStops)
def get_batched_trip_detail(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get details of a specific batched trip.
    """
    user, driver = get_driver_user(current_user, session)

    trip = session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found"
        )

    # Allow viewing if:
    # 1. Trip is pending (any driver can view pending trips)
    # 2. Trip is assigned to this driver
    is_pending = trip.status == TripStatus.PENDING
    is_assigned_to_me = trip.driver_id == user.id

    if not is_pending and not is_assigned_to_me:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Trip not available to you"
        )

    return trip_to_response(trip, session)


# =============================================================================
# AVAILABLE TRIPS
# =============================================================================

@router.get("/available", response_model=List[OrderWithItems])
def get_available_trips(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get available orders for driver to accept (individual pickup).
    Only returns PRIORITY delivery orders - these are urgent and need immediate pickup.
    STANDARD orders must be batched by admin first and appear in /batched/pending.
    """
    user, driver = get_driver_user(current_user, session)

    # Check if driver is available
    if driver.status == DriverStatus.SUSPENDED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Driver account is suspended"
        )

    # Check if driver has reached max active orders
    active_count = get_active_orders_count(session, user.id)
    if active_count >= driver.max_active_orders:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum active orders ({driver.max_active_orders}) reached"
        )

    # Get PRIORITY orders only - these are urgent and available for immediate pickup
    # STANDARD orders must wait for admin batching
    orders = session.exec(
        select(Order)
        .where(Order.status == OrderStatus.CONFIRMED)
        .where(Order.driver_id == None)
        .where(Order.trip_id == None)  # Exclude orders already in a trip
        .where(Order.delivery_type == DeliveryType.PRIORITY)  # Only PRIORITY for individual pickup
        .order_by(Order.created_at.asc())
    ).all()

    return [order_to_response(order, session) for order in orders]


# =============================================================================
# ACCEPT TRIP
# =============================================================================

class AcceptTripResponse(SQLModel):
    """Response after accepting a trip"""
    success: bool
    message: str
    order: Optional[OrderWithItems] = None


@router.post("/{order_id}/accept", response_model=AcceptTripResponse)
def accept_trip(
    order_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Accept an available order (self-assign from pool).
    """
    user, driver = get_driver_user(current_user, session)
    config = get_system_config(session)

    # Verify driver can accept orders
    if driver.status == DriverStatus.SUSPENDED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Driver account is suspended"
        )

    if not config.allow_driver_self_assign:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Self-assignment is not allowed. Contact admin."
        )

    active_count = get_active_orders_count(session, user.id)
    if active_count >= driver.max_active_orders:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum active orders ({driver.max_active_orders}) reached"
        )

    # Get order
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    # Verify order is available
    if order.status != OrderStatus.CONFIRMED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Order is not available (status: {order.status})"
        )

    if order.driver_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order already assigned to another driver"
        )

    # Assign order to driver
    now = datetime.now(timezone.utc)
    order.driver_id = user.id
    order.status = OrderStatus.ASSIGNED
    order.assigned_at = now
    order.assignment_expires_at = now + timedelta(minutes=config.assignment_timeout_minutes)
    order.updated_at = now

    # Update driver status to BUSY (will have at least one active order now)
    if driver.status == DriverStatus.AVAILABLE:
        driver.status = DriverStatus.BUSY
        driver.updated_at = now
        session.add(driver)

    session.add(order)
    session.commit()
    session.refresh(order)

    return AcceptTripResponse(
        success=True,
        message="Order accepted successfully",
        order=order_to_response(order, session)
    )


# =============================================================================
# TRIP STATUS UPDATES
# =============================================================================

class TripStatusUpdate(SQLModel):
    """Request body for trip status updates"""
    notes: Optional[str] = None
    status: Optional[str] = None


@router.post("/{order_id}/status", response_model=AcceptTripResponse)
def update_trip_status(
    order_id: int,
    update: TripStatusUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Generic endpoint to update trip status.
    Accepts status: picked_up, in_transit, delivered
    """
    user, driver = get_driver_user(current_user, session)

    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    if order.driver_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Order not assigned to you"
        )

    now = datetime.now(timezone.utc)
    new_status = update.status.upper() if update.status else None

    if new_status == "PICKED_UP":
        if order.status != OrderStatus.ASSIGNED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot pickup order with status: {order.status}"
            )
        order.status = OrderStatus.PICKED_UP
        order.picked_up_at = now
        message = "Order marked as picked up"

    elif new_status == "IN_TRANSIT":
        if order.status != OrderStatus.PICKED_UP:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot start delivery for order with status: {order.status}"
            )
        order.status = OrderStatus.IN_TRANSIT
        order.in_transit_at = now
        message = "Delivery started"

    elif new_status == "DELIVERED":
        if order.status != OrderStatus.IN_TRANSIT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot complete order with status: {order.status}"
            )
        # Calculate delivery time
        actual_minutes = None
        if order.assigned_at:
            assigned_at = order.assigned_at
            if assigned_at.tzinfo is None:
                assigned_at = assigned_at.replace(tzinfo=timezone.utc)
            delta = now - assigned_at
            actual_minutes = int(delta.total_seconds() / 60)

        order.status = OrderStatus.DELIVERED
        order.delivered_at = now
        order.actual_delivery_minutes = actual_minutes

        # Update driver status if no more active orders
        active_count = get_active_orders_count(session, user.id) - 1  # -1 for this order being delivered
        if active_count <= 0 and driver.status == DriverStatus.BUSY:
            driver.status = DriverStatus.AVAILABLE
            driver.updated_at = now
            session.add(driver)

        message = "Order delivered successfully"

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status: {update.status}"
        )

    order.updated_at = now
    if update.notes:
        order.delivery_notes = update.notes

    session.add(order)
    session.commit()
    session.refresh(order)

    return AcceptTripResponse(
        success=True,
        message=message,
        order=order_to_response(order, session)
    )


@router.post("/{order_id}/pickup", response_model=AcceptTripResponse)
def pickup_order(
    order_id: int,
    update: Optional[TripStatusUpdate] = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Mark order as picked up from warehouse.
    """
    user, driver = get_driver_user(current_user, session)

    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    # Verify driver owns this order
    if order.driver_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Order not assigned to you"
        )

    # Verify order is in correct state
    if order.status != OrderStatus.ASSIGNED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot pickup order with status: {order.status}"
        )

    # Update order
    now = datetime.now(timezone.utc)
    order.status = OrderStatus.PICKED_UP
    order.picked_up_at = now
    order.updated_at = now
    if update and update.notes:
        order.delivery_notes = update.notes

    session.add(order)
    session.commit()
    session.refresh(order)

    return AcceptTripResponse(
        success=True,
        message="Order marked as picked up",
        order=order_to_response(order, session)
    )


@router.post("/{order_id}/start-delivery", response_model=AcceptTripResponse)
def start_delivery(
    order_id: int,
    update: Optional[TripStatusUpdate] = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Mark order as in transit (started delivery).
    """
    user, driver = get_driver_user(current_user, session)

    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    if order.driver_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Order not assigned to you"
        )

    if order.status != OrderStatus.PICKED_UP:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot start delivery for order with status: {order.status}"
        )

    now = datetime.now(timezone.utc)
    order.status = OrderStatus.IN_TRANSIT
    order.in_transit_at = now
    order.updated_at = now
    if update and update.notes:
        order.delivery_notes = update.notes

    session.add(order)
    session.commit()
    session.refresh(order)

    return AcceptTripResponse(
        success=True,
        message="Delivery started",
        order=order_to_response(order, session)
    )


@router.post("/{order_id}/complete", response_model=AcceptTripResponse)
def complete_delivery(
    order_id: int,
    update: Optional[TripStatusUpdate] = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Mark order as delivered (complete the trip).
    """
    user, driver = get_driver_user(current_user, session)

    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    if order.driver_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Order not assigned to you"
        )

    if order.status != OrderStatus.IN_TRANSIT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot complete order with status: {order.status}"
        )

    now = datetime.now(timezone.utc)

    # Calculate delivery time
    actual_minutes = None
    if order.assigned_at:
        delta = now - order.assigned_at
        actual_minutes = int(delta.total_seconds() / 60)

    # Update order
    order.status = OrderStatus.DELIVERED
    order.delivered_at = now
    order.actual_delivery_minutes = actual_minutes
    order.updated_at = now
    if update and update.notes:
        order.delivery_notes = update.notes

    # Update driver status if no more active orders
    active_count = get_active_orders_count(session, user.id) - 1  # -1 for this order being delivered
    if active_count <= 0 and driver.status == DriverStatus.BUSY:
        driver.status = DriverStatus.AVAILABLE
        driver.updated_at = now
        session.add(driver)

    session.add(order)
    session.commit()
    session.refresh(order)

    return AcceptTripResponse(
        success=True,
        message="Order delivered successfully",
        order=order_to_response(order, session)
    )


# =============================================================================
# CANCEL TRIP
# =============================================================================

class CancelTripRequest(SQLModel):
    """Request body for cancelling a trip"""
    reason: str


@router.post("/{order_id}/cancel", response_model=AcceptTripResponse)
def cancel_trip(
    order_id: int,
    cancel_request: CancelTripRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Cancel an accepted order (return to pool).
    """
    user, driver = get_driver_user(current_user, session)
    config = get_system_config(session)

    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    if order.driver_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Order not assigned to you"
        )

    # Can only cancel if not yet delivered
    if order.status == OrderStatus.DELIVERED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel a delivered order"
        )

    now = datetime.now(timezone.utc)

    # Return order to pool
    order.driver_id = None
    order.status = OrderStatus.CONFIRMED
    order.assigned_at = None
    order.assignment_expires_at = None
    order.picked_up_at = None
    order.in_transit_at = None
    order.driver_cancelled_at = now
    order.driver_cancel_reason = cancel_request.reason
    order.cancellation_count += 1
    order.updated_at = now

    # Check cancellation count for this driver in the period
    period_start = now - timedelta(days=config.cancellation_period_days)
    cancellation_count = session.exec(
        select(func.count(Order.id))
        .where(Order.driver_cancelled_at >= period_start)
        .where(Order.driver_cancel_reason.isnot(None))
    ).one() or 0

    # Auto-flag/suspend based on cancellation count
    if cancellation_count >= config.max_cancellations_per_period:
        if config.auto_flag_on_max_cancellations:
            driver.is_flagged = True
            driver.flag_reason = f"Auto-flagged: {cancellation_count} cancellations in {config.cancellation_period_days} days"
            driver.flagged_at = now

        if config.auto_suspend_on_max_cancellations:
            driver.status = DriverStatus.SUSPENDED
            driver.suspended_until = now + timedelta(hours=config.suspension_duration_hours)

    # Update driver status if no more active orders and not suspended
    active_count = get_active_orders_count(session, user.id) - 1  # -1 for this order being cancelled
    if active_count <= 0 and driver.status != DriverStatus.SUSPENDED:
        driver.status = DriverStatus.AVAILABLE

    driver.updated_at = now

    session.add(order)
    session.add(driver)
    session.commit()
    session.refresh(order)

    return AcceptTripResponse(
        success=True,
        message="Order cancelled and returned to pool",
        order=order_to_response(order, session)
    )


# =============================================================================
# ACTIVE & HISTORY
# =============================================================================

@router.get("/active", response_model=List[OrderWithItems])
def get_active_trips(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get driver's current active orders.
    """
    user, driver = get_driver_user(current_user, session)

    orders = session.exec(
        select(Order)
        .where(Order.driver_id == user.id)
        .where(Order.status.in_([
            OrderStatus.ASSIGNED,
            OrderStatus.PICKED_UP,
            OrderStatus.IN_TRANSIT
        ]))
        .order_by(Order.assigned_at.desc())
    ).all()

    return [order_to_response(order, session) for order in orders]


@router.get("/history", response_model=List[OrderWithItems])
def get_trip_history(
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get driver's completed order history.
    """
    user, driver = get_driver_user(current_user, session)

    orders = session.exec(
        select(Order)
        .where(Order.driver_id == user.id)
        .where(Order.status == OrderStatus.DELIVERED)
        .order_by(Order.delivered_at.desc())
        .offset(skip)
        .limit(limit)
    ).all()

    return [order_to_response(order, session) for order in orders]


# =============================================================================
# STATS & EARNINGS
# =============================================================================

@router.get("/stats", response_model=DriverStats)
def get_driver_stats_endpoint(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get driver's statistics (computed from orders).
    """
    user, driver = get_driver_user(current_user, session)

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())

    # Active orders count
    active_orders_count = get_active_orders_count(session, user.id)

    # Total deliveries
    total_deliveries = session.exec(
        select(func.count(Order.id))
        .where(Order.driver_id == user.id)
        .where(Order.status == OrderStatus.DELIVERED)
    ).one() or 0

    # Today's deliveries
    deliveries_today = session.exec(
        select(func.count(Order.id))
        .where(Order.driver_id == user.id)
        .where(Order.status == OrderStatus.DELIVERED)
        .where(Order.delivered_at >= today_start)
    ).one() or 0

    # This week's deliveries
    deliveries_this_week = session.exec(
        select(func.count(Order.id))
        .where(Order.driver_id == user.id)
        .where(Order.status == OrderStatus.DELIVERED)
        .where(Order.delivered_at >= week_start)
    ).one() or 0

    # Cancellation count (orders where driver cancelled)
    cancellation_count = session.exec(
        select(func.count(Order.id))
        .where(Order.driver_cancel_reason.isnot(None))
    ).one() or 0

    # Calculate earnings based on shipping cost and commission
    shipping_config = get_shipping_config(session)
    commission_rate = shipping_config.driver_commission_percent / 100

    # Total earnings
    total_earnings_sum = session.exec(
        select(func.coalesce(func.sum(Order.shipping_cost), 0))
        .where(Order.driver_id == user.id)
        .where(Order.status == OrderStatus.DELIVERED)
    ).one()
    total_earnings = (total_earnings_sum or 0) * commission_rate

    # Today's earnings
    earnings_today_sum = session.exec(
        select(func.coalesce(func.sum(Order.shipping_cost), 0))
        .where(Order.driver_id == user.id)
        .where(Order.status == OrderStatus.DELIVERED)
        .where(Order.delivered_at >= today_start)
    ).one()
    earnings_today = (earnings_today_sum or 0) * commission_rate

    # This week's earnings
    earnings_this_week_sum = session.exec(
        select(func.coalesce(func.sum(Order.shipping_cost), 0))
        .where(Order.driver_id == user.id)
        .where(Order.status == OrderStatus.DELIVERED)
        .where(Order.delivered_at >= week_start)
    ).one()
    earnings_this_week = (earnings_this_week_sum or 0) * commission_rate

    # Note: Rating system not implemented yet - returning None/0
    return DriverStats(
        total_deliveries=total_deliveries,
        total_earnings=total_earnings,
        average_rating=None,
        total_ratings=0,
        active_orders_count=active_orders_count,
        cancellation_count=cancellation_count,
        deliveries_today=deliveries_today,
        earnings_today=earnings_today,
        deliveries_this_week=deliveries_this_week,
        earnings_this_week=earnings_this_week,
    )


@router.get("/earnings", response_model=DriverEarningsResponse)
def get_driver_earnings(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get driver's earnings breakdown (computed from orders).
    """
    user, driver = get_driver_user(current_user, session)

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Get shipping config for commission percentage
    shipping_config = get_shipping_config(session)
    commission_rate = shipping_config.driver_commission_percent / 100

    # Get recent delivered orders
    recent_orders = session.exec(
        select(Order)
        .where(Order.driver_id == user.id)
        .where(Order.status == OrderStatus.DELIVERED)
        .order_by(Order.delivered_at.desc())
        .limit(10)
    ).all()

    # Calculate earnings per period based on shipping cost * commission
    def sum_earnings_since(since: datetime) -> float:
        result = session.exec(
            select(func.coalesce(func.sum(Order.shipping_cost), 0))
            .where(Order.driver_id == user.id)
            .where(Order.status == OrderStatus.DELIVERED)
            .where(Order.delivered_at >= since)
        ).one()
        return (result or 0) * commission_rate

    # Total earnings (all time)
    total_earnings_sum = session.exec(
        select(func.coalesce(func.sum(Order.shipping_cost), 0))
        .where(Order.driver_id == user.id)
        .where(Order.status == OrderStatus.DELIVERED)
    ).one()
    total_earnings = (total_earnings_sum or 0) * commission_rate

    earnings_today = sum_earnings_since(today_start)
    earnings_this_week = sum_earnings_since(week_start)
    earnings_this_month = sum_earnings_since(month_start)

    # Build recent earnings list
    recent_earnings = []
    for order in recent_orders:
        customer_name = order.user.full_name if order.user else "Unknown"
        driver_earning = order.shipping_cost * commission_rate
        recent_earnings.append(DriverEarning(
            order_id=order.id,
            amount=driver_earning,
            delivered_at=order.delivered_at,
            customer_name=customer_name,
            delivery_address=order.shipping_address
        ))

    return DriverEarningsResponse(
        total_earnings=total_earnings,
        earnings_today=earnings_today,
        earnings_this_week=earnings_this_week,
        earnings_this_month=earnings_this_month,
        recent_earnings=recent_earnings
    )


# =============================================================================
# STATUS TOGGLE
# =============================================================================

class DriverStatusUpdate(SQLModel):
    """Request to update driver status"""
    status: DriverStatus


@router.post("/status", response_model=dict)
def update_driver_status(
    status_update: DriverStatusUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Update driver's availability status (go online/offline).
    """
    user, driver = get_driver_user(current_user, session)

    # Can't change status if suspended
    if driver.status == DriverStatus.SUSPENDED:
        # Check if suspension has expired
        if driver.suspended_until and datetime.now(timezone.utc) >= driver.suspended_until:
            driver.status = DriverStatus.OFFLINE
            driver.suspended_until = None
            driver.is_flagged = False
            driver.flag_reason = None
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Driver account is suspended"
            )

    # Validate status transitions
    if status_update.status == DriverStatus.SUSPENDED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot self-suspend. Contact admin."
        )

    if status_update.status == DriverStatus.BUSY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Busy status is set automatically when accepting orders"
        )

    # Check active orders count
    active_count = get_active_orders_count(session, user.id)

    # Can only go online if no active orders
    if status_update.status == DriverStatus.AVAILABLE and active_count > 0:
        driver.status = DriverStatus.BUSY
    else:
        driver.status = status_update.status

    driver.is_available = status_update.status == DriverStatus.AVAILABLE
    driver.updated_at = datetime.now(timezone.utc)

    session.add(driver)
    session.commit()
    session.refresh(driver)

    return {
        "success": True,
        "status": driver.status,
        "is_available": driver.is_available
    }


# =============================================================================
# TRIP DETAIL (must be last to avoid matching /stats, /active, etc.)
# =============================================================================

@router.get("/{order_id}", response_model=OrderWithItems)
def get_trip_detail(
    order_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get details of a specific trip/order.
    Allows viewing:
    - Available orders (CONFIRMED, no driver) - so drivers can see before accepting
    - Orders assigned to this driver
    """
    user, driver = get_driver_user(current_user, session)

    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    # Allow viewing if:
    # 1. Order is available (CONFIRMED and no driver assigned)
    # 2. Order is assigned to this driver
    is_available = order.status == OrderStatus.CONFIRMED and order.driver_id is None
    is_assigned_to_me = order.driver_id == user.id

    if not is_available and not is_assigned_to_me:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Order not assigned to you"
        )

    return order_to_response(order, session)
