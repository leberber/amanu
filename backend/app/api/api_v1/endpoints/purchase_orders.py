from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func
from datetime import datetime, timezone

from app.database import get_session
from app.models.purchase_order import (
    PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus,
    PurchaseOrderCreate, PurchaseOrderUpdate,
    PurchaseOrderResponse, PurchaseOrderItemResponse, PurchaseOrderListResponse,
    DeliveryConfirmation
)
from app.models.product import Product

router = APIRouter()


# =============================================================================
# Helper Functions
# =============================================================================

def generate_reference(session: Session) -> str:
    """Generate a unique reference number for purchase order"""
    year = datetime.now().year

    # Get the count of orders this year
    count = session.exec(
        select(func.count(PurchaseOrder.id)).where(
            PurchaseOrder.reference.like(f"BC-{year}-%")
        )
    ).one()

    next_num = count + 1
    return f"BC-{year}-{next_num:03d}"


def order_to_response(order: PurchaseOrder) -> PurchaseOrderResponse:
    """Convert database model to response model"""
    items = [
        PurchaseOrderItemResponse(
            id=item.id,
            product_id=item.product_id,
            product_name=item.product_name,
            brand=item.brand,
            units_per_carton=item.units_per_carton,
            quantity_ordered=item.quantity_ordered,
            quantity_received=item.quantity_received,
            unit_price=item.unit_price,
            total_price=item.total_price
        )
        for item in order.items
    ]

    return PurchaseOrderResponse(
        id=order.id,
        reference=order.reference,
        supplier_name=order.supplier_name,
        supplier_address=order.supplier_address,
        supplier_phone=order.supplier_phone,
        supplier_email=order.supplier_email,
        supplier_city=order.supplier_city,
        status=order.status.value if isinstance(order.status, PurchaseOrderStatus) else order.status,
        total_amount=order.total_amount,
        notes=order.notes,
        created_at=order.created_at,
        updated_at=order.updated_at,
        sent_at=order.sent_at,
        confirmed_at=order.confirmed_at,
        delivered_at=order.delivered_at,
        items=items,
        item_count=len(items)
    )


# =============================================================================
# CRUD Endpoints
# =============================================================================

