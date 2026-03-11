from datetime import datetime, timezone
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, func

from app.database import get_session
from app.core.security import (
    get_password_hash,
    get_current_user,
    get_current_admin_user,
)
from app.models.user import User, UserRole, UserRead
from app.models.driver import (
    Driver,
    DriverVehicle,
    DriverRead,
    DriverUpdate,
    DriverRegister,
    DriverVehicleRead,
    VehicleType,
)
from app.models.order import Order, OrderStatus, OrderWithItems, OrderItemRead, UserInfo, DriverInfo
from app.models.product import Product
from app.models.driver_config import DriverSystemConfig
from sqlmodel import SQLModel
from datetime import timedelta

router = APIRouter()


class DriverWithProfile(UserRead):
    """User with driver info included"""
    driver: DriverRead | None = None


class ConvertToDriver(SQLModel):
    """Model for converting existing user to driver"""
    full_name: str
    phone: str
    vehicle_type: VehicleType
    capacity_kg: float | None = None
    capacity_volume: float | None = None


def get_driver_stats(session: Session, driver_id: int) -> dict:
    """Compute driver stats from orders"""
    # Active orders count
    active_orders = session.exec(
        select(func.count(Order.id))
        .where(Order.driver_id == driver_id)
        .where(Order.status.in_([OrderStatus.ASSIGNED, OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT]))
    ).one()

    # Total deliveries and earnings (using shipping_cost)
    delivered_stats = session.exec(
        select(func.count(Order.id), func.coalesce(func.sum(Order.shipping_cost), 0))
        .where(Order.driver_id == driver_id)
        .where(Order.status == OrderStatus.DELIVERED)
    ).one()

    # Note: Rating system not implemented yet - returning None/0
    return {
        "active_orders_count": active_orders or 0,
        "total_deliveries": delivered_stats[0] or 0,
        "total_earnings": float(delivered_stats[1] or 0),
        "average_rating": None,
        "total_ratings": 0,
    }


def build_driver_read(driver: Driver, vehicle: DriverVehicle | None, stats: dict) -> DriverRead:
    """Build DriverRead from driver, vehicle, and stats"""
    return DriverRead(
        id=driver.id,
        user_id=driver.user_id,
        status=driver.status,
        is_available=driver.is_available,
        max_active_orders=driver.max_active_orders,
        created_at=driver.created_at,
        updated_at=driver.updated_at,
        vehicle_type=vehicle.vehicle_type if vehicle else None,
        capacity_kg=vehicle.capacity_kg if vehicle else None,
        capacity_volume=vehicle.capacity_volume if vehicle else None,
        **stats
    )


