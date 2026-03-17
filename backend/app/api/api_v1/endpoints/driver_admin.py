from datetime import datetime, timezone, timedelta
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select, func

from app.database import get_session
from app.core.security import get_current_admin_user, get_current_staff_user
from app.models.user import User, UserRole
from app.models.order import Order, OrderStatus, OrderWithItems, OrderItemRead, UserInfo, DriverInfo
from app.models.driver import (
    Driver, DriverVehicle, DriverReadWithFlags, DriverAdminUpdate, DriverStatus
)
from app.models.driver_config import (
    DriverSystemConfig, DriverSystemConfigRead, DriverSystemConfigUpdate
)
from app.models.product import Product
from sqlmodel import SQLModel


router = APIRouter()


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def order_to_response(
    order: Order,
    session: Session,
    vehicles_map: dict = None,
    products_map: dict = None
) -> OrderWithItems:
    """Convert Order to OrderWithItems response.

    Args:
        order: The order to convert
        session: Database session
        vehicles_map: Optional pre-loaded {driver_id: DriverVehicle} for batch optimization
        products_map: Optional pre-loaded {product_id: Product} for batch optimization
    """
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

    driver_info = None
    if order.driver:
        vehicle_type = None
        # Get primary vehicle from driver's vehicles
        if order.driver.driver:
            if vehicles_map:
                primary_vehicle = vehicles_map.get(order.driver.driver.id)
            else:
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
        if products_map:
            # Use pre-loaded products
            for item in order.items:
                product = products_map.get(item.product_id)
                if product:
                    if product.weight:
                        total_weight += product.weight * item.quantity
                    if product.volume:
                        total_volume += product.volume * item.quantity
        else:
            products = session.exec(
                select(Product).where(Product.id.in_(product_ids))
            ).all()
            product_map_local = {p.id: p for p in products}
            for item in order.items:
                product = product_map_local.get(item.product_id)
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


def orders_to_response_batch(orders: list, session: Session) -> list:
    """Convert multiple orders with batch-loaded data."""
    if not orders:
        return []

    # Collect all driver IDs that have driver records
    driver_ids = set()
    for order in orders:
        if order.driver and order.driver.driver:
            driver_ids.add(order.driver.driver.id)

    # Batch load all primary vehicles
    vehicles_map = {}
    if driver_ids:
        vehicles = session.exec(
            select(DriverVehicle)
            .where(DriverVehicle.driver_id.in_(driver_ids))
            .where(DriverVehicle.is_primary == True)
        ).all()
        vehicles_map = {v.driver_id: v for v in vehicles}

    # Collect all product IDs from all orders
    product_ids = set()
    for order in orders:
        if order.items:
            for item in order.items:
                product_ids.add(item.product_id)

    # Batch load all products
    products_map = {}
    if product_ids:
        products = session.exec(
            select(Product).where(Product.id.in_(product_ids))
        ).all()
        products_map = {p.id: p for p in products}

    return [order_to_response(order, session, vehicles_map, products_map) for order in orders]


def get_system_config(session: Session) -> DriverSystemConfig:
    """Get or create system configuration"""
    config = session.exec(select(DriverSystemConfig)).first()
    if not config:
        config = DriverSystemConfig()
        session.add(config)
        session.commit()
        session.refresh(config)
    return config


