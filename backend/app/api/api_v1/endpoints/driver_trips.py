from datetime import datetime, timezone, timedelta
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select, func, and_, or_

from app.database import get_session
from app.core.security import get_current_user
from app.models.user import User, UserRole
from app.models.order import (
    Order, OrderStatus, OrderRead, OrderWithItems, OrderItemRead,
    UserInfo, DriverInfo
)
from app.models.driver import (
    DriverProfile, DriverStatus, DriverStats,
    DriverEarning, DriverEarningsResponse
)
from app.models.driver_config import DriverSystemConfig
from sqlmodel import SQLModel


router = APIRouter()


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_driver_user(current_user: User, session: Session) -> tuple[User, DriverProfile]:
    """Verify user is a driver and get their profile"""
    if current_user.role != UserRole.DRIVER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a driver"
        )

    profile = session.exec(
        select(DriverProfile).where(DriverProfile.user_id == current_user.id)
    ).first()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver profile not found"
        )

    return current_user, profile


def get_system_config(session: Session) -> DriverSystemConfig:
    """Get or create system configuration"""
    config = session.exec(select(DriverSystemConfig)).first()
    if not config:
        config = DriverSystemConfig()
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
            email=order.user.email
        )

    # Get driver info
    driver_info = None
    if order.driver:
        driver_info = DriverInfo(
            id=order.driver.id,
            full_name=order.driver.full_name,
            phone=order.driver.phone
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

    return OrderWithItems(
        id=order.id,
        user_id=order.user_id,
        status=order.status,
        shipping_address=order.shipping_address,
        contact_phone=order.contact_phone,
        total_amount=order.total_amount,
        subtotal=order.subtotal,
        discount_amount=order.discount_amount,
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
        promotion_info=None
    )


# =============================================================================
# AVAILABLE TRIPS
# =============================================================================

@router.get("/available", response_model=List[OrderWithItems])
def get_available_trips(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get available orders for driver to accept.
    Returns orders with status CONFIRMED (ready for driver pool).
    """
    driver, profile = get_driver_user(current_user, session)

    # Check if driver is available
    if profile.status == DriverStatus.SUSPENDED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Driver account is suspended"
        )

    # Check if driver has reached max active orders
    config = get_system_config(session)
    if profile.active_orders_count >= profile.max_active_orders:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum active orders ({profile.max_active_orders}) reached"
        )

    # Get confirmed orders not assigned to any driver
    orders = session.exec(
        select(Order)
        .where(Order.status == OrderStatus.CONFIRMED)
        .where(Order.driver_id == None)
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
    driver, profile = get_driver_user(current_user, session)
    config = get_system_config(session)

    # Verify driver can accept orders
    if profile.status == DriverStatus.SUSPENDED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Driver account is suspended"
        )

    if not config.allow_driver_self_assign:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Self-assignment is not allowed. Contact admin."
        )

    if profile.active_orders_count >= profile.max_active_orders:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum active orders ({profile.max_active_orders}) reached"
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
    order.driver_id = driver.id
    order.status = OrderStatus.ASSIGNED
    order.assigned_at = now
    order.assignment_expires_at = now + timedelta(minutes=config.assignment_timeout_minutes)
    order.updated_at = now

    # Update driver profile
    profile.active_orders_count += 1
    if profile.status == DriverStatus.AVAILABLE:
        profile.status = DriverStatus.BUSY
    profile.updated_at = now

    session.add(order)
    session.add(profile)
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
    driver, profile = get_driver_user(current_user, session)

    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    # Verify driver owns this order
    if order.driver_id != driver.id:
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
    driver, profile = get_driver_user(current_user, session)

    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    if order.driver_id != driver.id:
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
    driver, profile = get_driver_user(current_user, session)
    config = get_system_config(session)

    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    if order.driver_id != driver.id:
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

    # Update driver stats
    profile.active_orders_count = max(0, profile.active_orders_count - 1)
    profile.total_deliveries += 1

    # Calculate earnings (simple model for now)
    earnings = config.base_delivery_fee
    profile.total_earnings += earnings

    # Update driver status if no more active orders
    if profile.active_orders_count == 0:
        profile.status = DriverStatus.AVAILABLE

    profile.updated_at = now

    session.add(order)
    session.add(profile)
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
    driver, profile = get_driver_user(current_user, session)
    config = get_system_config(session)

    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    if order.driver_id != driver.id:
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

    # Update driver stats
    profile.active_orders_count = max(0, profile.active_orders_count - 1)
    profile.cancellation_count += 1

    # Check if in current period
    period_start = profile.period_start
    if period_start is None or (now - period_start).days >= config.cancellation_period_days:
        # Start new period
        profile.period_start = now
        profile.cancellation_count_period = 1
    else:
        profile.cancellation_count_period += 1

    profile.last_cancellation_at = now

    # Check if should flag/suspend
    if profile.cancellation_count_period >= config.max_cancellations_per_period:
        if config.auto_flag_on_max_cancellations:
            profile.is_flagged = True
            profile.flag_reason = f"Auto-flagged: {profile.cancellation_count_period} cancellations in period"
            profile.flagged_at = now

        if config.auto_suspend_on_max_cancellations:
            profile.status = DriverStatus.SUSPENDED
            profile.suspended_until = now + timedelta(hours=config.suspension_duration_hours)

    # Update status if no more active orders
    if profile.active_orders_count == 0 and profile.status != DriverStatus.SUSPENDED:
        profile.status = DriverStatus.AVAILABLE

    profile.updated_at = now

    session.add(order)
    session.add(profile)
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
    driver, profile = get_driver_user(current_user, session)

    orders = session.exec(
        select(Order)
        .where(Order.driver_id == driver.id)
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
    driver, profile = get_driver_user(current_user, session)

    orders = session.exec(
        select(Order)
        .where(Order.driver_id == driver.id)
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
def get_driver_stats(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get driver's statistics.
    """
    driver, profile = get_driver_user(current_user, session)

    # Calculate period stats
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())

    # Today's deliveries
    deliveries_today = session.exec(
        select(func.count(Order.id))
        .where(Order.driver_id == driver.id)
        .where(Order.status == OrderStatus.DELIVERED)
        .where(Order.delivered_at >= today_start)
    ).one()

    # This week's deliveries
    deliveries_this_week = session.exec(
        select(func.count(Order.id))
        .where(Order.driver_id == driver.id)
        .where(Order.status == OrderStatus.DELIVERED)
        .where(Order.delivered_at >= week_start)
    ).one()

    # TODO: Calculate actual earnings when earnings model is implemented
    earnings_today = 0.0
    earnings_this_week = 0.0

    return DriverStats(
        total_deliveries=profile.total_deliveries,
        total_earnings=profile.total_earnings,
        average_rating=profile.average_rating,
        total_ratings=profile.total_ratings,
        active_orders_count=profile.active_orders_count,
        cancellation_count=profile.cancellation_count,
        deliveries_today=deliveries_today or 0,
        earnings_today=earnings_today,
        deliveries_this_week=deliveries_this_week or 0,
        earnings_this_week=earnings_this_week,
    )


@router.get("/earnings", response_model=DriverEarningsResponse)
def get_driver_earnings(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get driver's earnings breakdown.
    """
    driver, profile = get_driver_user(current_user, session)
    config = get_system_config(session)

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Get recent delivered orders
    recent_orders = session.exec(
        select(Order)
        .where(Order.driver_id == driver.id)
        .where(Order.status == OrderStatus.DELIVERED)
        .order_by(Order.delivered_at.desc())
        .limit(10)
    ).all()

    # Calculate earnings per period (simple model: base_delivery_fee per order)
    def count_deliveries_since(since: datetime) -> int:
        result = session.exec(
            select(func.count(Order.id))
            .where(Order.driver_id == driver.id)
            .where(Order.status == OrderStatus.DELIVERED)
            .where(Order.delivered_at >= since)
        ).one()
        return result or 0

    deliveries_today = count_deliveries_since(today_start)
    deliveries_this_week = count_deliveries_since(week_start)
    deliveries_this_month = count_deliveries_since(month_start)

    earnings_today = deliveries_today * config.base_delivery_fee
    earnings_this_week = deliveries_this_week * config.base_delivery_fee
    earnings_this_month = deliveries_this_month * config.base_delivery_fee

    # Build recent earnings list
    recent_earnings = []
    for order in recent_orders:
        customer_name = order.user.full_name if order.user else "Unknown"
        recent_earnings.append(DriverEarning(
            order_id=order.id,
            amount=config.base_delivery_fee,
            delivered_at=order.delivered_at,
            customer_name=customer_name,
            delivery_address=order.shipping_address
        ))

    return DriverEarningsResponse(
        total_earnings=profile.total_earnings,
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
    driver, profile = get_driver_user(current_user, session)

    # Can't change status if suspended
    if profile.status == DriverStatus.SUSPENDED:
        # Check if suspension has expired
        if profile.suspended_until and datetime.now(timezone.utc) >= profile.suspended_until:
            profile.status = DriverStatus.OFFLINE
            profile.suspended_until = None
            profile.is_flagged = False
            profile.flag_reason = None
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

    # Can only go online if no active orders
    if status_update.status == DriverStatus.AVAILABLE and profile.active_orders_count > 0:
        profile.status = DriverStatus.BUSY
    else:
        profile.status = status_update.status

    profile.is_available = status_update.status == DriverStatus.AVAILABLE
    profile.updated_at = datetime.now(timezone.utc)

    session.add(profile)
    session.commit()
    session.refresh(profile)

    return {
        "success": True,
        "status": profile.status,
        "is_available": profile.is_available
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
    Get details of a specific trip/order assigned to the driver.
    """
    driver, profile = get_driver_user(current_user, session)

    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    # Verify driver owns this order
    if order.driver_id != driver.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Order not assigned to you"
        )

    return order_to_response(order, session)
