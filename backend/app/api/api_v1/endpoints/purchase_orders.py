from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func
from datetime import datetime, timezone

from app.database import get_session
from app.models.purchase_order import (
    PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus,
    PurchaseOrderCreate, PurchaseOrderUpdate,
    PurchaseOrderResponse, PurchaseOrderItemResponse, PurchaseOrderListResponse
)

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
            product_name=item.product_name,
            brand=item.brand,
            units_per_carton=item.units_per_carton,
            quantity=item.quantity,
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
                product_name=item_data.product_name,
                brand=item_data.brand,
                units_per_carton=item_data.units_per_carton,
                quantity=item_data.quantity,
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
    """Update a purchase order"""
    order = session.get(PurchaseOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    try:
        # Update fields
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

        # Handle status change with timestamps
        if data.status is not None:
            order.status = data.status
            now = datetime.now(timezone.utc)

            if data.status == PurchaseOrderStatus.SENT:
                order.sent_at = now
            elif data.status == PurchaseOrderStatus.CONFIRMED:
                order.confirmed_at = now
            elif data.status == PurchaseOrderStatus.DELIVERED:
                order.delivered_at = now

        order.updated_at = datetime.now(timezone.utc)
        session.add(order)
        session.commit()
        session.refresh(order)

        return order_to_response(order)

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


@router.delete("/{order_id}")
async def delete_purchase_order(
    order_id: int,
    session: Session = Depends(get_session)
):
    """Delete a purchase order"""
    order = session.get(PurchaseOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    try:
        session.delete(order)
        session.commit()
        return {"success": True, "message": "Purchase order deleted"}

    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=422, detail=str(e))
