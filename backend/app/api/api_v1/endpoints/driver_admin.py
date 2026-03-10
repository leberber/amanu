from datetime import datetime, timezone, timedelta
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select, func

from app.database import get_session
from app.core.security import get_current_admin_user, get_current_staff_user
from app.models.user import User, UserRole
from app.models.order import Order, OrderStatus, OrderWithItems, OrderItemRead, UserInfo, DriverInfo
from app.models.driver import (
    DriverProfile, DriverProfileWithFlags, DriverProfileAdminUpdate, DriverStatus
)
from app.models.driver_config import (
    DriverSystemConfig, DriverSystemConfigRead, DriverSystemConfigUpdate
)
from sqlmodel import SQLModel


router = APIRouter()


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def order_to_response(order: Order, session: Session) -> OrderWithItems:
    """Convert Order to OrderWithItems response"""
    user_info = None
    if order.user:
        user_info = UserInfo(
            id=order.user.id,
            full_name=order.user.full_name,
            email=order.user.email
        )

    driver_info = None
    if order.driver:
        vehicle_type = None
        if order.driver.driver_profile:
            vehicle_type = order.driver.driver_profile.vehicle_type
        driver_info = DriverInfo(
            id=order.driver.id,
            full_name=order.driver.full_name,
            phone=order.driver.phone,
            vehicle_type=vehicle_type
        )

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


def get_system_config(session: Session) -> DriverSystemConfig:
    """Get or create system configuration"""
    config = session.exec(select(DriverSystemConfig)).first()
    if not config:
        config = DriverSystemConfig()
        session.add(config)
        session.commit()
        session.refresh(config)
    return config


# =============================================================================
# SYSTEM CONFIGURATION
# =============================================================================

@router.get("/config", response_model=DriverSystemConfigRead)
def get_config(
    current_user: User = Depends(get_current_admin_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get driver system configuration (admin only).
    """
    config = get_system_config(session)
    return config


@router.patch("/config", response_model=DriverSystemConfigRead)
def update_config(
    config_update: DriverSystemConfigUpdate,
    current_user: User = Depends(get_current_admin_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Update driver system configuration (admin only).
    """
    config = get_system_config(session)

    update_data = config_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)

    config.updated_at = datetime.now(timezone.utc)
    config.updated_by_id = current_user.id

    session.add(config)
    session.commit()
    session.refresh(config)

    return config


# =============================================================================
# ORDER ASSIGNMENT
# =============================================================================

class AssignOrderRequest(SQLModel):
    """Request to assign order to driver"""
    driver_id: int
    estimated_delivery_minutes: Optional[int] = None


class AssignOrderResponse(SQLModel):
    """Response after assigning order"""
    success: bool
    message: str
    order: Optional[OrderWithItems] = None


@router.post("/orders/{order_id}/assign", response_model=AssignOrderResponse)
def assign_order_to_driver(
    order_id: int,
    assign_request: AssignOrderRequest,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Manually assign an order to a driver (admin/staff).
    """
    config = get_system_config(session)

    # Get order
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    # Check if order can be assigned
    if order.status not in [OrderStatus.CONFIRMED, OrderStatus.PENDING]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot assign order with status: {order.status}"
        )

    # Get driver
    driver = session.get(User, assign_request.driver_id)
    if not driver or driver.role != UserRole.DRIVER:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found"
        )

    # Get driver profile
    profile = session.exec(
        select(DriverProfile).where(DriverProfile.user_id == driver.id)
    ).first()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver profile not found"
        )

    # Check driver status
    if profile.status == DriverStatus.SUSPENDED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot assign to suspended driver"
        )

    # Check max active orders
    if profile.active_orders_count >= profile.max_active_orders:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Driver has reached max active orders ({profile.max_active_orders})"
        )

    now = datetime.now(timezone.utc)

    # Assign order
    order.driver_id = driver.id
    order.status = OrderStatus.ASSIGNED
    order.assigned_at = now
    order.assignment_expires_at = now + timedelta(minutes=config.assignment_timeout_minutes)
    order.estimated_delivery_minutes = assign_request.estimated_delivery_minutes
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

    return AssignOrderResponse(
        success=True,
        message=f"Order assigned to {driver.full_name}",
        order=order_to_response(order, session)
    )


@router.post("/orders/{order_id}/unassign", response_model=AssignOrderResponse)
def unassign_order(
    order_id: int,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Unassign an order from driver (return to pool).
    """
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    if order.driver_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order is not assigned to any driver"
        )

    # Can't unassign delivered orders
    if order.status == OrderStatus.DELIVERED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot unassign a delivered order"
        )

    # Get driver profile
    profile = session.exec(
        select(DriverProfile).where(DriverProfile.user_id == order.driver_id)
    ).first()

    now = datetime.now(timezone.utc)

    # Unassign order
    order.driver_id = None
    order.status = OrderStatus.CONFIRMED
    order.assigned_at = None
    order.assignment_expires_at = None
    order.picked_up_at = None
    order.in_transit_at = None
    order.updated_at = now

    # Update driver profile
    if profile:
        profile.active_orders_count = max(0, profile.active_orders_count - 1)
        if profile.active_orders_count == 0 and profile.status == DriverStatus.BUSY:
            profile.status = DriverStatus.AVAILABLE
        profile.updated_at = now
        session.add(profile)

    session.add(order)
    session.commit()
    session.refresh(order)

    return AssignOrderResponse(
        success=True,
        message="Order unassigned and returned to pool",
        order=order_to_response(order, session)
    )


