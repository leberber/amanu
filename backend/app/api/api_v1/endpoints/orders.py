from typing import Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import joinedload, selectinload
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from sqlmodel import func

from app.database import get_session
from app.models.order import (
    Order, OrderCreate, OrderUpdate, OrderRead, OrderItem, OrderItemRead,
    OrderStatus, OrderWithItems, PromotionInfo, UserInfo, OrderPaymentCustomerReadInline
)
from app.models.order_payments import (
    OrderPayment, OrderPaymentCreate, OrderPaymentRead,
    OrderAuditLog, OrderAuditLogRead, AuditAction, PaymentStatus, PaymentMethod,
    UserPaymentRead, OrderFinancialSummary
)
from app.models.product import Product
from app.models.promotion import Promotion, PromotionUsage, PromotionScope
from app.models.cross_sell_promotion import CrossSellPromotion, DiscountType as CrossSellDiscountType
from app.models.volume_discount import VolumeDiscount, VolumeDiscountType
from app.models.trip import Trip, TripStop, TripStatus, StopStatus
from app.models.driver import Driver, DriverStatus
from app.core.security import get_current_active_user, get_current_staff_user
from app.models.user import User, UserRole
from app.api.utils.common import format_price
from app.core.notification_service import NotificationService
from sqlmodel import SQLModel

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
    total_weight_kg = 0.0  # Calculate weight while processing items

    # Batch load all products for the order
    product_ids = [item.product_id for item in order_in.items]
    products = session.exec(select(Product).where(Product.id.in_(product_ids))).all()
    products_map = {p.id: p for p in products}

    for item in order_in.items:
        # Check if product exists and is active
        product = products_map.get(item.product_id)
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

        # Calculate weight (product.weight is in kg per unit)
        if product.weight:
            total_weight_kg += product.weight * item.quantity

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
            packaging_type=product.packaging_type,
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
        shipping_cost=order_in.shipping_cost,
        total_amount=total_amount,
        promotion_id=promotion.id if promotion else None,
        total_weight_kg=total_weight_kg,
        delivery_type=order_in.delivery_type,
        pickup_date=order_in.pickup_date
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

    # Notify admins and staff of the new order
    try:
        NotificationService.notify_admins_new_order(
            session=session,
            order_id=order.id,
            customer_name=current_user.full_name,
            total_amount=order.total_amount,
        )
    except Exception:
        pass  # Never fail an order because of a notification error

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

@router.get("/payments", response_model=List[UserPaymentRead])
def get_user_payments(
    current_user: User = Depends(get_current_active_user),
    session: Session = Depends(get_session),
) -> Any:
    """Get all payments for the current user across all their orders."""
    orders = session.exec(
        select(Order).where(Order.user_id == current_user.id)
    ).all()

    if not orders:
        return []

    order_total_map = {o.id: o.total_amount for o in orders}

    payments = session.exec(
        select(OrderPayment)
        .where(OrderPayment.order_id.in_(list(order_total_map.keys())))
        .order_by(OrderPayment.recorded_at.desc())
    ).all()

    return [
        UserPaymentRead(
            id=p.id,
            order_id=p.order_id,
            amount=p.amount,
            method=p.method,
            note=p.note,
            recorded_at=p.recorded_at,
            order_total_amount=order_total_map.get(p.order_id, 0.0),
        )
        for p in payments
    ]


