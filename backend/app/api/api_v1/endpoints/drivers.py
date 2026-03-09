from datetime import datetime, timezone
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.database import get_session
from app.core.security import (
    get_password_hash,
    get_current_user,
    get_current_admin_user,
)
from app.models.user import User, UserRole, UserRead
from app.models.driver import (
    DriverProfile,
    DriverProfileRead,
    DriverProfileUpdate,
    DriverRegister,
    VehicleType,
)
from sqlmodel import SQLModel

router = APIRouter()


class DriverWithProfile(UserRead):
    """User with driver profile included"""
    driver_profile: DriverProfileRead | None = None


class ConvertToDriver(SQLModel):
    """Model for converting existing user to driver"""
    full_name: str
    phone: str
    vehicle_type: VehicleType
    capacity_kg: float | None = None
    capacity_volume: float | None = None


@router.post("/convert", response_model=DriverWithProfile)
def convert_to_driver(
    driver_in: ConvertToDriver,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Convert current user (e.g., Google OAuth user) to a driver.
    Creates driver profile and changes role to DRIVER.
    Driver will be inactive until admin approval.
    """
    # Check if user already has a driver profile
    existing_profile = session.exec(
        select(DriverProfile).where(DriverProfile.user_id == current_user.id)
    ).first()

    if existing_profile:
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

    # Create driver profile
    driver_profile = DriverProfile(
        user_id=current_user.id,
        vehicle_type=driver_in.vehicle_type,
        capacity_kg=driver_in.capacity_kg,
        capacity_volume=driver_in.capacity_volume,
    )
    session.add(driver_profile)
    session.commit()
    session.refresh(driver_profile)

    # Return combined response
    return DriverWithProfile(
        **UserRead.model_validate(current_user).model_dump(),
        driver_profile=DriverProfileRead.model_validate(driver_profile)
    )


@router.post("/register", response_model=DriverWithProfile)
def register_driver(
    driver_in: DriverRegister,
    session: Session = Depends(get_session),
) -> Any:
    """
    Register a new driver (creates user + driver profile).
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

    # Create driver profile
    driver_profile = DriverProfile(
        user_id=new_user.id,
        vehicle_type=driver_in.vehicle_type,
        capacity_kg=driver_in.capacity_kg,
        capacity_volume=driver_in.capacity_volume,
    )
    session.add(driver_profile)
    session.commit()
    session.refresh(driver_profile)

    # Return combined response
    return DriverWithProfile(
        **UserRead.model_validate(new_user).model_dump(),
        driver_profile=DriverProfileRead.model_validate(driver_profile)
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

    driver_profile = session.exec(
        select(DriverProfile).where(DriverProfile.user_id == current_user.id)
    ).first()

    return DriverWithProfile(
        **UserRead.model_validate(current_user).model_dump(),
        driver_profile=DriverProfileRead.model_validate(driver_profile) if driver_profile else None
    )


@router.patch("/me", response_model=DriverProfileRead)
def update_driver_profile(
    profile_in: DriverProfileUpdate,
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

    driver_profile = session.exec(
        select(DriverProfile).where(DriverProfile.user_id == current_user.id)
    ).first()

    if not driver_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver profile not found",
        )

    # Update fields
    update_data = profile_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(driver_profile, field, value)

    driver_profile.updated_at = datetime.now(timezone.utc)
    session.add(driver_profile)
    session.commit()
    session.refresh(driver_profile)

    return driver_profile


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
    for driver in drivers:
        profile = session.exec(
            select(DriverProfile).where(DriverProfile.user_id == driver.id)
        ).first()

        result.append(DriverWithProfile(
            **UserRead.model_validate(driver).model_dump(),
            driver_profile=DriverProfileRead.model_validate(profile) if profile else None
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
    driver = session.get(User, driver_id)

    if not driver or driver.role != UserRole.DRIVER:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found",
        )

    profile = session.exec(
        select(DriverProfile).where(DriverProfile.user_id == driver.id)
    ).first()

    return DriverWithProfile(
        **UserRead.model_validate(driver).model_dump(),
        driver_profile=DriverProfileRead.model_validate(profile) if profile else None
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
    driver = session.get(User, driver_id)

    if not driver or driver.role != UserRole.DRIVER:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found",
        )

    driver.is_active = True
    driver.updated_at = datetime.now(timezone.utc)
    session.add(driver)
    session.commit()
    session.refresh(driver)

    profile = session.exec(
        select(DriverProfile).where(DriverProfile.user_id == driver.id)
    ).first()

    return DriverWithProfile(
        **UserRead.model_validate(driver).model_dump(),
        driver_profile=DriverProfileRead.model_validate(profile) if profile else None
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
    driver = session.get(User, driver_id)

    if not driver or driver.role != UserRole.DRIVER:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found",
        )

    driver.is_active = False
    driver.updated_at = datetime.now(timezone.utc)
    session.add(driver)
    session.commit()
    session.refresh(driver)

    profile = session.exec(
        select(DriverProfile).where(DriverProfile.user_id == driver.id)
    ).first()

    return DriverWithProfile(
        **UserRead.model_validate(driver).model_dump(),
        driver_profile=DriverProfileRead.model_validate(profile) if profile else None
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
    driver = session.get(User, driver_id)

    if not driver or driver.role != UserRole.DRIVER:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found",
        )

    # Profile will be deleted via cascade
    session.delete(driver)
    session.commit()

    return {"message": "Driver deleted successfully"}
