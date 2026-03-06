from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from sqlalchemy.orm import selectinload
from typing import Any, List
from datetime import datetime, timezone

from app.database import get_session
from app.models.volume_discount import (
    VolumeDiscount,
    VolumeDiscountCreate,
    VolumeDiscountUpdate,
    VolumeDiscountRead,
    VolumeDiscountType,
)
from app.models.product import Product
from app.models.user import User
from app.core.security import get_current_staff_user

router = APIRouter()


def volume_discount_to_read(discount: VolumeDiscount) -> VolumeDiscountRead:
    """Convert VolumeDiscount to VolumeDiscountRead with product info"""
    return VolumeDiscountRead(
        id=discount.id,
        name=discount.name,
        description=discount.description,
        product_id=discount.product_id,
        min_quantity=discount.min_quantity,
        discount_type=discount.discount_type,
        discount_value=discount.discount_value,
        start_date=discount.start_date,
        end_date=discount.end_date,
        is_active=discount.is_active,
        created_at=discount.created_at,
        updated_at=discount.updated_at,
        product_name=discount.product.name if discount.product else None,
        product_image=discount.product.image_url if discount.product else None,
        product_pieces_per_box=discount.product.pieces_per_box if discount.product else None,
        product_packaging_type=discount.product.packaging_type if discount.product else None,
    )


@router.get("/", response_model=List[VolumeDiscountRead])
def read_volume_discounts(
    active_only: bool = Query(False),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
) -> Any:
    """
    Retrieve all volume discounts (staff only).
    """
    query = (
        select(VolumeDiscount)
        .options(selectinload(VolumeDiscount.product))
        .order_by(VolumeDiscount.created_at.desc())
    )

    if active_only:
        now = datetime.now(timezone.utc)
        query = query.where(
            VolumeDiscount.is_active == True,
            VolumeDiscount.start_date <= now,
            VolumeDiscount.end_date >= now
        )

    discounts = session.exec(query).all()
    return [volume_discount_to_read(d) for d in discounts]


@router.get("/active", response_model=List[VolumeDiscountRead])
def read_active_volume_discounts(
    session: Session = Depends(get_session),
) -> Any:
    """
    Retrieve currently active volume discounts (public).
    """
    now = datetime.now(timezone.utc)
    query = (
        select(VolumeDiscount)
        .options(selectinload(VolumeDiscount.product))
        .where(
            VolumeDiscount.is_active == True,
            VolumeDiscount.start_date <= now,
            VolumeDiscount.end_date >= now
        )
        .order_by(VolumeDiscount.min_quantity.asc())
    )

    discounts = session.exec(query).all()
    return [volume_discount_to_read(d) for d in discounts]


@router.get("/{discount_id}", response_model=VolumeDiscountRead)
def read_volume_discount(
    discount_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
) -> Any:
    """
    Get volume discount by ID (staff only).
    """
    query = (
        select(VolumeDiscount)
        .options(selectinload(VolumeDiscount.product))
        .where(VolumeDiscount.id == discount_id)
    )
    discount = session.exec(query).first()

    if not discount:
        raise HTTPException(status_code=404, detail="Volume discount not found")

    return volume_discount_to_read(discount)


@router.post("/", response_model=VolumeDiscountRead)
def create_volume_discount(
    discount_in: VolumeDiscountCreate,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Create a new volume discount (staff only).
    """
    # Validate dates
    if discount_in.end_date <= discount_in.start_date:
        raise HTTPException(
            status_code=400,
            detail="End date must be after start date"
        )

    # Validate discount value for percentage
    if discount_in.discount_type == VolumeDiscountType.PERCENTAGE and discount_in.discount_value > 100:
        raise HTTPException(
            status_code=400,
            detail="Percentage discount cannot exceed 100%"
        )

    # Validate free units doesn't exceed min_quantity
    if discount_in.discount_type == VolumeDiscountType.FREE_UNITS:
        if discount_in.discount_value >= discount_in.min_quantity:
            raise HTTPException(
                status_code=400,
                detail="Free units cannot be equal to or greater than minimum quantity"
            )

    # Verify product exists
    product = session.get(Product, discount_in.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Create discount
    discount = VolumeDiscount(
        **discount_in.model_dump(),
        created_at=datetime.now(timezone.utc)
    )

    session.add(discount)
    session.commit()
    session.refresh(discount)

    # Reload with product relationship
    query = (
        select(VolumeDiscount)
        .options(selectinload(VolumeDiscount.product))
        .where(VolumeDiscount.id == discount.id)
    )
    discount = session.exec(query).first()

    return volume_discount_to_read(discount)


@router.patch("/{discount_id}", response_model=VolumeDiscountRead)
def update_volume_discount(
    discount_id: int,
    discount_in: VolumeDiscountUpdate,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Update a volume discount (staff only).
    """
    discount = session.get(VolumeDiscount, discount_id)
    if not discount:
        raise HTTPException(status_code=404, detail="Volume discount not found")

    update_data = discount_in.model_dump(exclude_unset=True)

    # Validate dates
    new_start = update_data.get("start_date", discount.start_date)
    new_end = update_data.get("end_date", discount.end_date)
    if new_end <= new_start:
        raise HTTPException(
            status_code=400,
            detail="End date must be after start date"
        )

    # Validate discount value for percentage
    new_type = update_data.get("discount_type", discount.discount_type)
    new_value = update_data.get("discount_value", discount.discount_value)
    if new_type == VolumeDiscountType.PERCENTAGE and new_value > 100:
        raise HTTPException(
            status_code=400,
            detail="Percentage discount cannot exceed 100%"
        )

    # Validate free units
    new_min_qty = update_data.get("min_quantity", discount.min_quantity)
    if new_type == VolumeDiscountType.FREE_UNITS and new_value >= new_min_qty:
        raise HTTPException(
            status_code=400,
            detail="Free units cannot be equal to or greater than minimum quantity"
        )

    for field, value in update_data.items():
        setattr(discount, field, value)

    discount.updated_at = datetime.now(timezone.utc)

    session.add(discount)
    session.commit()
    session.refresh(discount)

    # Reload with product relationship
    query = (
        select(VolumeDiscount)
        .options(selectinload(VolumeDiscount.product))
        .where(VolumeDiscount.id == discount.id)
    )
    discount = session.exec(query).first()

    return volume_discount_to_read(discount)


@router.delete("/{discount_id}")
def delete_volume_discount(
    discount_id: int,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Delete a volume discount (staff only).
    """
    discount = session.get(VolumeDiscount, discount_id)
    if not discount:
        raise HTTPException(status_code=404, detail="Volume discount not found")

    session.delete(discount)
    session.commit()
    return {"message": "Volume discount deleted"}


@router.get("/product/{product_id}", response_model=List[VolumeDiscountRead])
def get_product_volume_discounts(
    product_id: int,
    session: Session = Depends(get_session),
) -> Any:
    """
    Get active volume discounts for a specific product (public).
    """
    now = datetime.now(timezone.utc)
    query = (
        select(VolumeDiscount)
        .options(selectinload(VolumeDiscount.product))
        .where(
            VolumeDiscount.product_id == product_id,
            VolumeDiscount.is_active == True,
            VolumeDiscount.start_date <= now,
            VolumeDiscount.end_date >= now
        )
        .order_by(VolumeDiscount.min_quantity.asc())
    )

    discounts = session.exec(query).all()
    return [volume_discount_to_read(d) for d in discounts]
