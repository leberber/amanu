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
from app.models.product_purchase_lot import ProductPurchaseLot
from app.models.audit_log import AuditLog
from app.models.user import User
from app.core.security import get_current_staff_user
from app.core.audit import log_audit


class FactureItemUpdate(BaseModel):
    item_id: int
    quantity_ordered: Optional[int] = None
    facture_quantity: int
    facture_unit_price: float
    units_per_carton: Optional[int] = None
    unit_price: Optional[float] = None
    quantity_rejected: Optional[int] = None
    made_date: Optional[str] = None
    expiry_date: Optional[str] = None

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


def order_to_response(order: PurchaseOrder, session: Session = None) -> PurchaseOrderResponse:
    """Convert database model to response model"""
    # Build lot data lookup keyed by purchase_order_item_id
    lot_map: dict = {}
    if session:
        lots = session.exec(
            select(ProductPurchaseLot)
            .where(ProductPurchaseLot.purchase_order_id == order.id)
            .order_by(ProductPurchaseLot.created_at.desc())
        ).all()
        for lot in lots:
            if lot.purchase_order_item_id and lot.purchase_order_item_id not in lot_map:
                lot_map[lot.purchase_order_item_id] = lot

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
            total_price=item.total_price,
            made_date=lot_map[item.id].made_date.isoformat() if item.id in lot_map and lot_map[item.id].made_date else None,
            expiry_date=lot_map[item.id].expiry_date.isoformat() if item.id in lot_map and lot_map[item.id].expiry_date else None,
            quantity_rejected=lot_map[item.id].quantity_rejected if item.id in lot_map else None,
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
    limit: int = Query(500, ge=1, le=10000),
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


@router.get("/current-cmup", response_model=dict[int, float])
async def get_current_cmup(session: Session = Depends(get_session)):
    """Get the current CMUP per product from the latest product_purchase_lot record."""
    from sqlalchemy import text
    rows = session.exec(
        text(
            """
            SELECT DISTINCT ON (product_id) product_id, cmup
            FROM product_purchase_lots
            ORDER BY product_id, created_at DESC
            """
        )
    ).all()
    return {row[0]: round(row[1], 4) for row in rows}


@router.get("/cmup-tiers", response_model=dict[int, list[dict]])
async def get_products_cmup_tiers(session: Session = Depends(get_session)):
    """Get price tiers per product (grouped by unit price) from delivered purchase orders."""
    rows = session.exec(
        select(
            PurchaseOrderItem.product_id,
            PurchaseOrderItem.unit_price,
            PurchaseOrderItem.units_per_carton,
            func.sum(PurchaseOrderItem.quantity_ordered).label("total_cartons")
        )
        .join(PurchaseOrder, PurchaseOrderItem.purchase_order_id == PurchaseOrder.id)
        .where(PurchaseOrder.status == PurchaseOrderStatus.DELIVERED)
        .where(PurchaseOrderItem.product_id != None)
        .where(PurchaseOrderItem.unit_price > 0)
        .where(PurchaseOrderItem.units_per_carton > 0)
        .group_by(PurchaseOrderItem.product_id, PurchaseOrderItem.unit_price, PurchaseOrderItem.units_per_carton)
        .order_by(PurchaseOrderItem.product_id, PurchaseOrderItem.unit_price.desc())
    ).all()

    result: dict[int, list[dict]] = {}
    for product_id, unit_price, units_per_carton, total_cartons in rows:
        if product_id not in result:
            result[product_id] = []
        result[product_id].append({
            "unit_price": round(unit_price / units_per_carton, 2),
            "total_cartons": int(total_cartons),
            "units_per_carton": units_per_carton
        })
    return result


@router.get("/product-lifecycles")
async def get_product_lifecycles(session: Session = Depends(get_session)):
    """Get all lots with dates per product, ordered by expiry date ascending."""
    from sqlalchemy import text
    rows = session.exec(
        text("""
            SELECT product_id, made_date, expiry_date, quantity_added
            FROM product_purchase_lots
            WHERE made_date IS NOT NULL AND expiry_date IS NOT NULL
            ORDER BY product_id, expiry_date ASC
        """)
    ).all()
    result: dict = {}
    for row in rows:
        pid = row[0]
        entry = {
            "made_date": row[1].isoformat() if row[1] else None,
            "expiry_date": row[2].isoformat() if row[2] else None,
            "quantity_added": row[3] or 0,
        }
        if pid not in result:
            result[pid] = []
        result[pid].append(entry)
    return result


