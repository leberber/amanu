from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from typing import Any, List
from datetime import datetime, timezone

from app.database import get_session
from app.models.cross_sell_promotion import (
    CrossSellPromotion,
    CrossSellPromotionCreate,
    CrossSellPromotionUpdate,
    CrossSellPromotionRead,
    CrossSellCalculationRequest,
    CrossSellCalculationResponse,
    CrossSellDiscountItem,
)
from app.models.product import Product
from app.models.promotion import DiscountType
from app.models.user import User
from app.core.security import get_current_staff_user

router = APIRouter()


def get_product_info(session: Session, product_ids: List[int]) -> dict:
    """Get product names and images by IDs"""
    if not product_ids:
        return {}
    products = session.exec(
        select(Product).where(Product.id.in_(product_ids))
    ).all()
    return {p.id: {"name": p.name, "image": p.image_url} for p in products}


def promotion_to_read(promotion: CrossSellPromotion, session: Session) -> CrossSellPromotionRead:
    """Convert CrossSellPromotion to CrossSellPromotionRead with product names and images"""
    # Get target product info
    target_product = session.get(Product, promotion.target_product_id)
    target_name = target_product.name if target_product else None
    target_image = target_product.image_url if target_product else None
    target_pieces_per_box = target_product.pieces_per_box if target_product else None

    # Get trigger product info
    trigger_names = []
    trigger_images = []
    if promotion.trigger_product_ids:
        product_info = get_product_info(session, promotion.trigger_product_ids)
        for pid in promotion.trigger_product_ids:
            info = product_info.get(pid, {"name": f"Product {pid}", "image": None})
            trigger_names.append(info["name"])
            trigger_images.append(info["image"])

    return CrossSellPromotionRead(
        id=promotion.id,
        name=promotion.name,
        target_product_id=promotion.target_product_id,
        trigger_product_ids=promotion.trigger_product_ids,
        discount_type=promotion.discount_type,
        discount_value=promotion.discount_value,
        min_trigger_quantity=promotion.min_trigger_quantity,
        start_date=promotion.start_date,
        end_date=promotion.end_date,
        is_active=promotion.is_active,
        created_at=promotion.created_at,
        updated_at=promotion.updated_at,
        target_product_name=target_name,
        target_product_image=target_image,
        target_product_pieces_per_box=target_pieces_per_box,
        trigger_product_names=trigger_names,
        trigger_product_images=trigger_images,
    )


@router.get("/active", response_model=List[CrossSellPromotionRead])
def read_active_cross_sell_promotions(
    session: Session = Depends(get_session),
) -> Any:
    """
    Retrieve active cross-sell promotions (public endpoint for customers).
    """
    now = datetime.now(timezone.utc)
    query = select(CrossSellPromotion).where(CrossSellPromotion.is_active == True)
    query = query.where(
        (CrossSellPromotion.start_date == None) | (CrossSellPromotion.start_date <= now)
    )
    query = query.where(
        (CrossSellPromotion.end_date == None) | (CrossSellPromotion.end_date >= now)
    )
    query = query.order_by(CrossSellPromotion.created_at.desc())

    promotions = session.exec(query).all()
    return [promotion_to_read(p, session) for p in promotions]


@router.get("/", response_model=List[CrossSellPromotionRead])
def read_cross_sell_promotions(
    active_only: bool = Query(False),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
) -> Any:
    """
    Retrieve all cross-sell promotions (staff only).
    """
    query = select(CrossSellPromotion).order_by(CrossSellPromotion.created_at.desc())

    if active_only:
        now = datetime.now(timezone.utc)
        query = query.where(CrossSellPromotion.is_active == True)
        # Filter by date range if set
        query = query.where(
            (CrossSellPromotion.start_date == None) | (CrossSellPromotion.start_date <= now)
        )
        query = query.where(
            (CrossSellPromotion.end_date == None) | (CrossSellPromotion.end_date >= now)
        )

    promotions = session.exec(query).all()
    return [promotion_to_read(p, session) for p in promotions]


