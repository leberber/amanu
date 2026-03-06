from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from sqlalchemy.orm import selectinload
from typing import Any, List, Optional
from datetime import datetime, timezone

from app.database import get_session
from app.models.promotion import (
    Promotion,
    PromotionCreate,
    PromotionUpdate,
    PromotionRead,
    PromotionValidation,
    DiscountCalculationRequest,
    DiscountCalculationResponse,
    AutoApplyRequest,
    AutoApplyResponse,
    AppliedPromotionItem,
    DiscountType,
    PromotionScope,
)
from app.models.product import Product
from app.models.category import Category
from app.models.brand import Brand
from app.models.user import User
from app.core.security import get_current_staff_user, get_current_active_user
from app.core.translation import TranslationService

router = APIRouter()


def promotion_to_read(promotion: Promotion) -> PromotionRead:
    """Convert Promotion to PromotionRead with entity names and images from relationships"""
    return PromotionRead(
        id=promotion.id,
        name=promotion.name,
        description=promotion.description,
        code=promotion.code,
        name_translations=promotion.name_translations,
        description_translations=promotion.description_translations,
        discount_type=promotion.discount_type,
        discount_value=promotion.discount_value,
        scope=promotion.scope,
        category_id=promotion.category_id,
        brand_id=promotion.brand_id,
        product_id=promotion.product_id,
        min_order_amount=promotion.min_order_amount,
        max_discount=promotion.max_discount,
        usage_limit=promotion.usage_limit,
        usage_count=promotion.usage_count,
        start_date=promotion.start_date,
        end_date=promotion.end_date,
        is_active=promotion.is_active,
        created_by=promotion.created_by,
        created_at=promotion.created_at,
        updated_at=promotion.updated_at,
        category_name=promotion.category.name if promotion.category else None,
        brand_name=promotion.brand.name if promotion.brand else None,
        product_name=promotion.product.name if promotion.product else None,
        category_image=promotion.category.image_url if promotion.category else None,
        brand_image=promotion.brand.logo_url if promotion.brand else None,
        product_image=promotion.product.image_url if promotion.product else None,
    )


def get_promotion_status(promotion: Promotion) -> str:
    """Get the current status of a promotion"""
    now = datetime.now(timezone.utc)
    if not promotion.is_active:
        return "inactive"
    if now < promotion.start_date:
        return "scheduled"
    if now > promotion.end_date:
        return "expired"
    if promotion.usage_limit and promotion.usage_count >= promotion.usage_limit:
        return "limit_reached"
    return "active"