@router.get("", response_model=PurchaseOrderListResponse)
async def list_purchase_orders(
    status: Optional[str] = Query(None, description="Filter by status"),
    supplier: Optional[str] = Query(None, description="Filter by supplier name"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    session: Session = Depends(get_session)
):
    """List all purchase orders with optional filters"""
    query = select(PurchaseOrder)

    # Apply filters
    if status:
        query = query.where(PurchaseOrder.status == status)
    if supplier:
        query = query.where(PurchaseOrder.supplier_name.ilike(f"%{supplier}%"))

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = session.exec(count_query).one()

    # Get paginated results
    query = query.order_by(PurchaseOrder.created_at.desc()).offset(skip).limit(limit)
    orders = session.exec(query).all()

    return PurchaseOrderListResponse(
        orders=[order_to_response(order) for order in orders],
        total=total
    )


@router.get("/{order_id}", response_model=PurchaseOrderResponse)
async def get_purchase_order(
    order_id: int,
    session: Session = Depends(get_session)
):
    """Get a single purchase order by ID"""
    order = session.get(PurchaseOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    return order_to_response(order)


@router.post("", response_model=PurchaseOrderResponse)
async def create_purchase_order(
    data: PurchaseOrderCreate,
    session: Session = Depends(get_session)
):
    """Create a new purchase order"""
    try:
        # Generate reference
        reference = generate_reference(session)

        # Calculate total
        total_amount = sum(item.total_price for item in data.items)

        # Create order
        order = PurchaseOrder(
            reference=reference,
            supplier_name=data.supplier_name,
            supplier_address=data.supplier_address,
            supplier_phone=data.supplier_phone,
            supplier_email=data.supplier_email,
            supplier_city=data.supplier_city,
            notes=data.notes,
            total_amount=total_amount,
            status=PurchaseOrderStatus.DRAFT
        )
        session.add(order)
        session.flush()  # Get the order ID

        # Create items
        for item_data in data.items:
            item = PurchaseOrderItem(
                purchase_order_id=order.id,
                product_id=item_data.product_id,
                product_name=item_data.product_name,
                brand=item_data.brand,
                units_per_carton=item_data.units_per_carton,
                quantity_ordered=item_data.quantity_ordered,
                quantity_received=0,
                unit_price=item_data.unit_price,
                total_price=item_data.total_price
            )
            session.add(item)

        session.commit()
        session.refresh(order)

        return order_to_response(order)

    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=422, detail=str(e))


@router.put("/{order_id}", response_model=PurchaseOrderResponse)
async def update_purchase_order(
    order_id: int,
    data: PurchaseOrderUpdate,
    session: Session = Depends(get_session)
):
    """Update a purchase order (including items)"""
    order = session.get(PurchaseOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    # Only allow editing draft or confirmed orders
    if order.status not in [PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.CONFIRMED]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot edit order with status '{order.status.value}'"
        )

    try:
        # Update supplier info
        if data.supplier_name is not None:
            order.supplier_name = data.supplier_name
        if data.supplier_address is not None:
            order.supplier_address = data.supplier_address
        if data.supplier_phone is not None:
            order.supplier_phone = data.supplier_phone
        if data.supplier_email is not None:
            order.supplier_email = data.supplier_email
        if data.supplier_city is not None:
            order.supplier_city = data.supplier_city
        if data.notes is not None:
            order.notes = data.notes

        # Update items if provided
        if data.items is not None:
            # Update existing items or create new ones
            existing_item_ids = {item.id for item in order.items}
            updated_item_ids = set()

            for item_data in data.items:
                if item_data.id and item_data.id in existing_item_ids:
                    # Update existing item
                    item = session.get(PurchaseOrderItem, item_data.id)
                    if item:
                        if item_data.product_id is not None:
                            item.product_id = item_data.product_id
                        if item_data.product_name is not None:
                            item.product_name = item_data.product_name
                        if item_data.brand is not None:
                            item.brand = item_data.brand
                        if item_data.units_per_carton is not None:
                            item.units_per_carton = item_data.units_per_carton
                        if item_data.quantity_ordered is not None:
                            item.quantity_ordered = item_data.quantity_ordered
                        if item_data.quantity_received is not None:
                            item.quantity_received = item_data.quantity_received
                        if item_data.unit_price is not None:
                            item.unit_price = item_data.unit_price
                        if item_data.total_price is not None:
                            item.total_price = item_data.total_price
                        session.add(item)
                        updated_item_ids.add(item.id)
                else:
                    # Create new item
                    new_item = PurchaseOrderItem(
                        purchase_order_id=order.id,
                        product_id=item_data.product_id,
                        product_name=item_data.product_name or "",
                        brand=item_data.brand or "",
                        units_per_carton=item_data.units_per_carton or 1,
                        quantity_ordered=item_data.quantity_ordered or 1,
                        quantity_received=item_data.quantity_received or 0,
                        unit_price=item_data.unit_price or 0,
                        total_price=item_data.total_price or 0
                    )
                    session.add(new_item)

            # Note: We don't delete items that weren't in the update
            # If deletion is needed, it should be explicit

        # Recalculate total
        session.flush()
        order.total_amount = sum(item.total_price for item in order.items)
        order.updated_at = datetime.now(timezone.utc)

        session.add(order)
        session.commit()
        session.refresh(order)

        return order_to_response(order)

    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=422, detail=str(e))