@router.get("/product-lots/{product_id}")
async def get_product_lots(product_id: int, session: Session = Depends(get_session)):
    """Get all purchase lots for a product, ordered newest first."""
    lots = session.exec(
        select(ProductPurchaseLot)
        .where(ProductPurchaseLot.product_id == product_id)
        .order_by(ProductPurchaseLot.created_at.desc())
    ).all()
    return [
        {
            "id": lot.id,
            "purchase_order_id": lot.purchase_order_id,
            "stock_before": lot.stock_before,
            "quantity_added": lot.quantity_added,
            "quantity_rejected": lot.quantity_rejected,
            "units_per_carton": lot.units_per_carton,
            "unit_price_per_carton": lot.unit_price_per_carton,
            "unit_price": lot.unit_price,
            "cmup": lot.cmup,
            "made_date": lot.made_date.isoformat() if lot.made_date else None,
            "expiry_date": lot.expiry_date.isoformat() if lot.expiry_date else None,
            "created_at": lot.created_at.isoformat(),
        }
        for lot in lots
    ]



class CmupUpdate(BaseModel):
    cmup: float


@router.patch("/cmup/{product_id}")
async def update_product_cmup(
    product_id: int,
    body: CmupUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user)
):
    """Manually update the CMUP on the latest ProductPurchaseLot for a product."""
    lot = session.exec(
        select(ProductPurchaseLot)
        .where(ProductPurchaseLot.product_id == product_id)
        .order_by(ProductPurchaseLot.created_at.desc())
    ).first()

    if not lot:
        raise HTTPException(status_code=404, detail="No purchase lot found for this product")

    lot.cmup = body.cmup
    session.add(lot)
    session.commit()
    session.refresh(lot)
    return {"cmup": lot.cmup}


@router.get("/{order_id}/audit-logs")
async def get_order_audit_logs(
    order_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
):
    """Return all audit log entries for a purchase order, newest first."""
    logs = session.exec(
        select(AuditLog)
        .where(AuditLog.entity_type == "purchase_order")
        .where(AuditLog.entity_id == order_id)
        .order_by(AuditLog.created_at.desc())
    ).all()
    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "user_name": log.user_name,
            "action": log.action,
            "changes": log.changes,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]


