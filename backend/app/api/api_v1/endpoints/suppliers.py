from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func
from typing import Any, List
from datetime import datetime, timezone

from app.database import get_session
from app.models.supplier import (
    Supplier, SupplierCreate, SupplierUpdate, SupplierRead,
    SupplierPayment, SupplierPaymentCreate, SupplierPaymentResponse,
    SupplierProductPrice, SupplierProductPriceResponse, SupplierStats
)
from app.models.purchase_order import PurchaseOrder, PurchaseOrderStatus
from app.models.product import Product
from app.models.user import User
from app.core.security import get_current_staff_user

router = APIRouter()


@router.get("", response_model=List[SupplierRead])
def read_suppliers(
    active_only: bool = Query(True),
    session: Session = Depends(get_session),
) -> Any:
    """
    Retrieve all suppliers.
    """
    query = select(Supplier)

    if active_only:
        query = query.where(Supplier.is_active == True)

    # Order by name
    query = query.order_by(Supplier.name)

    suppliers = session.exec(query).all()
    return suppliers


@router.get("/{supplier_id}", response_model=SupplierRead)
def read_supplier(
    supplier_id: int,
    session: Session = Depends(get_session),
) -> Any:
    """
    Get supplier by ID.
    """
    supplier = session.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(
            status_code=404,
            detail="Supplier not found",
        )
    return supplier


