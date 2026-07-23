from typing import Any, List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.database import get_session
from app.models.user import User
from app.models.order import Order, OrderItem
from app.models.order_payments import OrderPayment, OrderAuditLog, AuditAction, PaymentMethod
from app.models.product import Product
from app.models.return_order import (
    OrderReturn, OrderReturnItem, ReturnStatus,
    OrderReturnCreate, OrderReturnRead, OrderReturnItemRead
)
from app.core.security import get_current_staff_user

router = APIRouter()


def _build_read(ret: OrderReturn, session: Session) -> OrderReturnRead:
    order = session.get(Order, ret.order_id)
    creator = session.get(User, ret.created_by)
    customer = session.get(User, order.user_id) if order else None
    return OrderReturnRead(
        id=ret.id,
        order_id=ret.order_id,
        status=ret.status,
        reason=ret.reason,
        notes=ret.notes,
        refund_amount=ret.refund_amount,
        created_at=ret.created_at,
        approved_at=ret.approved_at,
        received_at=ret.received_at,
        creator_name=creator.full_name if creator else None,
        customer_name=customer.full_name if customer else None,
        items=[
            OrderReturnItemRead(
                id=item.id,
                order_item_id=item.order_item_id,
                product_id=item.product_id,
                product_name=item.product_name,
                quantity=item.quantity,
                unit_price=item.unit_price,
            )
            for item in ret.items
        ],
    )


@router.get("", response_model=List[OrderReturnRead])
def list_returns(
    status: Optional[str] = Query(None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
) -> Any:
    query = select(OrderReturn).order_by(OrderReturn.created_at.desc())
    if status:
        query = query.where(OrderReturn.status == status)
    returns = session.exec(query).all()
    return [_build_read(r, session) for r in returns]


@router.post("", response_model=OrderReturnRead)
def create_return(
    data: OrderReturnCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
) -> Any:
    order = session.get(Order, data.order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    refund_total = 0.0
    return_items = []
    for item_in in data.items:
        order_item = session.get(OrderItem, item_in.order_item_id)
        if not order_item or order_item.order_id != order.id:
            raise HTTPException(status_code=400, detail=f"Item {item_in.order_item_id} not found on this order")
        qty = min(item_in.quantity, order_item.quantity)
        refund_total += qty * order_item.unit_price
        return_items.append(OrderReturnItem(
            order_item_id=order_item.id,
            product_id=order_item.product_id,
            product_name=order_item.product_name,
            quantity=qty,
            unit_price=order_item.unit_price,
        ))

    ret = OrderReturn(
        order_id=order.id,
        created_by=current_user.id,
        status=ReturnStatus.PENDING,
        reason=data.reason,
        notes=data.notes,
        refund_amount=refund_total,
        items=return_items,
    )
    session.add(ret)
    session.commit()
    session.refresh(ret)
    return _build_read(ret, session)


@router.get("/{return_id}", response_model=OrderReturnRead)
def get_return(
    return_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
) -> Any:
    ret = session.get(OrderReturn, return_id)
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")
    return _build_read(ret, session)


@router.patch("/{return_id}/approve", response_model=OrderReturnRead)
def approve_return(
    return_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
) -> Any:
    ret = session.get(OrderReturn, return_id)
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")
    if ret.status != ReturnStatus.PENDING:
        raise HTTPException(status_code=400, detail="Only pending returns can be approved")
    ret.status = ReturnStatus.APPROVED
    ret.approved_at = datetime.now(timezone.utc)
    session.add(ret)
    session.commit()
    session.refresh(ret)
    return _build_read(ret, session)


@router.patch("/{return_id}/receive", response_model=OrderReturnRead)
def receive_return(
    return_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
) -> Any:
    ret = session.get(OrderReturn, return_id)
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")
    if ret.status != ReturnStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Only approved returns can be received")

    ret.status = ReturnStatus.RECEIVED
    ret.received_at = datetime.now(timezone.utc)

    # Restock products
    for item in ret.items:
        product = session.get(Product, item.product_id)
        if product:
            product.stock_quantity += item.quantity
            session.add(product)

    # Auto-create refund payment (negative amount) on the original order
    if ret.refund_amount > 0:
        refund_payment = OrderPayment(
            order_id=ret.order_id,
            amount=-ret.refund_amount,
            method=PaymentMethod.CASH,
            note=f"Remboursement automatique — retour #{ret.id}",
            recorded_by=current_user.id,
        )
        session.add(refund_payment)
        session.flush()
        ret.refund_payment_id = refund_payment.id

        # Update order total_paid and payment_status
        order = session.get(Order, ret.order_id)
        if order:
            order.total_paid = max(0.0, order.total_paid - ret.refund_amount)
            grand_total = order.total_amount + (order.shipping_cost or 0)
            if order.total_paid <= 0:
                order.payment_status = "unpaid"
            elif order.total_paid < grand_total:
                order.payment_status = "partial"
            else:
                order.payment_status = "paid"
            session.add(order)

            log = OrderAuditLog(
                order_id=order.id,
                user_id=current_user.id,
                action=AuditAction.REFUND_RECORDED,
                details={"amount": ret.refund_amount, "return_id": ret.id},
            )
            session.add(log)

    session.add(ret)
    session.commit()
    session.refresh(ret)
    return _build_read(ret, session)


@router.patch("/{return_id}/reject", response_model=OrderReturnRead)
def reject_return(
    return_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
) -> Any:
    ret = session.get(OrderReturn, return_id)
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")
    if ret.status not in (ReturnStatus.PENDING, ReturnStatus.APPROVED):
        raise HTTPException(status_code=400, detail="Cannot reject this return")
    ret.status = ReturnStatus.REJECTED
    session.add(ret)
    session.commit()
    session.refresh(ret)
    return _build_read(ret, session)
