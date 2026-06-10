from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func
from datetime import datetime, timezone
from pydantic import BaseModel

from app.database import get_session
from app.models.purchase_order import (
    PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus,
    PurchaseOrderCreate, PurchaseOrderUpdate,
    PurchaseOrderResponse, PurchaseOrderItemResponse, PurchaseOrderListResponse,
    DeliveryConfirmation
)
from app.models.product import Product, ProductUnit
from app.models.restock import RestockItem
from app.models.supplier import SupplierProductPrice


class FactureItemUpdate(BaseModel):
    item_id: int
    facture_quantity: int
    facture_unit_price: float

class FactureItemsBulkUpdate(BaseModel):
    items: list[FactureItemUpdate]

router = APIRouter()


# =============================================================================
# Helper Functions
# =============================================================================

def generate_reference(session: Session) -> str:
    """Generate a unique reference number for purchase order (YYYY-MM-DD-NNN)"""
    now = datetime.now()
    date_prefix = now.strftime("%Y-%m-%d")

    # Get the count of orders created today
    count = session.exec(
        select(func.count(PurchaseOrder.id)).where(
            PurchaseOrder.reference.like(f"{date_prefix}-%")
        )
    ).one()

    next_num = count + 1
    return f"{date_prefix}-{next_num:04d}"


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
            facture_quantity=item.facture_quantity,
            facture_unit_price=item.facture_unit_price,
            unit_price=item.unit_price,
            total_price=item.total_price
        )
        for item in order.items
    ]

    return PurchaseOrderResponse(
        id=order.id,
        reference=order.reference,
        supplier_id=order.supplier_id,
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


@router.get("/cmup", response_model=dict[int, float])
async def get_products_cmup(
    session: Session = Depends(get_session)
):
    """Get CMUP (weighted average cost per piece) for all products.
    Formula: SUM(quantity_ordered * unit_price) / SUM(quantity_ordered * units_per_carton)
    Uses P.U/pcs = unit_price / units_per_carton from delivered purchase orders.
    """
    rows = session.exec(
        select(
            PurchaseOrderItem.product_id,
            (
                func.sum(PurchaseOrderItem.quantity_ordered * PurchaseOrderItem.unit_price) /
                func.nullif(
                    func.sum(PurchaseOrderItem.quantity_ordered * PurchaseOrderItem.units_per_carton),
                    0
                )
            ).label("cmup")
        )
        .join(PurchaseOrder, PurchaseOrderItem.purchase_order_id == PurchaseOrder.id)
        .where(PurchaseOrder.status == PurchaseOrderStatus.DELIVERED)
        .where(PurchaseOrderItem.product_id != None)
        .where(PurchaseOrderItem.unit_price > 0)
        .where(PurchaseOrderItem.units_per_carton > 0)
        .group_by(PurchaseOrderItem.product_id)
    ).all()

    return {row[0]: round(row[1], 2) for row in rows if row[1] is not None}


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
            supplier_id=data.supplier_id,
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

    # Only allow editing draft or sent orders
    if order.status not in [PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.SENT]:
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

        # Update items if provided - replace all items (simpler for draft editing)
        if data.items is not None:
            # Delete all existing items
            for item in order.items:
                session.delete(item)
            session.flush()

            # Create new items from the update
            for item_data in data.items:
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

        # Recalculate total - refresh order to get updated items
        session.flush()
        session.refresh(order)
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
    Updates stock in the products table for linked products only.
    Items without product_id are still marked as delivered but don't update stock.
    """
    order = session.get(PurchaseOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    # Only allow delivery confirmation for sent orders
    if order.status != PurchaseOrderStatus.SENT:
        raise HTTPException(
            status_code=400,
            detail=f"Can only deliver sent orders. Current status: '{order.status.value}'"
        )

    try:
        # Create a map of item_id -> (quantity_received, facture_quantity)
        received_map = {item.item_id: item for item in delivery.items}

        # Update each item and sync stock
        for item in order.items:
            if item.id in received_map:
                delivery_item = received_map[item.id]
                quantity_received = delivery_item.quantity_received
                item.quantity_received = quantity_received
                item.facture_quantity = delivery_item.facture_quantity
                item.facture_unit_price = delivery_item.facture_unit_price

                product = None

                # If item has product_id, get existing product
                if item.product_id:
                    product = session.get(Product, item.product_id)
                # If no product exists, try to create one from restock item
                if not product:
                    # Find matching restock item by name
                    restock_item = session.exec(
                        select(RestockItem).where(RestockItem.name == item.product_name)
                    ).first()

                    if restock_item and restock_item.category_id:
                        # Map unit string to ProductUnit enum
                        unit_str = (restock_item.product_unit or "piece").lower()
                        try:
                            unit = ProductUnit(unit_str)
                        except ValueError:
                            unit = ProductUnit.PIECE

                        # Check if brand exists, skip if not
                        brand_id = None
                        if restock_item.brand_id:
                            from app.models.brand import Brand
                            brand = session.get(Brand, restock_item.brand_id)
                            if brand:
                                brand_id = restock_item.brand_id

                        # Create product from restock item data
                        product = Product(
                            name=restock_item.name,
                            price=0,
                            unit=unit,
                            pieces_per_box=restock_item.unite_par_carton or item.units_per_carton,
                            stock_quantity=0,
                            is_active=False,
                            category_id=restock_item.category_id,
                            brand_id=brand_id,
                            description=restock_item.description,
                            image_url=restock_item.image,
                            created_at=datetime.now(timezone.utc)
                        )
                        session.add(product)
                        session.flush()  # Get the product ID

                        # Link order item to new product
                        item.product_id = product.id

                        # Also link restock item to product
                        restock_item.product_id = product.id
                        session.add(restock_item)

                # Update stock if product exists
                if product:
                    units_to_add = quantity_received * item.units_per_carton
                    product.stock_quantity = (product.stock_quantity or 0) + units_to_add
                    product.updated_at = datetime.now(timezone.utc)
                    session.add(product)

                session.add(item)

        # Auto-create price history entries if order is linked to a supplier
        if order.supplier_id:
            now = datetime.now(timezone.utc)
            for item in order.items:
                if item.product_id and item.id in received_map:
                    delivery_item = received_map[item.id]
                    price_entry = SupplierProductPrice(
                        supplier_id=order.supplier_id,
                        product_id=item.product_id,
                        purchase_order_id=order.id,
                        unit_price=item.unit_price,
                        quantity_received=delivery_item.quantity_received,
                        date=now
                    )
                    session.add(price_entry)

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
        import traceback
        traceback.print_exc()
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

    # Only allow deleting items from draft or sent orders
    if order.status not in [PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.SENT]:
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


@router.patch("/{order_id}/facture-items", response_model=PurchaseOrderResponse)
async def update_facture_items(
    order_id: int,
    data: FactureItemsBulkUpdate,
    session: Session = Depends(get_session)
):
    """Bulk-update facture_quantity and facture_unit_price for all items on an order."""
    order = session.get(PurchaseOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    for update in data.items:
        item = session.get(PurchaseOrderItem, update.item_id)
        if not item or item.purchase_order_id != order_id:
            continue
        item.facture_quantity = update.facture_quantity
        item.facture_unit_price = update.facture_unit_price
        session.add(item)
    session.commit()
    session.refresh(order)
    return order_to_response(order)


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