@router.post("", response_model=SupplierRead)
def create_supplier(
    supplier_in: SupplierCreate,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Create a new supplier (staff only).
    """
    supplier = Supplier.model_validate(supplier_in)
    supplier.created_at = datetime.now(timezone.utc)

    session.add(supplier)
    session.commit()
    session.refresh(supplier)
    return supplier


@router.patch("/{supplier_id}", response_model=SupplierRead)
def update_supplier(
    supplier_id: int,
    supplier_in: SupplierUpdate,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Update a supplier (staff only).
    """
    supplier = session.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(
            status_code=404,
            detail="Supplier not found",
        )

    # Update fields
    update_data = supplier_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(supplier, field, value)

    supplier.updated_at = datetime.now(timezone.utc)

    session.add(supplier)
    session.commit()
    session.refresh(supplier)
    return supplier


@router.delete("/{supplier_id}")
def delete_supplier(
    supplier_id: int,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Delete a supplier (staff only).
    Mark as inactive if related data exists.
    """
    supplier = session.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(
            status_code=404,
            detail="Supplier not found",
        )

    # For now, just mark as inactive to preserve data integrity
    # In the future, could check for related purchase orders
    supplier.is_active = False
    supplier.updated_at = datetime.now(timezone.utc)
    session.add(supplier)
    session.commit()

    return None


# =============================================================================
# Supplier Stats
# =============================================================================

@router.get("/{supplier_id}/stats", response_model=SupplierStats)
def get_supplier_stats(
    supplier_id: int,
    session: Session = Depends(get_session),
) -> Any:
    supplier = session.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    # Total ordered = sum of total_amount on delivered orders for this supplier
    total_ordered = session.exec(
        select(func.coalesce(func.sum(PurchaseOrder.total_amount), 0.0))
        .where(PurchaseOrder.supplier_id == supplier_id)
        .where(PurchaseOrder.status == PurchaseOrderStatus.DELIVERED)
    ).one()

    # Total paid
    total_paid = session.exec(
        select(func.coalesce(func.sum(SupplierPayment.amount), 0.0))
        .where(SupplierPayment.supplier_id == supplier_id)
    ).one()

    # Order counts
    order_count = session.exec(
        select(func.count(PurchaseOrder.id))
        .where(PurchaseOrder.supplier_id == supplier_id)
    ).one()

    pending_order_count = session.exec(
        select(func.count(PurchaseOrder.id))
        .where(PurchaseOrder.supplier_id == supplier_id)
        .where(PurchaseOrder.status.in_([
            PurchaseOrderStatus.DRAFT,
            PurchaseOrderStatus.SENT,
            PurchaseOrderStatus.CONFIRMED
        ]))
    ).one()

    return SupplierStats(
        supplier=SupplierRead.model_validate(supplier),
        total_ordered=float(total_ordered),
        total_paid=float(total_paid),
        balance_owed=float(total_ordered) - float(total_paid),
        order_count=order_count,
        pending_order_count=pending_order_count,
    )


# =============================================================================
# Supplier Payments
# =============================================================================

@router.get("/{supplier_id}/payments", response_model=List[SupplierPaymentResponse])
def get_supplier_payments(
    supplier_id: int,
    session: Session = Depends(get_session),
) -> Any:
    supplier = session.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    payments = session.exec(
        select(SupplierPayment)
        .where(SupplierPayment.supplier_id == supplier_id)
        .order_by(SupplierPayment.payment_date.desc())
    ).all()
    return payments


@router.post("/{supplier_id}/payments", response_model=SupplierPaymentResponse)
def create_supplier_payment(
    supplier_id: int,
    payment_in: SupplierPaymentCreate,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    supplier = session.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    payment = SupplierPayment(
        supplier_id=supplier_id,
        amount=payment_in.amount,
        payment_date=payment_in.payment_date or datetime.now(timezone.utc),
        payment_method=payment_in.payment_method,
        notes=payment_in.notes,
    )
    session.add(payment)
    session.commit()
    session.refresh(payment)
    return payment


@router.delete("/{supplier_id}/payments/{payment_id}")
def delete_supplier_payment(
    supplier_id: int,
    payment_id: int,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    payment = session.get(SupplierPayment, payment_id)
    if not payment or payment.supplier_id != supplier_id:
        raise HTTPException(status_code=404, detail="Payment not found")
    session.delete(payment)
    session.commit()
    return None


# =============================================================================
# Supplier Product Price History
# =============================================================================

@router.get("/{supplier_id}/product-prices", response_model=List[SupplierProductPriceResponse])
def get_supplier_product_prices(
    supplier_id: int,
    product_id: int = Query(None, description="Filter by product"),
    session: Session = Depends(get_session),
) -> Any:
    supplier = session.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    query = (
        select(SupplierProductPrice, Product, PurchaseOrder)
        .join(Product, SupplierProductPrice.product_id == Product.id)
        .join(PurchaseOrder, SupplierProductPrice.purchase_order_id == PurchaseOrder.id)
        .where(SupplierProductPrice.supplier_id == supplier_id)
    )

    if product_id:
        query = query.where(SupplierProductPrice.product_id == product_id)

    query = query.order_by(SupplierProductPrice.date.desc())
    rows = session.exec(query).all()

    return [
        SupplierProductPriceResponse(
            id=price.id,
            supplier_id=price.supplier_id,
            product_id=price.product_id,
            product_name=product.name,
            product_image=product.image_url,
            purchase_order_id=price.purchase_order_id,
            purchase_order_reference=po.reference,
            unit_price=price.unit_price,
            quantity_received=price.quantity_received,
            date=price.date,
            stock_quantity=product.stock_quantity,
            units_per_carton=product.pieces_per_box or 1,
            packaging_type=product.packaging_type.value if product.packaging_type else None,
        )
        for price, product, po in rows
    ]


@router.get("/{supplier_id}/purchase-orders", response_model=List[dict])
def get_supplier_purchase_orders(
    supplier_id: int,
    session: Session = Depends(get_session),
) -> Any:
    supplier = session.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    orders = session.exec(
        select(PurchaseOrder)
        .where(PurchaseOrder.supplier_id == supplier_id)
        .order_by(PurchaseOrder.created_at.desc())
    ).all()

    return [
        {
            "id": o.id,
            "reference": o.reference,
            "status": o.status.value,
            "total_amount": o.total_amount,
            "created_at": o.created_at,
            "delivered_at": o.delivered_at,
            "item_count": len(o.items),
        }
        for o in orders
    ]
