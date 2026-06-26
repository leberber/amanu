from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from typing import Any, List, Optional
from datetime import datetime, timezone

from app.database import get_session
from app.models.brand import Brand, BrandCreate, BrandUpdate, BrandRead
from app.models.product import Product
from app.models.segment import ProductSegment
from app.models.user import User
from app.core.security import get_current_staff_user
from app.core.translation import TranslationService

router = APIRouter()

@router.get("", response_model=List[BrandRead])
def read_brands(
    active_only: bool = Query(True),
    lang: str = Query("en", description="Language for translations (en, fr, ar)"),
    category_id: Optional[int] = Query(None, description="Filter brands by category"),
    segment_id: Optional[int] = Query(None, description="Filter brands by segment"),
    session: Session = Depends(get_session),
) -> Any:
    """
    Retrieve all brands, optionally filtered by category and/or segment.
    """
    query = select(Brand)

    if active_only:
        query = query.where(Brand.is_active == True)

    if category_id is not None and segment_id is not None:
        product_ids_in_segment = select(ProductSegment.product_id).where(
            ProductSegment.segment_id == segment_id
        )
        brand_ids = select(Product.brand_id).where(
            Product.category_id == category_id,
            Product.is_active == True,
            Product.brand_id != None,
            Product.id.in_(product_ids_in_segment)
        )
        query = query.where(Brand.id.in_(brand_ids))
    elif category_id is not None:
        brand_ids_in_category = select(Product.brand_id).where(
            Product.category_id == category_id,
            Product.is_active == True,
            Product.brand_id != None
        )
        query = query.where(Brand.id.in_(brand_ids_in_category))
    elif segment_id is not None:
        product_ids_in_segment = select(ProductSegment.product_id).where(
            ProductSegment.segment_id == segment_id
        )
        brand_ids_in_segment = select(Product.brand_id).where(
            Product.id.in_(product_ids_in_segment),
            Product.is_active == True,
            Product.brand_id != None
        )
        query = query.where(Brand.id.in_(brand_ids_in_segment))

    brands = session.exec(query).all()

    # Apply translations to each brand
    for brand in brands:
        TranslationService.apply_translations_to_model(brand, lang)

    return brands

@router.get("/{brand_id}", response_model=BrandRead)
def read_brand(
    brand_id: int,
    lang: str = Query("en", description="Language for translations (en, fr, ar)"),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get brand by ID.
    """
    brand = session.get(Brand, brand_id)
    if not brand:
        raise HTTPException(
            status_code=404,
            detail="Brand not found",
        )

    # Apply translations
    TranslationService.apply_translations_to_model(brand, lang)

    return brand

@router.post("", response_model=BrandRead)
def create_brand(
    brand_in: BrandCreate,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Create a new brand (staff only).
    """
    brand = Brand.model_validate(brand_in)
    brand.created_at = datetime.now(timezone.utc)

    session.add(brand)
    session.commit()
    session.refresh(brand)
    return brand

@router.patch("/{brand_id}", response_model=BrandRead)
def update_brand(
    brand_id: int,
    brand_in: BrandUpdate,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Update a brand (staff only).
    """
    brand = session.get(Brand, brand_id)
    if not brand:
        raise HTTPException(
            status_code=404,
            detail="Brand not found",
        )

    # Update fields
    update_data = brand_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(brand, field, value)

    brand.updated_at = datetime.now(timezone.utc)

    session.add(brand)
    session.commit()
    session.refresh(brand)
    return brand

@router.delete("/{brand_id}")
def delete_brand(
    brand_id: int,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Delete a brand (staff only).
    """
    brand = session.get(Brand, brand_id)
    if not brand:
        raise HTTPException(
            status_code=404,
            detail="Brand not found",
        )

    # Check if brand has related products
    if brand.products:
        # Instead of deleting, mark as inactive
        brand.is_active = False
        brand.updated_at = datetime.now(timezone.utc)
        session.add(brand)
        session.commit()
    else:
        # Delete brand if no related products
        session.delete(brand)
        session.commit()

    return None