def get_active_orders_count(session: Session, driver_user_id: int) -> int:
    """Compute active orders count from orders table"""
    count = session.exec(
        select(func.count(Order.id))
        .where(Order.driver_id == driver_user_id)
        .where(Order.status.in_([OrderStatus.ASSIGNED, OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT]))
    ).one()
    return count or 0


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

    # Get driver user
    driver_user = session.get(User, assign_request.driver_id)
    if not driver_user or driver_user.role != UserRole.DRIVER:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found"
        )

    # Get driver record
    driver = session.exec(
        select(Driver).where(Driver.user_id == driver_user.id)
    ).first()

    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver record not found"
        )

    # Check driver status
    if driver.status == DriverStatus.SUSPENDED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot assign to suspended driver"
        )

    # Check max active orders
    active_count = get_active_orders_count(session, driver_user.id)
    if active_count >= driver.max_active_orders:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Driver has reached max active orders ({driver.max_active_orders})"
        )

    # Check vehicle capacity for full load orders
    if order.is_full_load and order.min_vehicle_capacity_kg:
        # Get driver's primary vehicle
        primary_vehicle = session.exec(
            select(DriverVehicle)
            .where(DriverVehicle.driver_id == driver.id)
            .where(DriverVehicle.is_primary == True)
            .where(DriverVehicle.is_active == True)
        ).first()

        if not primary_vehicle:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Driver has no active primary vehicle"
            )

        if primary_vehicle.capacity_kg and primary_vehicle.capacity_kg < order.min_vehicle_capacity_kg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Driver's vehicle capacity ({primary_vehicle.capacity_kg}kg) is insufficient for this order (requires {order.min_vehicle_capacity_kg}kg)"
            )

    now = datetime.now(timezone.utc)

    # Assign order
    order.driver_id = driver_user.id
    order.status = OrderStatus.ASSIGNED
    order.assigned_at = now
    order.assignment_expires_at = now + timedelta(minutes=config.assignment_timeout_minutes)
    order.estimated_delivery_minutes = assign_request.estimated_delivery_minutes
    order.updated_at = now

    # Update driver status to BUSY
    if driver.status == DriverStatus.AVAILABLE:
        driver.status = DriverStatus.BUSY
        driver.updated_at = now
        session.add(driver)

    session.add(order)
    session.commit()
    session.refresh(order)

    return AssignOrderResponse(
        success=True,
        message=f"Order assigned to {driver_user.full_name}",
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

    # Get driver record
    driver = session.exec(
        select(Driver).where(Driver.user_id == order.driver_id)
    ).first()

    old_driver_id = order.driver_id
    now = datetime.now(timezone.utc)

    # Unassign order
    order.driver_id = None
    order.status = OrderStatus.CONFIRMED
    order.assigned_at = None
    order.assignment_expires_at = None
    order.picked_up_at = None
    order.in_transit_at = None
    order.updated_at = now

    session.add(order)
    session.commit()

    # Update driver status if no more active orders
    if driver:
        active_count = get_active_orders_count(session, old_driver_id)
        if active_count == 0 and driver.status == DriverStatus.BUSY:
            driver.status = DriverStatus.AVAILABLE
            driver.updated_at = now
            session.add(driver)
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

    # Get old driver record
    old_driver = None
    old_driver_user_id = order.driver_id
    if order.driver_id:
        old_driver = session.exec(
            select(Driver).where(Driver.user_id == order.driver_id)
        ).first()

    # Get new driver user
    new_driver_user = session.get(User, assign_request.driver_id)
    if not new_driver_user or new_driver_user.role != UserRole.DRIVER:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="New driver not found"
        )

    new_driver = session.exec(
        select(Driver).where(Driver.user_id == new_driver_user.id)
    ).first()

    if not new_driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="New driver record not found"
        )

    if new_driver.status == DriverStatus.SUSPENDED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot assign to suspended driver"
        )

    new_driver_active_count = get_active_orders_count(session, new_driver_user.id)
    if new_driver_active_count >= new_driver.max_active_orders:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"New driver has reached max active orders ({new_driver.max_active_orders})"
        )

    # Check vehicle capacity for full load orders
    if order.is_full_load and order.min_vehicle_capacity_kg:
        # Get new driver's primary vehicle
        primary_vehicle = session.exec(
            select(DriverVehicle)
            .where(DriverVehicle.driver_id == new_driver.id)
            .where(DriverVehicle.is_primary == True)
            .where(DriverVehicle.is_active == True)
        ).first()

        if not primary_vehicle:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New driver has no active primary vehicle"
            )

        if primary_vehicle.capacity_kg and primary_vehicle.capacity_kg < order.min_vehicle_capacity_kg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"New driver's vehicle capacity ({primary_vehicle.capacity_kg}kg) is insufficient for this order (requires {order.min_vehicle_capacity_kg}kg)"
            )

    config = get_system_config(session)
    now = datetime.now(timezone.utc)

    # Reassign order
    order.driver_id = new_driver_user.id
    order.status = OrderStatus.ASSIGNED
    order.assigned_at = now
    order.assignment_expires_at = now + timedelta(minutes=config.assignment_timeout_minutes)
    order.picked_up_at = None
    order.in_transit_at = None
    if assign_request.estimated_delivery_minutes:
        order.estimated_delivery_minutes = assign_request.estimated_delivery_minutes
    order.updated_at = now

    session.add(order)

    # Update new driver status
    if new_driver.status == DriverStatus.AVAILABLE:
        new_driver.status = DriverStatus.BUSY
        new_driver.updated_at = now
        session.add(new_driver)

    session.commit()

    # Update old driver status if no more active orders
    if old_driver and old_driver_user_id:
        old_active_count = get_active_orders_count(session, old_driver_user_id)
        if old_active_count == 0 and old_driver.status == DriverStatus.BUSY:
            old_driver.status = DriverStatus.AVAILABLE
            old_driver.updated_at = now
            session.add(old_driver)
            session.commit()

    session.refresh(order)

    return AssignOrderResponse(
        success=True,
        message=f"Order reassigned to {new_driver_user.full_name}",
        order=order_to_response(order, session)
    )


