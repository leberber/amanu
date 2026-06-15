from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel

from app.database import get_session
from app.core.security import get_current_staff_user, get_password_hash
from app.models.user import User, UserRead, UserRole
from app.models.driver import Driver, DriverVehicle, VehicleType

router = APIRouter()


class CreateAccountRequest(BaseModel):
    email: str
    password: str
    full_name: str
    phone: Optional[str] = None
    store_name: Optional[str] = None
    address: Optional[str] = None
    role: str = "customer"


@router.post("/create-account", response_model=UserRead)
def create_account(
    data: CreateAccountRequest,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """Create a user account (and driver profile if role=driver)."""
    existing = session.exec(select(User).where(User.email == data.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="The user with this email already exists.")

    user = User(
        email=data.email,
        hashed_password=get_password_hash(data.password),
        full_name=data.full_name,
        phone=data.phone or None,
        store_name=data.store_name or None,
        address=data.address,
        role=data.role,
        is_active=True,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    if data.role == "driver":
        driver = Driver(user_id=user.id)
        session.add(driver)
        session.commit()
        session.refresh(driver)
        session.add(DriverVehicle(
            driver_id=driver.id,
            vehicle_type=VehicleType.MINI_VAN,
            capacity_kg=10000.0,
            is_primary=True,
        ))
        session.commit()

    return user