@router.patch("/{order_id}/status", response_model=PurchaseOrderResponse)
async def update_purchase_order_status(
    order_id: int,
    status: str = Query(..., description="New status"),
    session: Session = Depends(get_session)
):
    """Update purchase order status"""
    order = session.get(PurchaseOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    try:
        # Validate status
        try:
            new_status = PurchaseOrderStatus(status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")

        order.status = new_status
        now = datetime.now(timezone.utc)

        if new_status == PurchaseOrderStatus.SENT:
            order.sent_at = now
        elif new_status == PurchaseOrderStatus.CONFIRMED:
            order.confirmed_at = now
        elif new_status == PurchaseOrderStatus.DELIVERED:
            order.delivered_at = now

        order.updated_at = now
        session.add(order)
        session.commit()
        session.refresh(order)

        return order_to_response(order)

    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/{order_id}/deliver", response_model=PurchaseOrderResponse)
async def confirm_delivery(
    order_id: int,
    delivery: DeliveryConfirmation,
    session: Session = Depends(get_session)
):
    """
    Confirm delivery with received quantities.
    Updates stock in the products table for linked products.

    VALIDATION: All items must have a valid product_id linked to an existing product.
    If any item is not linked, the delivery will be rejected.
    """
    order = session.get(PurchaseOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    # Only allow delivery confirmation for confirmed orders
    if order.status != PurchaseOrderStatus.CONFIRMED:
        raise HTTPException(
            status_code=400,
            detail=f"Can only deliver confirmed orders. Current status: '{order.status.value}'"
        )

    try:
        # VALIDATION: Check all items have valid product_id linked to existing products
        unlinked_items = []
        for item in order.items:
            if not item.product_id:
                unlinked_items.append(f"'{item.product_name}' (pas de produit lié)")
            else:
                product = session.get(Product, item.product_id)
                if not product:
                    unlinked_items.append(f"'{item.product_name}' (produit ID {item.product_id} introuvable)")

        if unlinked_items:
            raise HTTPException(
                status_code=400,
                detail=f"Impossible de confirmer la livraison. Produits non liés au catalogue: {', '.join(unlinked_items)}. Supprimez ces articles ou liez-les à des produits existants."
            )

        # Create a map of item_id -> quantity_received
        received_map = {item.item_id: item.quantity_received for item in delivery.items}

        # Update each item and sync stock
        for item in order.items:
            if item.id in received_map:
                quantity_received = received_map[item.id]
                item.quantity_received = quantity_received

                # Sync stock to products table (already validated above)
                product = session.get(Product, item.product_id)
                if product:
                    # Add received units to stock (cartons × units per carton)
                    units_to_add = quantity_received * item.units_per_carton
                    product.stock_quantity = (product.stock_quantity or 0) + units_to_add
                    product.updated_at = datetime.now(timezone.utc)
                    session.add(product)

                session.add(item)

        # Update order status and notes
        order.status = PurchaseOrderStatus.DELIVERED
        order.delivered_at = datetime.now(timezone.utc)
        order.updated_at = datetime.now(timezone.utc)

        if delivery.notes:
            existing_notes = order.notes or ""
            order.notes = f"{existing_notes}\n[Livraison] {delivery.notes}".strip()

        session.add(order)
        session.commit()
        session.refresh(order)

        return order_to_response(order)

    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=422, detail=str(e))


@router.delete("/{order_id}/items/{item_id}", response_model=PurchaseOrderResponse)
async def delete_purchase_order_item(
    order_id: int,
    item_id: int,
    session: Session = Depends(get_session)
):
    """
    Delete an item from a purchase order.
    Allowed for draft and confirmed orders.
    If this is the last item, the entire order is deleted.
    """
    order = session.get(PurchaseOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    # Only allow deleting items from draft or confirmed orders
    if order.status not in [PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.CONFIRMED]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete items from order with status '{order.status.value}'"
        )

    # Find the item
    item = session.get(PurchaseOrderItem, item_id)
    if not item or item.purchase_order_id != order_id:
        raise HTTPException(status_code=404, detail="Item not found in this order")

    try:
        # If this is the last item, delete the entire order
        if len(order.items) <= 1:
            session.delete(order)
            session.commit()
            # Return empty response with 204 No Content would be ideal,
            # but we need to indicate the order was deleted
            raise HTTPException(
                status_code=200,
                detail={"message": "Order deleted (was the last item)", "order_deleted": True}
            )

        # Calculate new total BEFORE deleting (exclude the item being deleted)
        new_total = sum(i.total_price for i in order.items if i.id != item_id)

        # Delete the item
        session.delete(item)

        # Update order
        order.total_amount = new_total
        order.updated_at = datetime.now(timezone.utc)
        session.add(order)

        session.commit()
        session.refresh(order)

        return order_to_response(order)

    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=422, detail=str(e))


@router.delete("/{order_id}")
async def delete_purchase_order(
    order_id: int,
    session: Session = Depends(get_session)
):
    """Delete a purchase order (only drafts can be deleted)"""
    order = session.get(PurchaseOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    # Only allow deleting drafts
    if order.status != PurchaseOrderStatus.DRAFT:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete order with status '{order.status.value}'. Only drafts can be deleted."
        )

    try:
        session.delete(order)
        session.commit()
        return {"success": True, "message": "Purchase order deleted"}

    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=422, detail=str(e))