@router.post("/convert", response_model=DriverWithProfile)
def convert_to_driver(
    driver_in: ConvertToDriver,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Convert current user (e.g., Google OAuth user) to a driver.
    Creates driver + vehicle and changes role to DRIVER.
    Driver will be inactive until admin approval.
    """
    # Check if user already has a driver record
    existing_driver = session.exec(
        select(Driver).where(Driver.user_id == current_user.id)
    ).first()

    if existing_driver:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already has a driver profile",
        )

    # Update user info and role
    current_user.full_name = driver_in.full_name
    current_user.phone = driver_in.phone
    current_user.role = UserRole.DRIVER
    current_user.is_active = False  # Requires admin approval
    current_user.updated_at = datetime.now(timezone.utc)
    session.add(current_user)
    session.commit()
    session.refresh(current_user)

    # Create driver
    driver = Driver(user_id=current_user.id)
    session.add(driver)
    session.commit()
    session.refresh(driver)

    # Create vehicle
    vehicle = DriverVehicle(
        driver_id=driver.id,
        vehicle_type=driver_in.vehicle_type,
        capacity_kg=driver_in.capacity_kg,
        capacity_volume=driver_in.capacity_volume,
        is_primary=True,
    )
    session.add(vehicle)
    session.commit()
    session.refresh(vehicle)

    # Get stats (will be all zeros for new driver)
    stats = get_driver_stats(session, driver.id)
    driver_read = build_driver_read(driver, vehicle, stats)

    return DriverWithProfile(
        **UserRead.model_validate(current_user).model_dump(),
        driver=driver_read
    )


@router.post("/register", response_model=DriverWithProfile)
def register_driver(
    driver_in: DriverRegister,
    session: Session = Depends(get_session),
) -> Any:
    """
    Register a new driver (creates user + driver + vehicle).
    Driver will be inactive until admin approval.
    """
    # Check if email already exists
    existing_user = session.exec(
        select(User).where(User.email == driver_in.email)
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists",
        )

    # Create user with DRIVER role
    new_user = User(
        email=driver_in.email,
        full_name=driver_in.full_name,
        phone=driver_in.phone,
        hashed_password=get_password_hash(driver_in.password),
        role=UserRole.DRIVER,
        is_active=False,  # Requires admin approval
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)

    # Create driver
    driver = Driver(user_id=new_user.id)
    session.add(driver)
    session.commit()
    session.refresh(driver)

    # Create vehicle
    vehicle = DriverVehicle(
        driver_id=driver.id,
        vehicle_type=driver_in.vehicle_type,
        capacity_kg=driver_in.capacity_kg,
        capacity_volume=driver_in.capacity_volume,
        is_primary=True,
    )
    session.add(vehicle)
    session.commit()
    session.refresh(vehicle)

    # Get stats
    stats = get_driver_stats(session, driver.id)
    driver_read = build_driver_read(driver, vehicle, stats)

    return DriverWithProfile(
        **UserRead.model_validate(new_user).model_dump(),
        driver=driver_read
    )


@router.get("/me", response_model=DriverWithProfile)
def get_current_driver(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get current driver's profile.
    """
    if current_user.role != UserRole.DRIVER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a driver",
        )

    driver = session.exec(
        select(Driver).where(Driver.user_id == current_user.id)
    ).first()

    if not driver:
        return DriverWithProfile(
            **UserRead.model_validate(current_user).model_dump(),
            driver=None
        )

    # Get primary vehicle
    vehicle = session.exec(
        select(DriverVehicle)
        .where(DriverVehicle.driver_id == driver.id)
        .where(DriverVehicle.is_primary == True)
    ).first()

    stats = get_driver_stats(session, driver.id)
    driver_read = build_driver_read(driver, vehicle, stats)

    return DriverWithProfile(
        **UserRead.model_validate(current_user).model_dump(),
        driver=driver_read
    )


