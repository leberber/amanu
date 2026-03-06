from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, SQLModel
from sqlalchemy.orm import selectinload
from typing import Any, List, Optional
from datetime import datetime, timezone
from math import floor

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
from app.services.discount_validation import (
    validate_date_range,
    validate_percentage_discount,
    validate_free_units_discount,
)
from app.services.discount_calculation import (
    calculate_volume_discount,
    VolumeDiscountConfig,
    VolumeDiscountType as CalcVolumeDiscountType,
)

router = APIRouter()


# ============================================
# Request/Response Models for Calculate
# ============================================

class VolumeDiscountCartItem(SQLModel):
    """Cart item for volume discount calculation"""
    product_id: int
    quantity: int
    unit_price: float
    pieces_per_box: int = 1


class AppliedVolumeDiscountItem(SQLModel):
    """Applied volume discount result for a single item"""
    product_id: int
    discount_id: int
    discount_name: str
    discount_type: str
    saved_amount: float
    free_units: int
    free_cartons: int
    sets: int


class VolumeDiscountCalculationRequest(SQLModel):
    """Request for calculating volume discounts"""
    cart_items: List[VolumeDiscountCartItem]


class VolumeDiscountCalculationResponse(SQLModel):
    """Response with applied volume discounts"""
    applied_discounts: List[AppliedVolumeDiscountItem]
    total_savings: float
    total_free_units: int


# ============================================
# Helper Functions
# ============================================

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
    # Use shared validation utilities
    validate_date_range(discount_in.start_date, discount_in.end_date)
    validate_percentage_discount(discount_in.discount_type, discount_in.discount_value)
    validate_free_units_discount(
        discount_in.discount_type,
        discount_in.discount_value,
        discount_in.min_quantity
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

    # Get effective values for validation
    new_start = update_data.get("start_date", discount.start_date)
    new_end = update_data.get("end_date", discount.end_date)
    new_type = update_data.get("discount_type", discount.discount_type)
    new_value = update_data.get("discount_value", discount.discount_value)
    new_min_qty = update_data.get("min_quantity", discount.min_quantity)

    # Use shared validation utilities
    validate_date_range(new_start, new_end)
    validate_percentage_discount(new_type, new_value)
    validate_free_units_discount(new_type, new_value, new_min_qty)

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


@router.post("/calculate", response_model=VolumeDiscountCalculationResponse)
def calculate_volume_discounts(
    request: VolumeDiscountCalculationRequest,
    session: Session = Depends(get_session),
) -> Any:
    """
    Calculate volume discounts for cart items (public endpoint).
    Returns applicable volume discounts based on cart contents.

    This mirrors the frontend calculation logic to ensure consistency.
    """
    if not request.cart_items:
        return VolumeDiscountCalculationResponse(
            applied_discounts=[],
            total_savings=0,
            total_free_units=0
        )

    # Get unique product IDs from cart
    product_ids = list(set(item.product_id for item in request.cart_items))

    # Get all active volume discounts for these products
    now = datetime.now(timezone.utc)
    query = (
        select(VolumeDiscount)
        .options(selectinload(VolumeDiscount.product))
        .where(
            VolumeDiscount.product_id.in_(product_ids),
            VolumeDiscount.is_active == True,
            VolumeDiscount.start_date <= now,
            VolumeDiscount.end_date >= now
        )
    )
    active_discounts = session.exec(query).all()

    if not active_discounts:
        return VolumeDiscountCalculationResponse(
            applied_discounts=[],
            total_savings=0,
            total_free_units=0
        )

    # Build lookup by product_id
    discount_by_product = {d.product_id: d for d in active_discounts}

    applied_discounts = []
    total_savings = 0
    total_free_units = 0

    for item in request.cart_items:
        discount = discount_by_product.get(item.product_id)
        if not discount:
            continue

        # Convert quantity to cartons
        cartons_ordered = floor(item.quantity / item.pieces_per_box)

        if cartons_ordered < discount.min_quantity:
            continue

        # Use shared calculation service
        discount_config = VolumeDiscountConfig(
            discount_type=CalcVolumeDiscountType(discount.discount_type),
            discount_value=discount.discount_value,
            min_quantity=discount.min_quantity
        )

        result = calculate_volume_discount(
            cartons_ordered,
            discount_config,
            item.unit_price,
            item.pieces_per_box
        )

        if result.qualifies:
            applied_discounts.append(AppliedVolumeDiscountItem(
                product_id=item.product_id,
                discount_id=discount.id,
                discount_name=discount.name,
                discount_type=discount.discount_type,
                saved_amount=result.saved_amount,
                free_units=result.free_units,
                free_cartons=result.free_cartons,
                sets=result.sets
            ))
            total_savings += result.saved_amount
            total_free_units += result.free_units

    return VolumeDiscountCalculationResponse(
        applied_discounts=applied_discounts,
        total_savings=round(total_savings, 2),
        total_free_units=total_free_units
    )