@router.get("/financial-summary", response_model=List[OrderFinancialSummary])
def get_financial_summary(
    current_user: User = Depends(get_current_active_user),
    session: Session = Depends(get_session),
) -> Any:
    """Get all orders with their financial state for the current user."""
    orders = session.exec(
        select(Order)
        .where(Order.user_id == current_user.id)
        .order_by(Order.created_at.desc())
    ).all()

    return [
        OrderFinancialSummary(
            order_id=o.id,
            created_at=o.created_at,
            total_amount=o.total_amount,
            total_paid=o.total_paid or 0.0,
            payment_status=o.payment_status or "unpaid",
        )
        for o in orders
    ]


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
        .options(
            joinedload(Order.items).joinedload(OrderItem.product),
            joinedload(Order.user),
            joinedload(Order.payments)
        )
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

    # Clear admin_modified_at when the customer views their order (but snapshot for response)
    admin_modified_at_snapshot = order.admin_modified_at
    if current_user.role == UserRole.CUSTOMER and order.admin_modified_at is not None:
        order.admin_modified_at = None
        session.add(order)
        session.commit()

    # Build user info
    user_info = None
    if order.user:
        user_info = UserInfo(
            id=order.user.id,
            full_name=order.user.full_name,
            email=order.user.email,
            store_name=order.user.store_name,
            daira=order.user.daira,
            commune=order.user.commune
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
        admin_modified_at=admin_modified_at_snapshot,
        payments=[
            OrderPaymentCustomerReadInline(
                id=p.id,
                amount=p.amount,
                method=p.method.value if hasattr(p.method, 'value') else p.method,
                note=p.note,
                recorded_at=p.recorded_at,
            )
            for p in sorted(order.payments, key=lambda p: p.recorded_at)
        ],
        user=user_info,
        items=[
            OrderItemRead(
                id=item.id,
                order_id=item.order_id,
                product_id=item.product_id,
                quantity=item.quantity,
                unit_price=item.unit_price,
                custom_unit_price=item.custom_unit_price,
                product_name=item.product_name,
                product_unit=item.product_unit,
                pieces_per_box=item.pieces_per_box,
                packaging_type=item.packaging_type,
                image_url=item.product.image_url if item.product else None,
                brand_name=item.product.brand.name if item.product and item.product.brand else None
            )
            for item in order.items
        ]
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

        # Handle order cancellation: restore stock and cleanup trips
        if new_status == OrderStatus.CANCELLED:
            _restore_order_stock(order, session)
            _handle_order_cancellation_trip_cleanup(order, session)

    # Include order items in response
    return order


def _restore_order_stock(order: Order, session: Session) -> None:
    """
    Restore stock quantities when an order is cancelled.
    Used by both admin and customer cancellation paths (DRY principle).
    """
    # Get order items
    order_items = session.exec(
        select(OrderItem).where(OrderItem.order_id == order.id)
    ).all()

    # Restore stock for each item
    for item in order_items:
        if item.product_id:
            product = session.get(Product, item.product_id)
            if product:
                product.stock_quantity = (product.stock_quantity or 0) + item.quantity
                session.add(product)

    session.commit()


def _handle_order_cancellation_trip_cleanup(order: Order, session: Session) -> None:
    """
    Handle trip-related cleanup when an order is cancelled.
    - Marks the corresponding TripStop as FAILED
    - Clears driver assignment from order
    - Checks if trip should be completed or cancelled
    - Updates driver status if needed
    """
    now = datetime.now(timezone.utc)

    # Check if order is part of a trip
    if not order.trip_id:
        # Not part of a trip, just clear driver if assigned
        if order.driver_id:
            order.driver_id = None
            order.assigned_at = None
            order.assignment_expires_at = None
            session.add(order)
            session.commit()
        return

    # Get the trip
    trip = session.get(Trip, order.trip_id)
    if not trip:
        return

    # Store driver_id before clearing (for status update later)
    driver_id = order.driver_id or trip.driver_id

    # Find and update the corresponding TripStop
    stop = session.exec(
        select(TripStop).where(
            TripStop.trip_id == trip.id,
            TripStop.order_id == order.id
        )
    ).first()

    if stop:
        stop.status = StopStatus.FAILED
        stop.notes = "Order cancelled by admin"
        session.add(stop)

    # Clear driver and trip from order
    order.driver_id = None
    order.trip_id = None
    order.assigned_at = None
    order.assignment_expires_at = None
    session.add(order)

    # Check remaining stops in the trip
    remaining_stops = session.exec(
        select(TripStop).where(TripStop.trip_id == trip.id)
    ).all()

    # Count stop statuses
    pending_stops = [s for s in remaining_stops if s.status == StopStatus.PENDING]
    arrived_stops = [s for s in remaining_stops if s.status == StopStatus.ARRIVED]
    delivered_stops = [s for s in remaining_stops if s.status == StopStatus.DELIVERED]
    failed_stops = [s for s in remaining_stops if s.status == StopStatus.FAILED]

    active_stops = pending_stops + arrived_stops  # Stops that still need action
    completed_stops = delivered_stops + failed_stops  # Stops that are done

    # Determine trip status
    if len(active_stops) == 0:
        # All stops are done (delivered or failed)
        if len(delivered_stops) > 0:
            # At least one delivery was successful
            trip.status = TripStatus.COMPLETED
            trip.completed_at = now
        else:
            # All stops failed/cancelled - cancel the trip
            trip.status = TripStatus.CANCELLED
            trip.cancelled_at = now
        trip.updated_at = now
        session.add(trip)
    elif len(failed_stops) == len(remaining_stops):
        # All stops failed - cancel the trip
        trip.status = TripStatus.CANCELLED
        trip.cancelled_at = now
        trip.updated_at = now
        session.add(trip)

    session.commit()

    # Update driver status if they have no more active trips
    if driver_id:
        _update_driver_status_after_cancellation(driver_id, session)


def _update_driver_status_after_cancellation(driver_user_id: int, session: Session) -> None:
    """
    Update driver status to AVAILABLE if they have no more active trips.
    """
    # Count active trips for this driver
    active_trips_count = session.exec(
        select(func.count(Trip.id)).where(
            Trip.driver_id == driver_user_id,
            Trip.status.in_([TripStatus.ASSIGNED, TripStatus.IN_PROGRESS])
        )
    ).one() or 0

    # Count active individual orders (not part of trips)
    active_orders_count = session.exec(
        select(func.count(Order.id)).where(
            Order.driver_id == driver_user_id,
            Order.status.in_([OrderStatus.ASSIGNED, OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT]),
            Order.trip_id == None
        )
    ).one() or 0

    if active_trips_count == 0 and active_orders_count == 0:
        # No more active work - set driver to available
        driver = session.exec(
            select(Driver).where(Driver.user_id == driver_user_id)
        ).first()

        if driver and driver.status == DriverStatus.BUSY:
            driver.status = DriverStatus.AVAILABLE
            driver.updated_at = datetime.now(timezone.utc)
            session.add(driver)
            session.commit()


# =============================================================================
# HELPERS
# =============================================================================

EDITABLE_STATUSES = {OrderStatus.PENDING, OrderStatus.CONFIRMED}


def _write_audit(session: Session, order_id: int, user_id: int, action: AuditAction, details: dict) -> None:
    log = OrderAuditLog(order_id=order_id, user_id=user_id, action=action, details=details)
    session.add(log)


def _recalculate_payment_status(order: Order, session: Session) -> None:
    """Recompute payment_status from sum of all payments."""
    total_paid = session.exec(
        select(func.coalesce(func.sum(OrderPayment.amount), 0.0))
        .where(OrderPayment.order_id == order.id)
    ).one()

    order.total_paid = float(total_paid)
    if total_paid <= 0:
        order.payment_status = PaymentStatus.UNPAID
    elif total_paid >= order.total_amount:
        order.payment_status = PaymentStatus.PAID
    else:
        order.payment_status = PaymentStatus.PARTIAL
    session.add(order)


def _recalculate_order_total(order: Order, session: Session) -> None:
    """Recompute total_amount from current items."""
    items = session.exec(select(OrderItem).where(OrderItem.order_id == order.id)).all()
    new_total = sum(i.quantity * i.unit_price for i in items)
    order.total_amount = round(new_total, 2)
    order.subtotal = round(new_total, 2)
    order.updated_at = datetime.now(timezone.utc)
    session.add(order)
    # Re-check payment status against the new total
    _recalculate_payment_status(order, session)


# =============================================================================
# PAYMENT ENDPOINTS
# =============================================================================

class OrderPaymentReadWithTotal(SQLModel):
    payments: List[OrderPaymentRead]
    total_paid: float
    payment_status: str


@router.post("/{order_id}/payments", response_model=OrderPaymentRead)
def record_payment(
    order_id: int,
    payment_in: OrderPaymentCreate,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    payment = OrderPayment(
        order_id=order_id,
        amount=payment_in.amount,
        method=payment_in.method,
        note=payment_in.note,
        recorded_by=current_user.id,
    )
    session.add(payment)
    session.flush()

    _recalculate_payment_status(order, session)

    action = AuditAction.REFUND_RECORDED if payment_in.amount < 0 else AuditAction.PAYMENT_RECORDED
    _write_audit(session, order_id, current_user.id, action, {
        "amount": payment_in.amount,
        "method": payment_in.method,
        "note": payment_in.note,
        "payment_status": order.payment_status,
    })

    session.commit()
    session.refresh(payment)

    return OrderPaymentRead(
        id=payment.id,
        order_id=payment.order_id,
        amount=payment.amount,
        method=payment.method,
        note=payment.note,
        recorded_by=payment.recorded_by,
        recorded_at=payment.recorded_at,
        recorder_name=current_user.full_name,
    )


@router.get("/{order_id}/payments", response_model=OrderPaymentReadWithTotal)
def get_payments(
    order_id: int,
    current_user: User = Depends(get_current_active_user),
    session: Session = Depends(get_session),
) -> Any:
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if current_user.role == UserRole.CUSTOMER and order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    payments = session.exec(
        select(OrderPayment).where(OrderPayment.order_id == order_id)
        .order_by(OrderPayment.recorded_at)
    ).all()

    # Batch load recorders
    recorder_ids = list({p.recorded_by for p in payments})
    recorders = {}
    if recorder_ids:
        users = session.exec(select(User).where(User.id.in_(recorder_ids))).all()
        recorders = {u.id: u.full_name for u in users}

    total_paid = sum(p.amount for p in payments)

    return OrderPaymentReadWithTotal(
        payments=[
            OrderPaymentRead(
                id=p.id,
                order_id=p.order_id,
                amount=p.amount,
                method=p.method,
                note=p.note,
                recorded_by=p.recorded_by,
                recorded_at=p.recorded_at,
                recorder_name=recorders.get(p.recorded_by),
            )
            for p in payments
        ],
        total_paid=total_paid,
        payment_status=order.payment_status,
    )


# =============================================================================
# AUDIT LOG ENDPOINTS
# =============================================================================

@router.get("/{order_id}/audit-log", response_model=List[OrderAuditLogRead])
def get_audit_log(
    order_id: int,
    current_user: User = Depends(get_current_active_user),
    session: Session = Depends(get_session),
) -> Any:
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if current_user.role == UserRole.CUSTOMER and order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    logs = session.exec(
        select(OrderAuditLog).where(OrderAuditLog.order_id == order_id)
        .order_by(OrderAuditLog.created_at.desc())
    ).all()

    actor_ids = list({l.user_id for l in logs if l.user_id})
    actors = {}
    if actor_ids:
        users = session.exec(select(User).where(User.id.in_(actor_ids))).all()
        # Customers see "Staff" instead of real name
        if current_user.role == UserRole.CUSTOMER:
            actors = {u.id: "Équipe" for u in users}
        else:
            actors = {u.id: u.full_name for u in users}

    return [
        OrderAuditLogRead(
            id=l.id,
            order_id=l.order_id,
            user_id=l.user_id,
            actor_name=actors.get(l.user_id) if l.user_id else None,
            action=l.action,
            details=l.details,
            created_at=l.created_at,
        )
        for l in logs
    ]


# =============================================================================
# ORDER ITEM EDITING ENDPOINTS
# =============================================================================

class OrderItemAdd(SQLModel):
    product_id: int
    quantity: float


class OrderItemUpdate(SQLModel):
    quantity: float


@router.post("/{order_id}/items", response_model=OrderWithItems)
def add_order_item(
    order_id: int,
    item_in: OrderItemAdd,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status not in EDITABLE_STATUSES:
        raise HTTPException(status_code=400, detail="Order can only be edited when pending or confirmed")

    product = session.get(Product, item_in.product_id)
    if not product or not product.is_active:
        raise HTTPException(status_code=404, detail="Product not found or inactive")

    if product.stock_quantity < item_in.quantity:
        raise HTTPException(status_code=400, detail=f"Insufficient stock. Available: {product.stock_quantity}")

    # Check if item already exists — if so, increase quantity
    existing = session.exec(
        select(OrderItem).where(
            OrderItem.order_id == order_id,
            OrderItem.product_id == item_in.product_id
        )
    ).first()

    if existing:
        old_qty = existing.quantity
        stock_delta = item_in.quantity
        existing.quantity += item_in.quantity
        session.add(existing)
        _write_audit(session, order_id, current_user.id, AuditAction.ITEM_QUANTITY_CHANGED, {
            "product_id": product.id,
            "product_name": product.name,
            "old_quantity": old_qty,
            "new_quantity": existing.quantity,
        })
    else:
        new_item = OrderItem(
            order_id=order_id,
            product_id=product.id,
            quantity=item_in.quantity,
            unit_price=product.price,
            product_name=product.name,
            product_unit=product.unit,
            pieces_per_box=product.pieces_per_box,
            packaging_type=product.packaging_type,
        )
        session.add(new_item)
        stock_delta = item_in.quantity
        _write_audit(session, order_id, current_user.id, AuditAction.ITEM_ADDED, {
            "product_id": product.id,
            "product_name": product.name,
            "quantity": item_in.quantity,
            "unit_price": product.price,
        })

    # Deduct stock
    product.stock_quantity -= stock_delta
    session.add(product)

    session.flush()
    _recalculate_order_total(order, session)
    order.admin_modified_at = datetime.now(timezone.utc)

    # Notify customer
    try:
        NotificationService.notify_order_modified(
            session=session,
            user_id=order.user_id,
            order_id=order.id,
        )
    except Exception:
        pass

    session.commit()
    return _build_order_with_items(order, session)


@router.delete("/{order_id}/items/{item_id}", response_model=OrderWithItems)
def remove_order_item(
    order_id: int,
    item_id: int,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status not in EDITABLE_STATUSES:
        raise HTTPException(status_code=400, detail="Order can only be edited when pending or confirmed")

    item = session.get(OrderItem, item_id)
    if not item or item.order_id != order_id:
        raise HTTPException(status_code=404, detail="Item not found")

    # Must keep at least one item
    item_count = session.exec(
        select(func.count(OrderItem.id)).where(OrderItem.order_id == order_id)
    ).one()
    if item_count <= 1:
        raise HTTPException(status_code=400, detail="Order must contain at least one item")

    # Restore stock
    product = session.get(Product, item.product_id)
    if product:
        product.stock_quantity += item.quantity
        session.add(product)

    _write_audit(session, order_id, current_user.id, AuditAction.ITEM_REMOVED, {
        "product_id": item.product_id,
        "product_name": item.product_name,
        "quantity": item.quantity,
        "unit_price": item.unit_price,
    })

    session.delete(item)
    session.flush()
    _recalculate_order_total(order, session)
    order.admin_modified_at = datetime.now(timezone.utc)

    try:
        NotificationService.notify_order_modified(
            session=session,
            user_id=order.user_id,
            order_id=order.id,
        )
    except Exception:
        pass

    session.commit()
    return _build_order_with_items(order, session)


@router.patch("/{order_id}/items/{item_id}", response_model=OrderWithItems)
def update_order_item(
    order_id: int,
    item_id: int,
    item_in: OrderItemUpdate,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status not in EDITABLE_STATUSES:
        raise HTTPException(status_code=400, detail="Order can only be edited when pending or confirmed")

    if item_in.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than 0")

    item = session.get(OrderItem, item_id)
    if not item or item.order_id != order_id:
        raise HTTPException(status_code=404, detail="Item not found")

    old_qty = item.quantity
    delta = item_in.quantity - old_qty  # positive = need more stock, negative = return stock

    if delta > 0:
        product = session.get(Product, item.product_id)
        if product and product.stock_quantity < delta:
            raise HTTPException(status_code=400, detail=f"Insufficient stock. Available: {product.stock_quantity}")
        if product:
            product.stock_quantity -= delta
            session.add(product)
    elif delta < 0:
        product = session.get(Product, item.product_id)
        if product:
            product.stock_quantity += abs(delta)
            session.add(product)

    item.quantity = item_in.quantity
    session.add(item)

    _write_audit(session, order_id, current_user.id, AuditAction.ITEM_QUANTITY_CHANGED, {
        "product_id": item.product_id,
        "product_name": item.product_name,
        "old_quantity": old_qty,
        "new_quantity": item_in.quantity,
    })

    session.flush()
    _recalculate_order_total(order, session)
    order.admin_modified_at = datetime.now(timezone.utc)

    try:
        NotificationService.notify_order_modified(
            session=session,
            user_id=order.user_id,
            order_id=order.id,
        )
    except Exception:
        pass

    session.commit()
    return _build_order_with_items(order, session)


def _build_order_with_items(order: Order, session: Session) -> OrderWithItems:
    """Reload order with items for response."""
    session.refresh(order)
    items = session.exec(
        select(OrderItem).where(OrderItem.order_id == order.id)
        .options(selectinload(OrderItem.product))
    ).all()

    user_info = None
    if order.user_id:
        user = session.get(User, order.user_id)
        if user:
            user_info = UserInfo(
                id=user.id,
                full_name=user.full_name,
                email=user.email,
                store_name=user.store_name,
                daira=user.daira,
                commune=user.commune,
            )

    return OrderWithItems(
        **order.model_dump(),
        user=user_info,
        items=[
            OrderItemRead(
                id=i.id,
                order_id=i.order_id,
                product_id=i.product_id,
                quantity=i.quantity,
                unit_price=i.unit_price,
                product_name=i.product_name,
                product_unit=i.product_unit,
                pieces_per_box=i.pieces_per_box,
                packaging_type=i.packaging_type,
                image_url=i.product.image_url if i.product else None,
                brand_name=i.product.brand.name if i.product and i.product.brand else None,
            )
            for i in items
        ],
    )