@router.get("/{order_id}", response_model=PurchaseOrderResponse)
async def get_purchase_order(
    order_id: int,
    session: Session = Depends(get_session)
):
    """Get a single purchase order by ID"""
    order = session.get(PurchaseOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    return order_to_response(order, session)


@router.post("", response_model=PurchaseOrderResponse)
async def create_purchase_order(
    data: PurchaseOrderCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
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

        log_audit(session, current_user, "create", "purchase_order", order.id,
                  {"reference": order.reference, "supplier": order.supplier_name, "item_count": len(data.items)})
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
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
):
    """Update a purchase order (including items)"""
    order = session.get(PurchaseOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    # Only allow editing draft, sent, or delivered orders
    if order.status not in [PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.SENT, PurchaseOrderStatus.DELIVERED]:
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

        if order.status == PurchaseOrderStatus.DELIVERED:
            log_audit(session, current_user, "update_order", "purchase_order", order_id)
        session.add(order)
        session.commit()
        session.refresh(order)

        return order_to_response(order, session)

    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=422, detail=str(e))


@router.patch("/{order_id}/status", response_model=PurchaseOrderResponse)
async def update_purchase_order_status(
    order_id: int,
    status: str = Query(..., description="New status"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
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

        old_status = order.status.value if isinstance(order.status, PurchaseOrderStatus) else str(order.status)
        order.status = new_status
        now = datetime.now(timezone.utc)

        if new_status == PurchaseOrderStatus.SENT:
            order.sent_at = now
        elif new_status == PurchaseOrderStatus.CONFIRMED:
            order.confirmed_at = now
        elif new_status == PurchaseOrderStatus.DELIVERED:
            order.delivered_at = now

        order.updated_at = now
        log_audit(session, current_user, "status_change", "purchase_order", order_id,
                  {"status": {"old": old_status, "new": status}})
        session.add(order)
        session.commit()
        session.refresh(order)

        return order_to_response(order, session)

    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/{order_id}/deliver", response_model=PurchaseOrderResponse)
async def confirm_delivery(
    order_id: int,
    delivery: DeliveryConfirmation,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
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
                if delivery_item.units_per_carton is not None:
                    item.units_per_carton = delivery_item.units_per_carton
                if delivery_item.unit_price is not None:
                    item.unit_price = delivery_item.unit_price

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

                # Update stock and record CMUP lot if product exists
                if product:
                    qty_rejected = delivery_item.quantity_rejected
                    cartons_accepted = quantity_received - qty_rejected
                    units_to_add = cartons_accepted * item.units_per_carton
                    stock_before = float(product.stock_quantity or 0)
                    unit_price_per_unit = (item.unit_price / item.units_per_carton) if item.units_per_carton > 0 else item.unit_price

                    # Get previous CMUP from latest lot for this product
                    last_lot = session.exec(
                        select(ProductPurchaseLot)
                        .where(ProductPurchaseLot.product_id == product.id)
                        .order_by(ProductPurchaseLot.created_at.desc())
                    ).first()
                    prev_cmup = last_lot.cmup if last_lot else unit_price_per_unit

                    # CMUP mobile formula
                    if stock_before + units_to_add > 0:
                        new_cmup = (stock_before * prev_cmup + units_to_add * unit_price_per_unit) / (stock_before + units_to_add)
                    else:
                        new_cmup = unit_price_per_unit

                    # Create lot record
                    from datetime import date as date_type
                    made_date = None
                    if delivery_item.made_date:
                        try:
                            made_date = date_type.fromisoformat(delivery_item.made_date)
                        except ValueError:
                            pass
                    expiry_date = None
                    if delivery_item.expiry_date:
                        try:
                            expiry_date = date_type.fromisoformat(delivery_item.expiry_date)
                        except ValueError:
                            pass

                    lot = ProductPurchaseLot(
                        product_id=product.id,
                        purchase_order_id=order.id,
                        purchase_order_item_id=item.id,
                        stock_before=stock_before,
                        quantity_added=float(units_to_add),
                        quantity_rejected=qty_rejected,
                        units_per_carton=item.units_per_carton,
                        unit_price_per_carton=item.unit_price,
                        unit_price=round(unit_price_per_unit, 4),
                        cmup=round(new_cmup, 4),
                        made_date=made_date,
                        expiry_date=expiry_date,
                    )
                    session.add(lot)

                    product.stock_quantity = stock_before + units_to_add
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

        log_audit(session, current_user, "confirm_delivery", "purchase_order", order_id,
                  {"item_count": len(delivery.items)})
        session.add(order)
        session.commit()
        session.refresh(order)

        return order_to_response(order, session)

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
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
):
    """
    Delete an item from a purchase order.
    Allowed for draft and confirmed orders.
    If this is the last item, the entire order is deleted.
    """
    order = session.get(PurchaseOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    # Only allow deleting items from draft, sent, or delivered orders
    if order.status not in [PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.SENT, PurchaseOrderStatus.DELIVERED]:
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

        if order.status == PurchaseOrderStatus.DELIVERED:
            log_audit(session, current_user, "delete_item", "purchase_order", order_id,
                      {"item_id": item_id, "product_name": item.product_name})

        # Delete the item
        session.delete(item)

        # Update order
        order.total_amount = new_total
        order.updated_at = datetime.now(timezone.utc)
        session.add(order)

        session.commit()
        session.refresh(order)

        return order_to_response(order, session)

    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=422, detail=str(e))


@router.patch("/{order_id}/facture-items", response_model=PurchaseOrderResponse)
async def update_facture_items(
    order_id: int,
    data: FactureItemsBulkUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
):
    """Bulk-update facture_quantity and facture_unit_price for all items on an order."""
    order = session.get(PurchaseOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    from datetime import date as date_type
    item_changes = []
    for update in data.items:
        item = session.get(PurchaseOrderItem, update.item_id)
        if not item or item.purchase_order_id != order_id:
            continue

        # Capture old values before update
        change = {"product_name": item.product_name}
        if item.facture_quantity != update.facture_quantity:
            change["facture_quantity"] = {"old": item.facture_quantity, "new": update.facture_quantity}
        if item.facture_unit_price != update.facture_unit_price:
            change["facture_unit_price"] = {"old": item.facture_unit_price, "new": update.facture_unit_price}
        if len(change) > 1:  # more than just product_name
            item_changes.append(change)

        if update.quantity_ordered is not None:
            item.quantity_ordered = update.quantity_ordered
            item.total_price = update.quantity_ordered * item.unit_price
        item.facture_quantity = update.facture_quantity
        item.facture_unit_price = update.facture_unit_price
        if update.units_per_carton is not None:
            item.units_per_carton = update.units_per_carton
        if update.unit_price is not None:
            item.unit_price = update.unit_price
            item.total_price = item.quantity_ordered * update.unit_price
        session.add(item)

        # Also update the corresponding lot record if dates/rejected changed
        if update.quantity_rejected is not None or update.made_date is not None or update.expiry_date is not None:
            lot = session.exec(
                select(ProductPurchaseLot)
                .where(ProductPurchaseLot.purchase_order_item_id == update.item_id)
                .order_by(ProductPurchaseLot.created_at.desc())
            ).first()
            if lot:
                if update.quantity_rejected is not None:
                    lot.quantity_rejected = update.quantity_rejected
                if update.made_date is not None:
                    try:
                        lot.made_date = date_type.fromisoformat(update.made_date)
                    except ValueError:
                        pass
                if update.expiry_date is not None:
                    try:
                        lot.expiry_date = date_type.fromisoformat(update.expiry_date)
                    except ValueError:
                        pass
                session.add(lot)

    order.total_amount = sum(item.total_price for item in order.items)
    session.add(order)
    log_audit(session, current_user, "update_facture", "purchase_order", order_id,
              {"items": item_changes} if item_changes else None)
    session.commit()
    session.refresh(order)
    return order_to_response(order, session)


@router.delete("/{order_id}")
async def delete_purchase_order(
    order_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
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