@router.patch("/me", response_model=DriverRead)
def update_driver(
    driver_update: DriverUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Update current driver's profile.
    """
    if current_user.role != UserRole.DRIVER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a driver",
        )

    driver = session.exec(
        select(Driver).where(Driver.user_id == current_user.id)
    ).first()

    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver profile not found",
        )

    # Update fields
    update_data = driver_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(driver, field, value)

    driver.updated_at = datetime.now(timezone.utc)
    session.add(driver)
    session.commit()
    session.refresh(driver)

    # Get primary vehicle
    vehicle = session.exec(
        select(DriverVehicle)
        .where(DriverVehicle.driver_id == driver.id)
        .where(DriverVehicle.is_primary == True)
    ).first()

    stats = get_driver_stats(session, driver.id)
    return build_driver_read(driver, vehicle, stats)


# Admin endpoints

@router.get("", response_model=List[DriverWithProfile])
def list_drivers(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_admin_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    List all drivers (admin only).
    """
    drivers = session.exec(
        select(User)
        .where(User.role == UserRole.DRIVER)
        .offset(skip)
        .limit(limit)
    ).all()

    result = []
    for user in drivers:
        driver = session.exec(
            select(Driver).where(Driver.user_id == user.id)
        ).first()

        if driver:
            vehicle = session.exec(
                select(DriverVehicle)
                .where(DriverVehicle.driver_id == driver.id)
                .where(DriverVehicle.is_primary == True)
            ).first()
            stats = get_driver_stats(session, driver.id)
            driver_read = build_driver_read(driver, vehicle, stats)
        else:
            driver_read = None

        result.append(DriverWithProfile(
            **UserRead.model_validate(user).model_dump(),
            driver=driver_read
        ))

    return result


@router.get("/{driver_id}", response_model=DriverWithProfile)
def get_driver(
    driver_id: int,
    current_user: User = Depends(get_current_admin_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get a specific driver by ID (admin only).
    """
    user = session.get(User, driver_id)

    if not user or user.role != UserRole.DRIVER:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found",
        )

    driver = session.exec(
        select(Driver).where(Driver.user_id == user.id)
    ).first()

    if driver:
        vehicle = session.exec(
            select(DriverVehicle)
            .where(DriverVehicle.driver_id == driver.id)
            .where(DriverVehicle.is_primary == True)
        ).first()
        stats = get_driver_stats(session, driver.id)
        driver_read = build_driver_read(driver, vehicle, stats)
    else:
        driver_read = None

    return DriverWithProfile(
        **UserRead.model_validate(user).model_dump(),
        driver=driver_read
    )


@router.patch("/{driver_id}/activate", response_model=DriverWithProfile)
def activate_driver(
    driver_id: int,
    current_user: User = Depends(get_current_admin_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Activate a driver (admin approval).
    """
    user = session.get(User, driver_id)

    if not user or user.role != UserRole.DRIVER:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found",
        )

    user.is_active = True
    user.updated_at = datetime.now(timezone.utc)
    session.add(user)
    session.commit()
    session.refresh(user)

    driver = session.exec(
        select(Driver).where(Driver.user_id == user.id)
    ).first()

    if driver:
        vehicle = session.exec(
            select(DriverVehicle)
            .where(DriverVehicle.driver_id == driver.id)
            .where(DriverVehicle.is_primary == True)
        ).first()
        stats = get_driver_stats(session, driver.id)
        driver_read = build_driver_read(driver, vehicle, stats)
    else:
        driver_read = None

    return DriverWithProfile(
        **UserRead.model_validate(user).model_dump(),
        driver=driver_read
    )


@router.patch("/{driver_id}/deactivate", response_model=DriverWithProfile)
def deactivate_driver(
    driver_id: int,
    current_user: User = Depends(get_current_admin_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Deactivate a driver.
    """
    user = session.get(User, driver_id)

    if not user or user.role != UserRole.DRIVER:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found",
        )

    user.is_active = False
    user.updated_at = datetime.now(timezone.utc)
    session.add(user)
    session.commit()
    session.refresh(user)

    driver = session.exec(
        select(Driver).where(Driver.user_id == user.id)
    ).first()

    if driver:
        vehicle = session.exec(
            select(DriverVehicle)
            .where(DriverVehicle.driver_id == driver.id)
            .where(DriverVehicle.is_primary == True)
        ).first()
        stats = get_driver_stats(session, driver.id)
        driver_read = build_driver_read(driver, vehicle, stats)
    else:
        driver_read = None

    return DriverWithProfile(
        **UserRead.model_validate(user).model_dump(),
        driver=driver_read
    )


@router.delete("/{driver_id}")
def delete_driver(
    driver_id: int,
    current_user: User = Depends(get_current_admin_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Delete a driver (admin only).
    """
    user = session.get(User, driver_id)

    if not user or user.role != UserRole.DRIVER:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found",
        )

    # Driver and vehicles will be deleted via cascade
    session.delete(user)
    session.commit()

    return {"message": "Driver deleted successfully"}


# =============================================================================
# AVAILABLE ORDERS & PICKUP ENDPOINTS
# =============================================================================

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

    # Calculate total weight and volume
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
        total_volume=total_volume if total_volume > 0 else None,
        delivery_type=order.delivery_type,
        is_full_load=order.is_full_load,
        min_vehicle_capacity_kg=order.min_vehicle_capacity_kg,
        trip_id=order.trip_id
    )


class AvailableOrderRead(SQLModel):
    """Order available for driver pickup with extra metadata"""
    order: OrderWithItems
    is_full_load: bool = False
    earnings: float = 0.0


class PickupOrderResponse(SQLModel):
    """Response after driver picks up an order"""
    success: bool
    message: str
    order: OrderWithItems | None = None


@router.get("/available-orders", response_model=list[AvailableOrderRead])
def get_available_orders(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get orders available for the current driver to pick up.
    Orders are filtered by the driver's vehicle capacity.
    Full load orders are only shown to drivers with sufficient capacity.
    """
    if current_user.role != UserRole.DRIVER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a driver",
        )

    # Get driver record
    driver = session.exec(
        select(Driver).where(Driver.user_id == current_user.id)
    ).first()

    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver profile not found",
        )

    # Get driver's primary vehicle capacity
    primary_vehicle = session.exec(
        select(DriverVehicle)
        .where(DriverVehicle.driver_id == driver.id)
        .where(DriverVehicle.is_primary == True)
        .where(DriverVehicle.is_active == True)
    ).first()

    driver_capacity_kg = primary_vehicle.capacity_kg if primary_vehicle else 0

    # Get all confirmed orders that are not assigned
    orders = session.exec(
        select(Order)
        .where(Order.status == OrderStatus.CONFIRMED)
        .where(Order.driver_id == None)
        .where(Order.trip_id == None)  # Not part of a batched trip
        .order_by(Order.created_at.asc())
    ).all()

    available_orders = []
    for order in orders:
        # For full load orders, check vehicle capacity
        if order.is_full_load and order.min_vehicle_capacity_kg:
            if driver_capacity_kg and driver_capacity_kg >= order.min_vehicle_capacity_kg:
                # Driver can handle this full load order
                available_orders.append(AvailableOrderRead(
                    order=order_to_response(order, session),
                    is_full_load=True,
                    earnings=order.shipping_cost
                ))
        else:
            # Non-full load orders are available to all drivers
            # (unless they are PRIORITY - then they're immediately available)
            available_orders.append(AvailableOrderRead(
                order=order_to_response(order, session),
                is_full_load=False,
                earnings=order.shipping_cost
            ))

    return available_orders


@router.post("/orders/{order_id}/pickup", response_model=PickupOrderResponse)
def pickup_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Driver accepts/picks up an available order.
    This assigns the order to the driver.
    """
    if current_user.role != UserRole.DRIVER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a driver",
        )

    # Get driver record
    driver = session.exec(
        select(Driver).where(Driver.user_id == current_user.id)
    ).first()

    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver profile not found",
        )

    # Check driver status
    from app.models.driver import DriverStatus
    if driver.status == DriverStatus.SUSPENDED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Driver account is suspended",
        )

    # Get order
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    # Check if order is available for pickup
    if order.status != OrderStatus.CONFIRMED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Order is not available for pickup (status: {order.status})",
        )

    if order.driver_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order is already assigned to a driver",
        )

    if order.trip_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order is part of a batched trip",
        )

    # Check vehicle capacity for full load orders
    if order.is_full_load and order.min_vehicle_capacity_kg:
        primary_vehicle = session.exec(
            select(DriverVehicle)
            .where(DriverVehicle.driver_id == driver.id)
            .where(DriverVehicle.is_primary == True)
            .where(DriverVehicle.is_active == True)
        ).first()

        if not primary_vehicle:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active primary vehicle found",
            )

        if primary_vehicle.capacity_kg and primary_vehicle.capacity_kg < order.min_vehicle_capacity_kg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Your vehicle capacity ({primary_vehicle.capacity_kg}kg) is insufficient for this order (requires {order.min_vehicle_capacity_kg}kg)",
            )

    # Check max active orders
    active_count = session.exec(
        select(func.count(Order.id))
        .where(Order.driver_id == current_user.id)
        .where(Order.status.in_([OrderStatus.ASSIGNED, OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT]))
    ).one() or 0

    if active_count >= driver.max_active_orders:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You have reached the maximum active orders ({driver.max_active_orders})",
        )

    # Assign order to driver
    config = get_system_config(session)
    now = datetime.now(timezone.utc)

    order.driver_id = current_user.id
    order.status = OrderStatus.ASSIGNED
    order.assigned_at = now
    order.assignment_expires_at = now + timedelta(minutes=config.assignment_timeout_minutes)
    order.updated_at = now

    # Update driver status to BUSY
    if driver.status == DriverStatus.AVAILABLE:
        driver.status = DriverStatus.BUSY
        driver.updated_at = now
        session.add(driver)

    session.add(order)
    session.commit()
    session.refresh(order)

    return PickupOrderResponse(
        success=True,
        message="Order successfully assigned to you",
        order=order_to_response(order, session)
    )
