from typing import Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import joinedload
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.database import get_session
from app.models.order import (
    Order, OrderCreate, OrderUpdate, OrderRead, OrderItem,
    OrderStatus, OrderWithItems, PromotionInfo, UserInfo
)
from app.models.product import Product
from app.models.promotion import Promotion, PromotionUsage, PromotionScope
from app.models.cross_sell_promotion import CrossSellPromotion, DiscountType as CrossSellDiscountType
from app.models.volume_discount import VolumeDiscount, VolumeDiscountType
from app.core.security import get_current_active_user, get_current_staff_user
from app.models.user import User, UserRole
from app.api.utils.common import format_price
from app.core.notification_service import NotificationService

router = APIRouter()


def calculate_cross_sell_discounts(
    order_items: List[dict],
    session: Session
) -> float:
    """
    Calculate cross-sell discounts based on cart items.
    Returns the total cross-sell discount amount.
    """
    from datetime import datetime, timezone

    # Get all active cross-sell promotions
    now = datetime.now(timezone.utc)
    promotions = session.exec(
        select(CrossSellPromotion).where(CrossSellPromotion.is_active == True)
    ).all()

    if not promotions:
        return 0.0

    # Build a map of product_id -> quantity for easy lookup
    product_quantities = {}
    product_prices = {}
    for item in order_items:
        product_quantities[item["product_id"]] = product_quantities.get(item["product_id"], 0) + item["quantity"]
        product_prices[item["product_id"]] = item["unit_price"]

    total_cross_sell_discount = 0.0

    # Track which target products have received discounts (each target can only get one discount)
    discounted_targets = set()

    for promo in promotions:
        # Check date validity (handle both naive and aware datetimes)
        start_date = promo.start_date.replace(tzinfo=timezone.utc) if promo.start_date and promo.start_date.tzinfo is None else promo.start_date
        end_date = promo.end_date.replace(tzinfo=timezone.utc) if promo.end_date and promo.end_date.tzinfo is None else promo.end_date
        if start_date and now < start_date:
            continue
        if end_date and now > end_date:
            continue

        # Check if target product is in the cart
        if promo.target_product_id not in product_quantities:
            continue

        # Skip if this target already got a better discount
        if promo.target_product_id in discounted_targets:
            continue

        # Check if any trigger product is in the cart with enough quantity
        trigger_found = False
        for trigger_id in promo.trigger_product_ids:
            if trigger_id in product_quantities and product_quantities[trigger_id] >= promo.min_trigger_quantity:
                trigger_found = True
                break

        if not trigger_found:
            continue

        # Calculate discount for ONE unit of the target product
        target_price = product_prices.get(promo.target_product_id, 0)

        if promo.discount_type == CrossSellDiscountType.PERCENTAGE:
            discount = target_price * (promo.discount_value / 100)
        else:  # FIXED_AMOUNT
            discount = min(promo.discount_value, target_price)  # Can't discount more than the price

        total_cross_sell_discount += discount
        discounted_targets.add(promo.target_product_id)

    return total_cross_sell_discount


def calculate_promotion_discount(
    promotion: Promotion,
    order_items: List[dict],
    subtotal: float,
    session: Session
) -> float:
    """Calculate discount based on promotion scope"""
    if promotion.scope == PromotionScope.GLOBAL:
        return promotion.calculate_discount(subtotal)

    elif promotion.scope == PromotionScope.CATEGORY:
        category_total = sum(
            item["unit_price"] * item["quantity"]
            for item in order_items
            if item.get("category_id") == promotion.category_id
        )
        return promotion.calculate_discount(category_total)

    elif promotion.scope == PromotionScope.BRAND:
        brand_total = sum(
            item["unit_price"] * item["quantity"]
            for item in order_items
            if item.get("brand_id") == promotion.brand_id
        )
        return promotion.calculate_discount(brand_total)

    elif promotion.scope == PromotionScope.PRODUCT:
        product_total = sum(
            item["unit_price"] * item["quantity"]
            for item in order_items
            if item["product_id"] == promotion.product_id
        )
        return promotion.calculate_discount(product_total)

    return 0


