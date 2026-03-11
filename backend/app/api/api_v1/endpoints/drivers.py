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
from app.models.order import Order, OrderStatus
from sqlmodel import SQLModel

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

    # Total deliveries and earnings
    delivered_stats = session.exec(
        select(func.count(Order.id), func.coalesce(func.sum(Order.delivery_fee), 0))
        .where(Order.driver_id == driver_id)
        .where(Order.status == OrderStatus.DELIVERED)
    ).one()

    # Ratings
    rating_stats = session.exec(
        select(func.avg(Order.rating), func.count(Order.rating))
        .where(Order.driver_id == driver_id)
        .where(Order.rating.isnot(None))
    ).one()

    return {
        "active_orders_count": active_orders or 0,
        "total_deliveries": delivered_stats[0] or 0,
        "total_earnings": float(delivered_stats[1] or 0),
        "average_rating": float(rating_stats[0]) if rating_stats[0] else None,
        "total_ratings": rating_stats[1] or 0,
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