# =============================================================================
# DRIVER MANAGEMENT
# =============================================================================

@router.get("/profiles", response_model=List[DriverReadWithFlags])
def list_driver_profiles(
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[DriverStatus] = None,
    flagged_only: bool = False,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    List all drivers with full details (admin/staff).
    """
    # Single query with JOIN to get drivers + user info
    query = select(Driver, User).join(User, Driver.user_id == User.id)

    if status_filter:
        query = query.where(Driver.status == status_filter)

    if flagged_only:
        query = query.where(Driver.is_flagged == True)

    query = query.offset(skip).limit(limit)

    results = session.exec(query).all()

    # Build response with user info and computed stats
    response = []
    for driver, user in results:
        # Get primary vehicle
        primary_vehicle = session.exec(
            select(DriverVehicle)
            .where(DriverVehicle.driver_id == driver.id)
            .where(DriverVehicle.is_primary == True)
        ).first()

        # Compute stats from orders
        active_count = get_active_orders_count(session, user.id)

        total_deliveries = session.exec(
            select(func.count(Order.id))
            .where(Order.driver_id == user.id)
            .where(Order.status == OrderStatus.DELIVERED)
        ).one() or 0

        cancellation_count = session.exec(
            select(func.count(Order.id))
            .where(Order.driver_cancel_reason.isnot(None))
        ).one() or 0

        response.append(DriverReadWithFlags(
            id=driver.id,
            user_id=driver.user_id,
            status=driver.status,
            is_available=driver.is_available,
            max_active_orders=driver.max_active_orders,
            created_at=driver.created_at,
            updated_at=driver.updated_at,
            vehicle_type=primary_vehicle.vehicle_type if primary_vehicle else None,
            capacity_kg=primary_vehicle.capacity_kg if primary_vehicle else None,
            capacity_volume=primary_vehicle.capacity_volume if primary_vehicle else None,
            active_orders_count=active_count,
            total_deliveries=total_deliveries,
            total_earnings=0.0,  # Could compute if needed
            cancellation_count=cancellation_count,
            is_flagged=driver.is_flagged,
            flag_reason=driver.flag_reason,
            flagged_at=driver.flagged_at,
            suspended_until=driver.suspended_until,
            full_name=user.full_name,
            phone=user.phone,
            email=user.email,
        ))

    return response


@router.get("/profiles/{driver_id}", response_model=DriverReadWithFlags)
def get_driver_profile(
    driver_id: int,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get a driver's full profile with flags (admin/staff).
    """
    driver = session.exec(
        select(Driver).where(Driver.user_id == driver_id)
    ).first()

    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver record not found"
        )

    user = session.get(User, driver_id)

    # Get primary vehicle
    primary_vehicle = session.exec(
        select(DriverVehicle)
        .where(DriverVehicle.driver_id == driver.id)
        .where(DriverVehicle.is_primary == True)
    ).first()

    # Compute stats
    active_count = get_active_orders_count(session, driver_id)
    total_deliveries = session.exec(
        select(func.count(Order.id))
        .where(Order.driver_id == driver_id)
        .where(Order.status == OrderStatus.DELIVERED)
    ).one() or 0

    cancellation_count = session.exec(
        select(func.count(Order.id))
        .where(Order.driver_cancel_reason.isnot(None))
    ).one() or 0

    return DriverReadWithFlags(
        id=driver.id,
        user_id=driver.user_id,
        status=driver.status,
        is_available=driver.is_available,
        max_active_orders=driver.max_active_orders,
        created_at=driver.created_at,
        updated_at=driver.updated_at,
        vehicle_type=primary_vehicle.vehicle_type if primary_vehicle else None,
        capacity_kg=primary_vehicle.capacity_kg if primary_vehicle else None,
        capacity_volume=primary_vehicle.capacity_volume if primary_vehicle else None,
        active_orders_count=active_count,
        total_deliveries=total_deliveries,
        total_earnings=0.0,
        cancellation_count=cancellation_count,
        is_flagged=driver.is_flagged,
        flag_reason=driver.flag_reason,
        flagged_at=driver.flagged_at,
        suspended_until=driver.suspended_until,
        full_name=user.full_name if user else None,
        phone=user.phone if user else None,
        email=user.email if user else None,
    )