@router.get("/{promotion_id}", response_model=CrossSellPromotionRead)
def read_cross_sell_promotion(
    promotion_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
) -> Any:
    """
    Get cross-sell promotion by ID (staff only).
    """
    promotion = session.get(CrossSellPromotion, promotion_id)
    if not promotion:
        raise HTTPException(status_code=404, detail="Cross-sell promotion not found")
    return promotion_to_read(promotion, session)


@router.post("/", response_model=CrossSellPromotionRead)
def create_cross_sell_promotion(
    promotion_in: CrossSellPromotionCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
) -> Any:
    """
    Create new cross-sell promotion (staff only).
    """
    # Validate target product exists
    target_product = session.get(Product, promotion_in.target_product_id)
    if not target_product:
        raise HTTPException(status_code=400, detail="Target product not found")

    # Validate trigger products exist
    for trigger_id in promotion_in.trigger_product_ids:
        trigger_product = session.get(Product, trigger_id)
        if not trigger_product:
            raise HTTPException(status_code=400, detail=f"Trigger product {trigger_id} not found")

    # Validate target is not in triggers
    if promotion_in.target_product_id in promotion_in.trigger_product_ids:
        raise HTTPException(
            status_code=400,
            detail="Target product cannot be in the trigger products list"
        )

    # Validate date range
    if promotion_in.start_date and promotion_in.end_date:
        if promotion_in.end_date <= promotion_in.start_date:
            raise HTTPException(
                status_code=400,
                detail="End date must be after start date"
            )

    # Validate percentage discount
    if promotion_in.discount_type == DiscountType.PERCENTAGE:
        if promotion_in.discount_value > 100:
            raise HTTPException(
                status_code=400,
                detail="Percentage discount cannot exceed 100%"
            )

    promotion = CrossSellPromotion.model_validate(promotion_in)
    session.add(promotion)
    session.commit()
    session.refresh(promotion)
    return promotion_to_read(promotion, session)


@router.patch("/{promotion_id}", response_model=CrossSellPromotionRead)
def update_cross_sell_promotion(
    promotion_id: int,
    promotion_in: CrossSellPromotionUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
) -> Any:
    """
    Update a cross-sell promotion (staff only).
    """
    promotion = session.get(CrossSellPromotion, promotion_id)
    if not promotion:
        raise HTTPException(status_code=404, detail="Cross-sell promotion not found")

    update_data = promotion_in.model_dump(exclude_unset=True)

    # Validate target product if being updated
    if "target_product_id" in update_data:
        target_product = session.get(Product, update_data["target_product_id"])
        if not target_product:
            raise HTTPException(status_code=400, detail="Target product not found")

    # Validate trigger products if being updated
    if "trigger_product_ids" in update_data:
        for trigger_id in update_data["trigger_product_ids"]:
            trigger_product = session.get(Product, trigger_id)
            if not trigger_product:
                raise HTTPException(status_code=400, detail=f"Trigger product {trigger_id} not found")

    # Validate target is not in triggers
    target_id = update_data.get("target_product_id", promotion.target_product_id)
    trigger_ids = update_data.get("trigger_product_ids", promotion.trigger_product_ids)
    if target_id in trigger_ids:
        raise HTTPException(
            status_code=400,
            detail="Target product cannot be in the trigger products list"
        )

    # Validate date range
    start_date = update_data.get("start_date", promotion.start_date)
    end_date = update_data.get("end_date", promotion.end_date)
    if start_date and end_date and end_date <= start_date:
        raise HTTPException(
            status_code=400,
            detail="End date must be after start date"
        )

    # Validate percentage discount
    discount_type = update_data.get("discount_type", promotion.discount_type)
    discount_value = update_data.get("discount_value", promotion.discount_value)
    if discount_type == DiscountType.PERCENTAGE and discount_value > 100:
        raise HTTPException(
            status_code=400,
            detail="Percentage discount cannot exceed 100%"
        )

    # Update fields
    for field, value in update_data.items():
        setattr(promotion, field, value)

    promotion.updated_at = datetime.now(timezone.utc)
    session.add(promotion)
    session.commit()
    session.refresh(promotion)
    return promotion_to_read(promotion, session)