def calculate_volume_discounts(
    order_items: List[dict],
    session: Session
) -> float:
    """
    Calculate volume discounts based on cart items.
    Returns the total volume discount amount.
    """
    now = datetime.now(timezone.utc)

    # Get all active volume discounts
    query = select(VolumeDiscount).where(VolumeDiscount.is_active == True)
    query = query.where(VolumeDiscount.start_date <= now)
    query = query.where(VolumeDiscount.end_date >= now)
    discounts = session.exec(query).all()

    if not discounts:
        return 0.0

    # Build product lookup
    product_data = {}
    for item in order_items:
        pid = item["product_id"]
        product_data[pid] = {
            "quantity": item["quantity"],
            "unit_price": item["unit_price"]
        }

    total_volume_discount = 0.0

    for discount in discounts:
        # Check if product is in cart
        if discount.product_id not in product_data:
            continue

        data = product_data[discount.product_id]
        quantity = data["quantity"]
        unit_price = data["unit_price"]

        # Check if quantity meets minimum
        if quantity < discount.min_quantity:
            continue

        # Calculate discount based on type
        if discount.discount_type == VolumeDiscountType.PERCENTAGE:
            item_total = quantity * unit_price
            savings = item_total * (discount.discount_value / 100)
            total_volume_discount += savings

        elif discount.discount_type == VolumeDiscountType.FIXED_AMOUNT:
            # Fixed amount per unit
            savings = quantity * discount.discount_value
            total_volume_discount += savings

        elif discount.discount_type == VolumeDiscountType.FREE_UNITS:
            # Free units based on quantity
            # e.g., Buy 5 get 1 free: for 10 items, user gets 2 free
            free_units = int(quantity // discount.min_quantity) * int(discount.discount_value)
            savings = free_units * unit_price
            total_volume_discount += savings

    return total_volume_discount


@router.post("", response_model=OrderRead)
def create_order(
    order_in: OrderCreate,
    current_user: User = Depends(get_current_active_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Create new order.
    """
    # Ensure user can only create orders for themselves
    if order_in.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to create order for another user",
        )

    # Process order items
    order_items = []
    order_items_data = []  # For promotion calculation
    subtotal = 0

    for item in order_in.items:
        # Check if product exists and is active
        product = session.get(Product, item.product_id)
        if not product:
            raise HTTPException(
                status_code=404,
                detail=f"Product with ID {item.product_id} not found",
            )

        if not product.is_active:
            raise HTTPException(
                status_code=400,
                detail=f"Product {product.name} is not available",
            )

        # Check stock
        if product.stock_quantity < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough stock for {product.name}. Available: {product.stock_quantity}",
            )

        # Calculate item total
        item_total = product.price * item.quantity
        subtotal += item_total

        # Store item data for promotion calculation
        order_items_data.append({
            "product_id": item.product_id,
            "quantity": item.quantity,
            "unit_price": product.price,
            "category_id": product.category_id,
            "brand_id": product.brand_id
        })

        # Create order item
        order_item = OrderItem(
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=product.price,
            product_name=product.name,
            product_unit=product.unit,
            pieces_per_box=product.pieces_per_box,
            order_id=0  # Will be updated after order creation
        )

        order_items.append(order_item)

        # Update product stock
        product.stock_quantity -= item.quantity
        session.add(product)

    # Format subtotal
    subtotal = format_price(subtotal)

    # Calculate cross-sell discounts
    cross_sell_discount = calculate_cross_sell_discounts(order_items_data, session)
    cross_sell_discount = format_price(cross_sell_discount)

    # Calculate volume discounts
    volume_discount = calculate_volume_discounts(order_items_data, session)
    volume_discount = format_price(volume_discount)

    # Handle promotion if provided
    promotion = None
    discount_amount = 0

    if order_in.promotion_code:
        # Find and validate promotion
        query = select(Promotion).where(Promotion.code.ilike(order_in.promotion_code))
        promotion = session.exec(query).first()

        if not promotion:
            raise HTTPException(status_code=400, detail="Invalid promotion code")

        if not promotion.is_valid():
            raise HTTPException(status_code=400, detail="Promotion is no longer valid")

        if subtotal < promotion.min_order_amount:
            raise HTTPException(
                status_code=400,
                detail=f"Minimum order amount of {promotion.min_order_amount} required for this promotion"
            )

        # Calculate discount
        discount_amount = calculate_promotion_discount(
            promotion, order_items_data, subtotal, session
        )
        discount_amount = format_price(discount_amount)

    # Calculate final total (subtract all discounts)
    total_amount = format_price(subtotal - discount_amount - cross_sell_discount - volume_discount)

    # Create order
    order = Order(
        user_id=current_user.id,
        status=OrderStatus.PENDING,
        shipping_address=order_in.shipping_address,
        contact_phone=order_in.contact_phone,
        subtotal=subtotal,
        discount_amount=discount_amount,
        cross_sell_discount_amount=cross_sell_discount,
        volume_discount_amount=volume_discount,
        total_amount=total_amount,
        promotion_id=promotion.id if promotion else None
    )

    session.add(order)
    session.commit()
    session.refresh(order)

    # Update order items with order ID and add to database
    for item in order_items:
        item.order_id = order.id
        session.add(item)

    # Create promotion usage record and increment usage count
    if promotion:
        promotion_usage = PromotionUsage(
            promotion_id=promotion.id,
            order_id=order.id,
            user_id=current_user.id,
            discount_applied=discount_amount
        )
        session.add(promotion_usage)

        # Increment usage count
        promotion.usage_count += 1
        session.add(promotion)

    session.commit()
    session.refresh(order)

    return order

@router.get("", response_model=List[OrderRead])
def read_user_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_active_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get current user's orders with user info.
    """
    # Regular users can only see their own orders
    if current_user.role == UserRole.CUSTOMER:
        orders = session.exec(
            select(Order)
            .where(Order.user_id == current_user.id)
            .options(joinedload(Order.user))
            .offset(skip)
            .limit(limit)
            .order_by(Order.created_at.desc())
        ).unique().all()
    # Staff and admins can see all orders
    else:
        orders = session.exec(
            select(Order)
            .options(joinedload(Order.user))
            .offset(skip)
            .limit(limit)
            .order_by(Order.created_at.desc())
        ).unique().all()

    return orders

@router.get("/{order_id}", response_model=OrderWithItems)
def read_order(
    order_id: int,
    current_user: User = Depends(get_current_active_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get order by ID.
    """
    order = session.exec(
        select(Order)
        .where(Order.id == order_id)
        .options(joinedload(Order.items))  # This explicitly loads the items
    ).first()

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Order not found",
        )

    # Regular users can only view their own orders
    if current_user.role == UserRole.CUSTOMER and order.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to access this order",
        )

    # Build response with promotion info
    response = OrderWithItems(
        id=order.id,
        user_id=order.user_id,
        status=order.status,
        shipping_address=order.shipping_address,
        contact_phone=order.contact_phone,
        total_amount=order.total_amount,
        subtotal=order.subtotal,
        discount_amount=order.discount_amount,
        promotion_id=order.promotion_id,
        created_at=order.created_at,
        updated_at=order.updated_at,
        items=[item for item in order.items]
    )

    # Add promotion info if exists
    if order.promotion_id:
        promotion = session.get(Promotion, order.promotion_id)
        if promotion:
            response.promotion_info = PromotionInfo(
                id=promotion.id,
                name=promotion.name,
                code=promotion.code,
                discount_type=promotion.discount_type,
                discount_value=promotion.discount_value
            )

    return response

@router.patch("/{order_id}", response_model=OrderRead)
def update_order(
    order_id: int,
    order_in: OrderUpdate,
    current_user: User = Depends(get_current_active_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Update order.
    """
    order = session.get(Order, order_id)
    
    if not order:
        raise HTTPException(
            status_code=404,
            detail="Order not found",
        )
    
    # Regular users can only cancel their own pending orders
    if current_user.role == UserRole.CUSTOMER:
        if order.user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Not authorized to modify this order",
            )
        
        # Regular users can only update status to cancelled and only if order is pending
        if order_in.status and order_in.status != OrderStatus.CANCELLED:
            raise HTTPException(
                status_code=403,
                detail="Not authorized to change order status to anything other than cancelled",
            )
        
        if order_in.status == OrderStatus.CANCELLED and order.status != OrderStatus.PENDING:
            raise HTTPException(
                status_code=400,
                detail="Only pending orders can be cancelled",
            )
        
        # Only allow updating status field for regular users
        update_data = {"status": order_in.status} if order_in.status else {}
    else:
        # Staff and admins can update all fields
        update_data = order_in.model_dump(exclude_unset=True)
    
    # Track if status changed
    old_status = order.status

    # Apply updates
    for field, value in update_data.items():
        setattr(order, field, value)

    order.updated_at = datetime.now(timezone.utc)

    session.add(order)
    session.commit()
    session.refresh(order)

    # Send notification if status changed
    if "status" in update_data and update_data["status"] != old_status:
        new_status = update_data["status"]
        if new_status in [OrderStatus.CONFIRMED, OrderStatus.ASSIGNED, OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED, OrderStatus.CANCELLED]:
            NotificationService.notify_order_status(
                session=session,
                user_id=order.user_id,
                order_id=order.id,
                status=new_status.value,
            )
            session.commit()
            session.refresh(order)

    # Include order items in response
    return order