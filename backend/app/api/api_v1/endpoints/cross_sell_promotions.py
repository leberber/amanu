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
from app.services.discount_validation import (
    validate_date_range,
    validate_percentage_discount,
    validate_target_not_in_triggers,
)
from app.services.discount_calculation import calculate_cross_sell_discount

router = APIRouter()


def get_product_info(session: Session, product_ids: List[int]) -> dict:
    """Get product names and images by IDs"""
    if not product_ids:
        return {}
    products = session.exec(
        select(Product).where(Product.id.in_(product_ids))
    ).all()
    return {p.id: {"name": p.name, "image": p.image_url} for p in products}


def promotion_to_read(
    promotion: CrossSellPromotion,
    session: Session,
    products_map: dict = None
) -> CrossSellPromotionRead:
    """Convert CrossSellPromotion to CrossSellPromotionRead with product names and images.

    Args:
        promotion: The promotion to convert
        session: Database session
        products_map: Optional pre-loaded {product_id: Product} for batch optimization
    """
    # Get target product info - use map if provided
    if products_map:
        target_product = products_map.get(promotion.target_product_id)
    else:
        target_product = session.get(Product, promotion.target_product_id)

    target_name = target_product.name if target_product else None
    target_image = target_product.image_url if target_product else None
    target_pieces_per_box = target_product.pieces_per_box if target_product else None

    # Get trigger product info
    trigger_names = []
    trigger_images = []
    if promotion.trigger_product_ids:
        if products_map:
            # Use pre-loaded map
            for pid in promotion.trigger_product_ids:
                product = products_map.get(pid)
                if product:
                    trigger_names.append(product.name)
                    trigger_images.append(product.image_url)
                else:
                    trigger_names.append(f"Product {pid}")
                    trigger_images.append(None)
        else:
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


def promotions_to_read_batch(promotions: list, session: Session) -> list:
    """Convert multiple promotions with batch-loaded products."""
    if not promotions:
        return []

    # Collect all product IDs needed
    product_ids = set()
    for p in promotions:
        product_ids.add(p.target_product_id)
        if p.trigger_product_ids:
            product_ids.update(p.trigger_product_ids)

    # Batch load all products
    products = session.exec(select(Product).where(Product.id.in_(product_ids))).all()
    products_map = {p.id: p for p in products}

    return [promotion_to_read(p, session, products_map) for p in promotions]


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
    return promotions_to_read_batch(promotions, session)


@router.get("", response_model=List[CrossSellPromotionRead])
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
    return promotions_to_read_batch(promotions, session)


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


@router.post("", response_model=CrossSellPromotionRead)
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

    # Use shared validation utilities
    validate_target_not_in_triggers(promotion_in.target_product_id, promotion_in.trigger_product_ids)

    if promotion_in.start_date and promotion_in.end_date:
        validate_date_range(promotion_in.start_date, promotion_in.end_date)

    validate_percentage_discount(promotion_in.discount_type, promotion_in.discount_value)

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

    # Get effective values for validation
    target_id = update_data.get("target_product_id", promotion.target_product_id)
    trigger_ids = update_data.get("trigger_product_ids", promotion.trigger_product_ids)
    start_date = update_data.get("start_date", promotion.start_date)
    end_date = update_data.get("end_date", promotion.end_date)
    discount_type = update_data.get("discount_type", promotion.discount_type)
    discount_value = update_data.get("discount_value", promotion.discount_value)

    # Use shared validation utilities
    validate_target_not_in_triggers(target_id, trigger_ids)

    if start_date and end_date:
        validate_date_range(start_date, end_date)

    validate_percentage_discount(discount_type, discount_value)

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

    # Build cart lookup: product_id -> {quantity, unit_price, pieces_per_box}
    cart_lookup = {
        item.product_id: {
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "pieces_per_box": item.pieces_per_box or 1
        }
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

        # Calculate discount using shared utility
        target_price = cart_lookup[promotion.target_product_id]["unit_price"]
        discount_amount = calculate_cross_sell_discount(
            target_price,
            promotion.discount_type,
            promotion.discount_value
        )

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
        triggered_by = info["triggered_by"]

        # Get quantities and pieces_per_box
        trigger_data = cart_lookup[triggered_by]
        target_data = cart_lookup[target_id]

        # Convert to cartons for comparison (1 trigger carton = 1 discounted target carton)
        trigger_cartons = trigger_data["quantity"] // trigger_data["pieces_per_box"]
        target_cartons = target_data["quantity"] // target_data["pieces_per_box"]

        # Limit discounted cartons: 1 trigger carton = 1 discounted target carton
        cartons_to_discount = min(trigger_cartons, target_cartons)

        # Calculate units (pieces) to discount
        units_to_discount = cartons_to_discount * target_data["pieces_per_box"]
        discount_per_unit = info["discount"]
        total_discount = discount_per_unit * units_to_discount

        discount_item = CrossSellDiscountItem(
            target_product_id=target_id,
            triggered_by_product_id=triggered_by,
            promotion_id=promotion.id,
            promotion_name=promotion.name,
            discount_per_unit=discount_per_unit,
            units_discounted=units_to_discount,
            total_discount=total_discount,
        )
        discounts.append(discount_item)
        total_savings += total_discount

    return CrossSellCalculationResponse(
        cross_sell_discounts=discounts,
        total_savings=total_savings
    )