@router.delete("/{promotion_id}")
def delete_cross_sell_promotion(
    promotion_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
) -> Any:
    """
    Delete a cross-sell promotion (staff only).
    """
    promotion = session.get(CrossSellPromotion, promotion_id)
    if not promotion:
        raise HTTPException(status_code=404, detail="Cross-sell promotion not found")

    session.delete(promotion)
    session.commit()
    return {"message": "Cross-sell promotion deleted successfully"}


@router.post("/calculate", response_model=CrossSellCalculationResponse)
def calculate_cross_sell_discounts(
    request: CrossSellCalculationRequest,
    session: Session = Depends(get_session),
) -> Any:
    """
    Calculate cross-sell discounts for cart items (public endpoint).
    Returns which products qualify for cross-sell discounts based on cart contents.
    """
    if not request.cart_items:
        return CrossSellCalculationResponse(cross_sell_discounts=[], total_savings=0)

    # Get all active cross-sell promotions
    now = datetime.now(timezone.utc)
    query = select(CrossSellPromotion).where(CrossSellPromotion.is_active == True)
    query = query.where(
        (CrossSellPromotion.start_date == None) | (CrossSellPromotion.start_date <= now)
    )
    query = query.where(
        (CrossSellPromotion.end_date == None) | (CrossSellPromotion.end_date >= now)
    )
    promotions = session.exec(query).all()

    if not promotions:
        return CrossSellCalculationResponse(cross_sell_discounts=[], total_savings=0)

    # Build cart lookup: product_id -> {quantity, unit_price}
    cart_lookup = {
        item.product_id: {"quantity": item.quantity, "unit_price": item.unit_price}
        for item in request.cart_items
    }
    cart_product_ids = set(cart_lookup.keys())

    # Track best discount per target product
    # Key: target_product_id, Value: best discount info
    best_discounts: dict = {}

    for promotion in promotions:
        # Check if target product is in cart
        if promotion.target_product_id not in cart_product_ids:
            continue

        # Check if any trigger product is in cart with sufficient quantity
        triggered_by = None
        for trigger_id in promotion.trigger_product_ids:
            if trigger_id in cart_lookup:
                if cart_lookup[trigger_id]["quantity"] >= promotion.min_trigger_quantity:
                    triggered_by = trigger_id
                    break

        if not triggered_by:
            continue

        # Calculate discount
        target_price = cart_lookup[promotion.target_product_id]["unit_price"]
        discount_amount = promotion.calculate_discount(target_price)

        # Check if this is the best discount for this target
        target_id = promotion.target_product_id
        if target_id not in best_discounts or discount_amount > best_discounts[target_id]["discount"]:
            best_discounts[target_id] = {
                "promotion": promotion,
                "triggered_by": triggered_by,
                "discount": discount_amount,
            }

    # Build response
    discounts = []
    total_savings = 0

    for target_id, info in best_discounts.items():
        promotion = info["promotion"]
        discount_item = CrossSellDiscountItem(
            target_product_id=target_id,
            triggered_by_product_id=info["triggered_by"],
            promotion_id=promotion.id,
            promotion_name=promotion.name,
            discount_per_unit=info["discount"],
            units_discounted=1,  # Always 1 as per requirements
            total_discount=info["discount"],
        )
        discounts.append(discount_item)
        total_savings += info["discount"]

    return CrossSellCalculationResponse(
        cross_sell_discounts=discounts,
        total_savings=total_savings
    )
