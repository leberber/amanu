from typing import Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import joinedload
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.database import get_session
from app.models.order import (
    Order, OrderCreate, OrderUpdate, OrderRead, OrderItem,
    OrderStatus, OrderWithItems, PromotionInfo
)
from app.models.product import Product
from app.models.promotion import Promotion, PromotionUsage, PromotionScope
from app.core.security import get_current_active_user, get_current_staff_user
from app.models.user import User, UserRole
from app.api.utils.common import format_price

router = APIRouter()


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

    # Calculate final total
    total_amount = format_price(subtotal - discount_amount)

    # Create order
    order = Order(
        user_id=current_user.id,
        status=OrderStatus.PENDING,
        shipping_address=order_in.shipping_address,
        contact_phone=order_in.contact_phone,
        subtotal=subtotal,
        discount_amount=discount_amount,
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

# The rest of the file remains unchanged
@router.get("", response_model=List[OrderRead])
def read_user_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_active_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get current user's orders.
    """
    # Regular users can only see their own orders
    if current_user.role == UserRole.CUSTOMER:
        orders = session.exec(
            select(Order)
            .where(Order.user_id == current_user.id)
            .offset(skip)
            .limit(limit)
            .order_by(Order.created_at.desc())
        ).all()
    # Staff and admins can see all orders
    else:
        orders = session.exec(
            select(Order)
            .offset(skip)
            .limit(limit)
            .order_by(Order.created_at.desc())
        ).all()
    
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

@router.patch("/{order_id}", response_model=Order)
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
    
    # Apply updates
    for field, value in update_data.items():
        setattr(order, field, value)
    
    order.updated_at = datetime.now(timezone.utc)
    
    session.add(order)
    session.commit()
    session.refresh(order)
    
    # Include order items in response
    return order