@router.patch("/profiles/{driver_id}", response_model=DriverReadWithFlags)
def update_driver_profile(
    driver_id: int,
    driver_update: DriverAdminUpdate,
    current_user: User = Depends(get_current_admin_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Update a driver's profile (admin only).
    """
    driver = session.exec(
        select(Driver).where(Driver.user_id == driver_id)
    ).first()

    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver record not found"
        )

    update_data = driver_update.model_dump(exclude_unset=True)
    now = datetime.now(timezone.utc)

    # Handle flagging
    if "is_flagged" in update_data:
        if update_data["is_flagged"] and not driver.is_flagged:
            driver.flagged_at = now
            driver.flagged_by_id = current_user.id
        elif not update_data["is_flagged"] and driver.is_flagged:
            driver.flagged_at = None
            driver.flagged_by_id = None
            driver.flag_reason = None

    for field, value in update_data.items():
        setattr(driver, field, value)

    driver.updated_at = now
    session.add(driver)
    session.commit()
    session.refresh(driver)

    # Build response
    user = session.get(User, driver_id)
    primary_vehicle = session.exec(
        select(DriverVehicle)
        .where(DriverVehicle.driver_id == driver.id)
        .where(DriverVehicle.is_primary == True)
    ).first()

    active_count = get_active_orders_count(session, driver_id)
    total_deliveries = session.exec(
        select(func.count(Order.id))
        .where(Order.driver_id == driver_id)
        .where(Order.status == OrderStatus.DELIVERED)
    ).one() or 0

    return DriverReadWithFlags(
        id=driver.id,
        user_id=driver.user_id,
        status=driver.status,
        is_available=driver.is_available,
        max_active_orders=driver.max_active_orders,
        created_at=driver.created_at,
        updated_at=driver.updated_at,
        vehicle_type=primary_vehicle.vehicle_type if primary_vehicle else None,
        capacity_kg=primary_vehicle.capacity_kg if primary_vehicle else None,
        capacity_volume=primary_vehicle.capacity_volume if primary_vehicle else None,
        active_orders_count=active_count,
        total_deliveries=total_deliveries,
        total_earnings=0.0,
        cancellation_count=0,
        is_flagged=driver.is_flagged,
        flag_reason=driver.flag_reason,
        flagged_at=driver.flagged_at,
        suspended_until=driver.suspended_until,
        full_name=user.full_name if user else None,
        phone=user.phone if user else None,
        email=user.email if user else None,
    )


class FlagDriverRequest(SQLModel):
    """Request to flag a driver"""
    reason: str


@router.post("/profiles/{driver_id}/flag", response_model=DriverReadWithFlags)
def flag_driver(
    driver_id: int,
    flag_request: FlagDriverRequest,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Flag a driver for review.
    """
    driver = session.exec(
        select(Driver).where(Driver.user_id == driver_id)
    ).first()

    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver record not found"
        )

    now = datetime.now(timezone.utc)
    driver.is_flagged = True
    driver.flag_reason = flag_request.reason
    driver.flagged_at = now
    driver.flagged_by_id = current_user.id
    driver.updated_at = now

    session.add(driver)
    session.commit()
    session.refresh(driver)

    # Build response
    user = session.get(User, driver_id)
    primary_vehicle = session.exec(
        select(DriverVehicle)
        .where(DriverVehicle.driver_id == driver.id)
        .where(DriverVehicle.is_primary == True)
    ).first()

    return DriverReadWithFlags(
        id=driver.id,
        user_id=driver.user_id,
        status=driver.status,
        is_available=driver.is_available,
        max_active_orders=driver.max_active_orders,
        created_at=driver.created_at,
        updated_at=driver.updated_at,
        vehicle_type=primary_vehicle.vehicle_type if primary_vehicle else None,
        capacity_kg=primary_vehicle.capacity_kg if primary_vehicle else None,
        capacity_volume=primary_vehicle.capacity_volume if primary_vehicle else None,
        active_orders_count=get_active_orders_count(session, driver_id),
        total_deliveries=0,
        total_earnings=0.0,
        cancellation_count=0,
        is_flagged=driver.is_flagged,
        flag_reason=driver.flag_reason,
        flagged_at=driver.flagged_at,
        suspended_until=driver.suspended_until,
        full_name=user.full_name if user else None,
        phone=user.phone if user else None,
        email=user.email if user else None,
    )


@router.post("/profiles/{driver_id}/unflag", response_model=DriverReadWithFlags)
def unflag_driver(
    driver_id: int,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Remove flag from a driver.
    """
    driver = session.exec(
        select(Driver).where(Driver.user_id == driver_id)
    ).first()

    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver record not found"
        )

    driver.is_flagged = False
    driver.flag_reason = None
    driver.flagged_at = None
    driver.flagged_by_id = None
    driver.updated_at = datetime.now(timezone.utc)

    session.add(driver)
    session.commit()
    session.refresh(driver)

    # Build response
    user = session.get(User, driver_id)
    primary_vehicle = session.exec(
        select(DriverVehicle)
        .where(DriverVehicle.driver_id == driver.id)
        .where(DriverVehicle.is_primary == True)
    ).first()

    return DriverReadWithFlags(
        id=driver.id,
        user_id=driver.user_id,
        status=driver.status,
        is_available=driver.is_available,
        max_active_orders=driver.max_active_orders,
        created_at=driver.created_at,
        updated_at=driver.updated_at,
        vehicle_type=primary_vehicle.vehicle_type if primary_vehicle else None,
        capacity_kg=primary_vehicle.capacity_kg if primary_vehicle else None,
        capacity_volume=primary_vehicle.capacity_volume if primary_vehicle else None,
        active_orders_count=get_active_orders_count(session, driver_id),
        total_deliveries=0,
        total_earnings=0.0,
        cancellation_count=0,
        is_flagged=driver.is_flagged,
        flag_reason=driver.flag_reason,
        flagged_at=driver.flagged_at,
        suspended_until=driver.suspended_until,
        full_name=user.full_name if user else None,
        phone=user.phone if user else None,
        email=user.email if user else None,
    )


class SuspendDriverRequest(SQLModel):
    """Request to suspend a driver"""
    reason: str
    duration_hours: int = 24


@router.post("/profiles/{driver_id}/suspend", response_model=DriverReadWithFlags)
def suspend_driver(
    driver_id: int,
    suspend_request: SuspendDriverRequest,
    current_user: User = Depends(get_current_admin_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Suspend a driver (admin only).
    """
    driver = session.exec(
        select(Driver).where(Driver.user_id == driver_id)
    ).first()

    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver record not found"
        )

    now = datetime.now(timezone.utc)
    driver.status = DriverStatus.SUSPENDED
    driver.suspended_until = now + timedelta(hours=suspend_request.duration_hours)
    driver.is_flagged = True
    driver.flag_reason = f"Suspended: {suspend_request.reason}"
    driver.flagged_at = now
    driver.flagged_by_id = current_user.id
    driver.updated_at = now

    session.add(driver)
    session.commit()
    session.refresh(driver)

    # Build response
    user = session.get(User, driver_id)
    primary_vehicle = session.exec(
        select(DriverVehicle)
        .where(DriverVehicle.driver_id == driver.id)
        .where(DriverVehicle.is_primary == True)
    ).first()

    return DriverReadWithFlags(
        id=driver.id,
        user_id=driver.user_id,
        status=driver.status,
        is_available=driver.is_available,
        max_active_orders=driver.max_active_orders,
        created_at=driver.created_at,
        updated_at=driver.updated_at,
        vehicle_type=primary_vehicle.vehicle_type if primary_vehicle else None,
        capacity_kg=primary_vehicle.capacity_kg if primary_vehicle else None,
        capacity_volume=primary_vehicle.capacity_volume if primary_vehicle else None,
        active_orders_count=get_active_orders_count(session, driver_id),
        total_deliveries=0,
        total_earnings=0.0,
        cancellation_count=0,
        is_flagged=driver.is_flagged,
        flag_reason=driver.flag_reason,
        flagged_at=driver.flagged_at,
        suspended_until=driver.suspended_until,
        full_name=user.full_name if user else None,
        phone=user.phone if user else None,
        email=user.email if user else None,
    )


@router.post("/profiles/{driver_id}/unsuspend", response_model=DriverReadWithFlags)
def unsuspend_driver(
    driver_id: int,
    current_user: User = Depends(get_current_admin_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Remove suspension from a driver (admin only).
    """
    driver = session.exec(
        select(Driver).where(Driver.user_id == driver_id)
    ).first()

    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver record not found"
        )

    driver.status = DriverStatus.OFFLINE
    driver.suspended_until = None
    driver.is_flagged = False
    driver.flag_reason = None
    driver.flagged_at = None
    driver.flagged_by_id = None
    driver.updated_at = datetime.now(timezone.utc)

    session.add(driver)
    session.commit()
    session.refresh(driver)

    # Build response
    user = session.get(User, driver_id)
    primary_vehicle = session.exec(
        select(DriverVehicle)
        .where(DriverVehicle.driver_id == driver.id)
        .where(DriverVehicle.is_primary == True)
    ).first()

    return DriverReadWithFlags(
        id=driver.id,
        user_id=driver.user_id,
        status=driver.status,
        is_available=driver.is_available,
        max_active_orders=driver.max_active_orders,
        created_at=driver.created_at,
        updated_at=driver.updated_at,
        vehicle_type=primary_vehicle.vehicle_type if primary_vehicle else None,
        capacity_kg=primary_vehicle.capacity_kg if primary_vehicle else None,
        capacity_volume=primary_vehicle.capacity_volume if primary_vehicle else None,
        active_orders_count=get_active_orders_count(session, driver_id),
        total_deliveries=0,
        total_earnings=0.0,
        cancellation_count=0,
        is_flagged=driver.is_flagged,
        flag_reason=driver.flag_reason,
        flagged_at=driver.flagged_at,
        suspended_until=driver.suspended_until,
        full_name=user.full_name if user else None,
        phone=user.phone if user else None,
        email=user.email if user else None,
    )


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

    return orders_to_response_batch(orders, session)


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

    return orders_to_response_batch(orders, session)


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
        select(func.count(Driver.id))
    ).one() or 0

    available_drivers = session.exec(
        select(func.count(Driver.id))
        .where(Driver.status == DriverStatus.AVAILABLE)
    ).one() or 0

    busy_drivers = session.exec(
        select(func.count(Driver.id))
        .where(Driver.status == DriverStatus.BUSY)
    ).one() or 0

    suspended_drivers = session.exec(
        select(func.count(Driver.id))
        .where(Driver.status == DriverStatus.SUSPENDED)
    ).one() or 0

    flagged_drivers = session.exec(
        select(func.count(Driver.id))
        .where(Driver.is_flagged == True)
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