@router.get("/", response_model=List[PromotionRead])
def read_promotions(
    active_only: bool = Query(False),
    lang: str = Query("en", description="Language for translations (en, fr, ar)"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
) -> Any:
    """
    Retrieve all promotions (staff only).
    """
    query = select(Promotion).order_by(Promotion.created_at.desc())

    if active_only:
        now = datetime.now(timezone.utc)
        query = query.where(
            Promotion.is_active == True,
            Promotion.start_date <= now,
            Promotion.end_date >= now
        )

    promotions = session.exec(query).all()

    # Apply translations
    for promotion in promotions:
        TranslationService.apply_translations_to_model(promotion, lang)

    return promotions


@router.get("/active", response_model=List[PromotionRead])
def read_active_promotions(
    lang: str = Query("en", description="Language for translations (en, fr, ar)"),
    session: Session = Depends(get_session),
) -> Any:
    """
    Retrieve currently active promotions (public).
    """
    now = datetime.now(timezone.utc)
    query = (
        select(Promotion)
        .options(
            selectinload(Promotion.category),
            selectinload(Promotion.brand),
            selectinload(Promotion.product),
        )
        .where(
            Promotion.is_active == True,
            Promotion.start_date <= now,
            Promotion.end_date >= now
        )
        .order_by(Promotion.created_at.desc())
    )

    promotions = session.exec(query).all()

    # Filter out promotions that have reached usage limit
    active_promotions = [
        p for p in promotions
        if p.usage_limit is None or p.usage_count < p.usage_limit
    ]

    # Convert to PromotionRead with entity names and apply translations
    result = []
    for promotion in active_promotions:
        TranslationService.apply_translations_to_model(promotion, lang)
        result.append(promotion_to_read(promotion))

    return result


@router.get("/code/{code}", response_model=PromotionValidation)
def validate_promo_code(
    code: str,
    lang: str = Query("en", description="Language for translations (en, fr, ar)"),
    session: Session = Depends(get_session),
) -> Any:
    """
    Validate a promotion code (public).
    """
    # Find promotion by code (case-insensitive)
    query = select(Promotion).where(Promotion.code.ilike(code))
    promotion = session.exec(query).first()

    if not promotion:
        return PromotionValidation(valid=False, error="Invalid promotion code")

    # Check if promotion is active
    if not promotion.is_active:
        return PromotionValidation(valid=False, error="This promotion is no longer active")

    # Check date validity
    now = datetime.now(timezone.utc)
    if now < promotion.start_date:
        return PromotionValidation(valid=False, error="This promotion has not started yet")
    if now > promotion.end_date:
        return PromotionValidation(valid=False, error="This promotion has expired")

    # Check usage limit
    if promotion.usage_limit and promotion.usage_count >= promotion.usage_limit:
        return PromotionValidation(valid=False, error="This promotion has reached its usage limit")

    # Apply translations
    TranslationService.apply_translations_to_model(promotion, lang)

    return PromotionValidation(valid=True, promotion=promotion)


@router.get("/{promotion_id}", response_model=PromotionRead)
def read_promotion(
    promotion_id: int,
    lang: str = Query("en", description="Language for translations (en, fr, ar)"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
) -> Any:
    """
    Get promotion by ID (staff only).
    """
    promotion = session.get(Promotion, promotion_id)
    if not promotion:
        raise HTTPException(status_code=404, detail="Promotion not found")

    TranslationService.apply_translations_to_model(promotion, lang)
    return promotion


@router.post("/", response_model=PromotionRead)
def create_promotion(
    promotion_in: PromotionCreate,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Create a new promotion (staff only).
    """
    # Validate dates
    if promotion_in.end_date <= promotion_in.start_date:
        raise HTTPException(
            status_code=400,
            detail="End date must be after start date"
        )

    # Validate discount value for percentage
    if promotion_in.discount_type == DiscountType.PERCENTAGE and promotion_in.discount_value > 100:
        raise HTTPException(
            status_code=400,
            detail="Percentage discount cannot exceed 100%"
        )

    # Check if code already exists (if provided)
    if promotion_in.code:
        existing = session.exec(
            select(Promotion).where(Promotion.code.ilike(promotion_in.code))
        ).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail="A promotion with this code already exists"
            )

    # Validate scope-specific fields
    if promotion_in.scope == PromotionScope.CATEGORY and not promotion_in.category_id:
        raise HTTPException(
            status_code=400,
            detail="Category ID is required for category-scoped promotions"
        )
    if promotion_in.scope == PromotionScope.BRAND and not promotion_in.brand_id:
        raise HTTPException(
            status_code=400,
            detail="Brand ID is required for brand-scoped promotions"
        )
    if promotion_in.scope == PromotionScope.PRODUCT and not promotion_in.product_id:
        raise HTTPException(
            status_code=400,
            detail="Product ID is required for product-scoped promotions"
        )

    # Create promotion
    promotion = Promotion(
        **promotion_in.model_dump(),
        created_by=current_user.id,
        created_at=datetime.now(timezone.utc)
    )

    session.add(promotion)
    session.commit()
    session.refresh(promotion)
    return promotion


@router.patch("/{promotion_id}", response_model=PromotionRead)
def update_promotion(
    promotion_id: int,
    promotion_in: PromotionUpdate,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Update a promotion (staff only).
    """
    promotion = session.get(Promotion, promotion_id)
    if not promotion:
        raise HTTPException(status_code=404, detail="Promotion not found")

    # Update fields
    update_data = promotion_in.model_dump(exclude_unset=True)

    # Validate dates if both are being updated
    new_start = update_data.get("start_date", promotion.start_date)
    new_end = update_data.get("end_date", promotion.end_date)
    if new_end <= new_start:
        raise HTTPException(
            status_code=400,
            detail="End date must be after start date"
        )

    # Validate discount value for percentage
    new_type = update_data.get("discount_type", promotion.discount_type)
    new_value = update_data.get("discount_value", promotion.discount_value)
    if new_type == DiscountType.PERCENTAGE and new_value > 100:
        raise HTTPException(
            status_code=400,
            detail="Percentage discount cannot exceed 100%"
        )

    # Check if code already exists (if being changed)
    if "code" in update_data and update_data["code"]:
        existing = session.exec(
            select(Promotion).where(
                Promotion.code.ilike(update_data["code"]),
                Promotion.id != promotion_id
            )
        ).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail="A promotion with this code already exists"
            )

    for field, value in update_data.items():
        setattr(promotion, field, value)

    promotion.updated_at = datetime.now(timezone.utc)

    session.add(promotion)
    session.commit()
    session.refresh(promotion)
    return promotion


@router.delete("/{promotion_id}")
def delete_promotion(
    promotion_id: int,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Delete a promotion (staff only).
    """
    promotion = session.get(Promotion, promotion_id)
    if not promotion:
        raise HTTPException(status_code=404, detail="Promotion not found")

    # If promotion has been used, soft delete (deactivate) instead
    if promotion.usage_count > 0:
        promotion.is_active = False
        promotion.updated_at = datetime.now(timezone.utc)
        session.add(promotion)
        session.commit()
        return {"message": "Promotion deactivated (has usage history)"}

    # Hard delete if never used
    session.delete(promotion)
    session.commit()
    return {"message": "Promotion deleted"}


@router.post("/calculate", response_model=DiscountCalculationResponse)
def calculate_discount(
    request: DiscountCalculationRequest,
    session: Session = Depends(get_session),
) -> Any:
    """
    Calculate discount for a cart with a promotion code (public).
    """
    # Calculate subtotal
    subtotal = sum(item.unit_price * item.quantity for item in request.cart_items)

    # Validate promo code
    query = select(Promotion).where(Promotion.code.ilike(request.promotion_code))
    promotion = session.exec(query).first()

    if not promotion:
        return DiscountCalculationResponse(
            subtotal=round(subtotal, 2),
            discount_amount=0,
            total=round(subtotal, 2),
            error="Invalid promotion code"
        )

    # Check validity
    if not promotion.is_valid():
        status = get_promotion_status(promotion)
        error_messages = {
            "inactive": "This promotion is no longer active",
            "scheduled": "This promotion has not started yet",
            "expired": "This promotion has expired",
            "limit_reached": "This promotion has reached its usage limit"
        }
        return DiscountCalculationResponse(
            subtotal=round(subtotal, 2),
            discount_amount=0,
            total=round(subtotal, 2),
            error=error_messages.get(status, "Promotion is not valid")
        )

    # Check minimum order amount
    if subtotal < promotion.min_order_amount:
        return DiscountCalculationResponse(
            subtotal=round(subtotal, 2),
            discount_amount=0,
            total=round(subtotal, 2),
            error=f"Minimum order amount of {promotion.min_order_amount} required"
        )

    # Calculate discount based on scope
    discount_amount = 0

    if promotion.scope == PromotionScope.GLOBAL:
        # Apply to entire order
        discount_amount = promotion.calculate_discount(subtotal)

    elif promotion.scope == PromotionScope.CATEGORY:
        # Get products in the category and calculate their total
        category_total = 0
        for item in request.cart_items:
            product = session.get(Product, item.product_id)
            if product and product.category_id == promotion.category_id:
                category_total += item.unit_price * item.quantity
        discount_amount = promotion.calculate_discount(category_total)

    elif promotion.scope == PromotionScope.BRAND:
        # Get products from the brand and calculate their total
        brand_total = 0
        for item in request.cart_items:
            product = session.get(Product, item.product_id)
            if product and product.brand_id == promotion.brand_id:
                brand_total += item.unit_price * item.quantity
        discount_amount = promotion.calculate_discount(brand_total)

    elif promotion.scope == PromotionScope.PRODUCT:
        # Apply only to specific product
        product_total = 0
        for item in request.cart_items:
            if item.product_id == promotion.product_id:
                product_total += item.unit_price * item.quantity
        discount_amount = promotion.calculate_discount(product_total)

    total = subtotal - discount_amount

    return DiscountCalculationResponse(
        subtotal=round(subtotal, 2),
        discount_amount=round(discount_amount, 2),
        total=round(total, 2),
        promotion=promotion
    )


@router.post("/auto-apply", response_model=AutoApplyResponse)
def auto_apply_promotions(
    request: AutoApplyRequest,
    session: Session = Depends(get_session),
) -> Any:
    """
    Automatically find and apply the best eligible promotions for a cart (public).
    Returns the best applicable promotion based on cart contents.
    """
    # Calculate subtotal
    subtotal = sum(item.unit_price * item.quantity for item in request.cart_items)

    if not request.cart_items or subtotal == 0:
        return AutoApplyResponse(
            subtotal=0,
            total_discount=0,
            final_total=0,
            applied_promotions=[],
            best_promotion=None,
            best_discount_amount=0
        )

    # Get all active promotions
    now = datetime.now(timezone.utc)
    query = (
        select(Promotion)
        .options(
            selectinload(Promotion.category),
            selectinload(Promotion.brand),
            selectinload(Promotion.product),
        )
        .where(
            Promotion.is_active == True,
            Promotion.start_date <= now,
            Promotion.end_date >= now
        )
    )
    promotions = session.exec(query).all()

    # Filter valid promotions (not reached usage limit)
    valid_promotions = [
        p for p in promotions
        if p.usage_limit is None or p.usage_count < p.usage_limit
    ]

    if not valid_promotions:
        return AutoApplyResponse(
            subtotal=round(subtotal, 2),
            total_discount=0,
            final_total=round(subtotal, 2),
            applied_promotions=[],
            best_promotion=None,
            best_discount_amount=0
        )

    # Build lookup for cart items
    cart_by_product = {item.product_id: item for item in request.cart_items}
    cart_by_category: dict = {}
    cart_by_brand: dict = {}

    for item in request.cart_items:
        if item.category_id:
            if item.category_id not in cart_by_category:
                cart_by_category[item.category_id] = []
            cart_by_category[item.category_id].append(item)
        if item.brand_id:
            if item.brand_id not in cart_by_brand:
                cart_by_brand[item.brand_id] = []
            cart_by_brand[item.brand_id].append(item)

    # Calculate discount for each applicable promotion
    applicable_promotions: list = []

    for promotion in valid_promotions:
        discount_amount = 0
        applicable_amount = 0

        if promotion.scope == PromotionScope.GLOBAL:
            # Apply to entire order if meets min amount
            if subtotal >= promotion.min_order_amount:
                applicable_amount = subtotal
                discount_amount = promotion.calculate_discount(subtotal)

        elif promotion.scope == PromotionScope.CATEGORY:
            # Apply to items in the category
            if promotion.category_id in cart_by_category:
                category_items = cart_by_category[promotion.category_id]
                category_total = sum(i.unit_price * i.quantity for i in category_items)
                if category_total >= promotion.min_order_amount:
                    applicable_amount = category_total
                    discount_amount = promotion.calculate_discount(category_total)

        elif promotion.scope == PromotionScope.BRAND:
            # Apply to items from the brand
            if promotion.brand_id in cart_by_brand:
                brand_items = cart_by_brand[promotion.brand_id]
                brand_total = sum(i.unit_price * i.quantity for i in brand_items)
                if brand_total >= promotion.min_order_amount:
                    applicable_amount = brand_total
                    discount_amount = promotion.calculate_discount(brand_total)

        elif promotion.scope == PromotionScope.PRODUCT:
            # Apply to specific product
            if promotion.product_id in cart_by_product:
                item = cart_by_product[promotion.product_id]
                product_total = item.unit_price * item.quantity
                if product_total >= promotion.min_order_amount:
                    applicable_amount = product_total
                    discount_amount = promotion.calculate_discount(product_total)

        if discount_amount > 0:
            applicable_promotions.append({
                "promotion": promotion,
                "discount_amount": round(discount_amount, 2),
                "applicable_amount": applicable_amount
            })

    if not applicable_promotions:
        return AutoApplyResponse(
            subtotal=round(subtotal, 2),
            total_discount=0,
            final_total=round(subtotal, 2),
            applied_promotions=[],
            best_promotion=None,
            best_discount_amount=0
        )

    # Find the best promotion (highest discount)
    best = max(applicable_promotions, key=lambda x: x["discount_amount"])
    best_promotion = best["promotion"]
    best_discount = best["discount_amount"]

    # Build response with all applicable promotions
    applied_items = [
        AppliedPromotionItem(
            promotion_id=p["promotion"].id,
            promotion_name=p["promotion"].name,
            discount_type=p["promotion"].discount_type,
            discount_value=p["promotion"].discount_value,
            scope=p["promotion"].scope,
            discount_amount=p["discount_amount"]
        )
        for p in applicable_promotions
    ]

    return AutoApplyResponse(
        subtotal=round(subtotal, 2),
        total_discount=best_discount,
        final_total=round(subtotal - best_discount, 2),
        applied_promotions=applied_items,
        best_promotion=promotion_to_read(best_promotion),
        best_discount_amount=best_discount
    )