@router.post("/orders/{order_id}/reassign", response_model=AssignOrderResponse)
def reassign_order(
    order_id: int,
    assign_request: AssignOrderRequest,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Reassign an order to a different driver.
    """
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    if order.status == OrderStatus.DELIVERED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot reassign a delivered order"
        )

    # Get old driver profile
    old_profile = None
    if order.driver_id:
        old_profile = session.exec(
            select(DriverProfile).where(DriverProfile.user_id == order.driver_id)
        ).first()

    # Get new driver
    new_driver = session.get(User, assign_request.driver_id)
    if not new_driver or new_driver.role != UserRole.DRIVER:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="New driver not found"
        )

    new_profile = session.exec(
        select(DriverProfile).where(DriverProfile.user_id == new_driver.id)
    ).first()

    if not new_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="New driver profile not found"
        )

    if new_profile.status == DriverStatus.SUSPENDED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot assign to suspended driver"
        )

    if new_profile.active_orders_count >= new_profile.max_active_orders:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"New driver has reached max active orders ({new_profile.max_active_orders})"
        )

    config = get_system_config(session)
    now = datetime.now(timezone.utc)

    # Update old driver
    if old_profile:
        old_profile.active_orders_count = max(0, old_profile.active_orders_count - 1)
        if old_profile.active_orders_count == 0 and old_profile.status == DriverStatus.BUSY:
            old_profile.status = DriverStatus.AVAILABLE
        old_profile.updated_at = now
        session.add(old_profile)

    # Reassign order
    order.driver_id = new_driver.id
    order.status = OrderStatus.ASSIGNED
    order.assigned_at = now
    order.assignment_expires_at = now + timedelta(minutes=config.assignment_timeout_minutes)
    order.picked_up_at = None
    order.in_transit_at = None
    if assign_request.estimated_delivery_minutes:
        order.estimated_delivery_minutes = assign_request.estimated_delivery_minutes
    order.updated_at = now

    # Update new driver
    new_profile.active_orders_count += 1
    if new_profile.status == DriverStatus.AVAILABLE:
        new_profile.status = DriverStatus.BUSY
    new_profile.updated_at = now

    session.add(order)
    session.add(new_profile)
    session.commit()
    session.refresh(order)

    return AssignOrderResponse(
        success=True,
        message=f"Order reassigned to {new_driver.full_name}",
        order=order_to_response(order, session)
    )


# =============================================================================
# DRIVER MANAGEMENT
# =============================================================================

@router.get("/profiles", response_model=List[DriverProfileWithFlags])
def list_driver_profiles(
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[DriverStatus] = None,
    flagged_only: bool = False,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    List all driver profiles with full details (admin/staff).
    """
    # Single query with JOIN to get profiles + user info
    query = select(DriverProfile, User).join(User, DriverProfile.user_id == User.id)

    if status_filter:
        query = query.where(DriverProfile.status == status_filter)

    if flagged_only:
        query = query.where(DriverProfile.is_flagged == True)

    query = query.offset(skip).limit(limit)

    results = session.exec(query).all()

    # Build response with user info included
    response = []
    for profile, user in results:
        profile_dict = profile.model_dump()
        profile_dict["full_name"] = user.full_name
        profile_dict["phone"] = user.phone
        profile_dict["email"] = user.email
        response.append(DriverProfileWithFlags(**profile_dict))

    return response


@router.get("/profiles/{driver_id}", response_model=DriverProfileWithFlags)
def get_driver_profile(
    driver_id: int,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get a driver's full profile with flags (admin/staff).
    """
    profile = session.exec(
        select(DriverProfile).where(DriverProfile.user_id == driver_id)
    ).first()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver profile not found"
        )

    return profile


@router.patch("/profiles/{driver_id}", response_model=DriverProfileWithFlags)
def update_driver_profile(
    driver_id: int,
    profile_update: DriverProfileAdminUpdate,
    current_user: User = Depends(get_current_admin_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Update a driver's profile (admin only).
    """
    profile = session.exec(
        select(DriverProfile).where(DriverProfile.user_id == driver_id)
    ).first()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver profile not found"
        )

    update_data = profile_update.model_dump(exclude_unset=True)
    now = datetime.now(timezone.utc)

    # Handle flagging
    if "is_flagged" in update_data:
        if update_data["is_flagged"] and not profile.is_flagged:
            profile.flagged_at = now
            profile.flagged_by_id = current_user.id
        elif not update_data["is_flagged"] and profile.is_flagged:
            profile.flagged_at = None
            profile.flagged_by_id = None
            profile.flag_reason = None

    for field, value in update_data.items():
        setattr(profile, field, value)

    profile.updated_at = now
    session.add(profile)
    session.commit()
    session.refresh(profile)

    return profile


class FlagDriverRequest(SQLModel):
    """Request to flag a driver"""
    reason: str


@router.post("/profiles/{driver_id}/flag", response_model=DriverProfileWithFlags)
def flag_driver(
    driver_id: int,
    flag_request: FlagDriverRequest,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Flag a driver for review.
    """
    profile = session.exec(
        select(DriverProfile).where(DriverProfile.user_id == driver_id)
    ).first()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver profile not found"
        )

    now = datetime.now(timezone.utc)
    profile.is_flagged = True
    profile.flag_reason = flag_request.reason
    profile.flagged_at = now
    profile.flagged_by_id = current_user.id
    profile.updated_at = now

    session.add(profile)
    session.commit()
    session.refresh(profile)

    return profile


@router.post("/profiles/{driver_id}/unflag", response_model=DriverProfileWithFlags)
def unflag_driver(
    driver_id: int,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Remove flag from a driver.
    """
    profile = session.exec(
        select(DriverProfile).where(DriverProfile.user_id == driver_id)
    ).first()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver profile not found"
        )

    profile.is_flagged = False
    profile.flag_reason = None
    profile.flagged_at = None
    profile.flagged_by_id = None
    profile.updated_at = datetime.now(timezone.utc)

    session.add(profile)
    session.commit()
    session.refresh(profile)

    return profile


class SuspendDriverRequest(SQLModel):
    """Request to suspend a driver"""
    reason: str
    duration_hours: int = 24


@router.post("/profiles/{driver_id}/suspend", response_model=DriverProfileWithFlags)
def suspend_driver(
    driver_id: int,
    suspend_request: SuspendDriverRequest,
    current_user: User = Depends(get_current_admin_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Suspend a driver (admin only).
    """
    profile = session.exec(
        select(DriverProfile).where(DriverProfile.user_id == driver_id)
    ).first()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver profile not found"
        )

    now = datetime.now(timezone.utc)
    profile.status = DriverStatus.SUSPENDED
    profile.suspended_until = now + timedelta(hours=suspend_request.duration_hours)
    profile.is_flagged = True
    profile.flag_reason = f"Suspended: {suspend_request.reason}"
    profile.flagged_at = now
    profile.flagged_by_id = current_user.id
    profile.updated_at = now

    session.add(profile)
    session.commit()
    session.refresh(profile)

    return profile


@router.post("/profiles/{driver_id}/unsuspend", response_model=DriverProfileWithFlags)
def unsuspend_driver(
    driver_id: int,
    current_user: User = Depends(get_current_admin_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Remove suspension from a driver (admin only).
    """
    profile = session.exec(
        select(DriverProfile).where(DriverProfile.user_id == driver_id)
    ).first()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver profile not found"
        )

    profile.status = DriverStatus.OFFLINE
    profile.suspended_until = None
    profile.is_flagged = False
    profile.flag_reason = None
    profile.flagged_at = None
    profile.flagged_by_id = None
    profile.updated_at = datetime.now(timezone.utc)

    session.add(profile)
    session.commit()
    session.refresh(profile)

    return profile


# =============================================================================
# ORDER QUERIES
# =============================================================================

@router.get("/orders/pool", response_model=List[OrderWithItems])
def get_order_pool(
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get orders available in the driver pool.
    """
    orders = session.exec(
        select(Order)
        .where(Order.status == OrderStatus.CONFIRMED)
        .where(Order.driver_id == None)
        .order_by(Order.created_at.asc())
    ).all()

    return [order_to_response(order, session) for order in orders]


@router.get("/orders/assigned", response_model=List[OrderWithItems])
def get_assigned_orders(
    driver_id: Optional[int] = None,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get assigned orders, optionally filtered by driver.
    """
    query = select(Order).where(
        Order.status.in_([
            OrderStatus.ASSIGNED,
            OrderStatus.PICKED_UP,
            OrderStatus.IN_TRANSIT
        ])
    )

    if driver_id:
        query = query.where(Order.driver_id == driver_id)

    query = query.order_by(Order.assigned_at.desc())
    orders = session.exec(query).all()

    return [order_to_response(order, session) for order in orders]


# =============================================================================
# STATISTICS
# =============================================================================

class DriverSystemStats(SQLModel):
    """System-wide driver statistics"""
    total_drivers: int
    active_drivers: int
    available_drivers: int
    busy_drivers: int
    suspended_drivers: int
    flagged_drivers: int
    orders_in_pool: int
    orders_assigned: int
    orders_in_transit: int
    deliveries_today: int


@router.get("/stats", response_model=DriverSystemStats)
def get_system_stats(
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get system-wide driver statistics.
    """
    # Driver counts
    total_drivers = session.exec(
        select(func.count(DriverProfile.id))
    ).one() or 0

    available_drivers = session.exec(
        select(func.count(DriverProfile.id))
        .where(DriverProfile.status == DriverStatus.AVAILABLE)
    ).one() or 0

    busy_drivers = session.exec(
        select(func.count(DriverProfile.id))
        .where(DriverProfile.status == DriverStatus.BUSY)
    ).one() or 0

    suspended_drivers = session.exec(
        select(func.count(DriverProfile.id))
        .where(DriverProfile.status == DriverStatus.SUSPENDED)
    ).one() or 0

    flagged_drivers = session.exec(
        select(func.count(DriverProfile.id))
        .where(DriverProfile.is_flagged == True)
    ).one() or 0

    active_drivers = available_drivers + busy_drivers

    # Order counts
    orders_in_pool = session.exec(
        select(func.count(Order.id))
        .where(Order.status == OrderStatus.CONFIRMED)
        .where(Order.driver_id == None)
    ).one() or 0

    orders_assigned = session.exec(
        select(func.count(Order.id))
        .where(Order.status == OrderStatus.ASSIGNED)
    ).one() or 0

    orders_in_transit = session.exec(
        select(func.count(Order.id))
        .where(Order.status == OrderStatus.IN_TRANSIT)
    ).one() or 0

    # Today's deliveries
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    deliveries_today = session.exec(
        select(func.count(Order.id))
        .where(Order.status == OrderStatus.DELIVERED)
        .where(Order.delivered_at >= today_start)
    ).one() or 0

    return DriverSystemStats(
        total_drivers=total_drivers,
        active_drivers=active_drivers,
        available_drivers=available_drivers,
        busy_drivers=busy_drivers,
        suspended_drivers=suspended_drivers,
        flagged_drivers=flagged_drivers,
        orders_in_pool=orders_in_pool,
        orders_assigned=orders_assigned,
        orders_in_transit=orders_in_transit,
        deliveries_today=deliveries_today
    )
