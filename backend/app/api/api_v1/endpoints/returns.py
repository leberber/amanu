from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.models.user import User
from app.models.order import Order, OrderItem
from app.models.order_payments import OrderAuditLog, AuditAction
from app.models.product import Product
from app.models.return_order import (
    OrderReturn, OrderReturnItem,
    OrderReturnCreate, OrderReturnRead, OrderReturnItemRead
)
from app.core.security import get_current_staff_user
from app.api.api_v1.endpoints.orders import _refresh_user_outstanding_balance

router = APIRouter()


def _build_item_read(item: OrderReturnItem, session: Session) -> OrderReturnItemRead:
    # Prefer stored values; fall back to the source OrderItem for old records
    ppb = item.pieces_per_box
    pkg = item.packaging_type
    if ppb is None or pkg is None:
        src = session.get(OrderItem, item.order_item_id)
        if src:
            ppb = ppb if ppb is not None else src.pieces_per_box
            pkg = pkg if pkg is not None else src.packaging_type
    return OrderReturnItemRead(
        id=item.id,
        order_item_id=item.order_item_id,
        product_id=item.product_id,
        product_name=item.product_name,
        quantity=item.quantity,
        unit_price=item.unit_price,
        pieces_per_box=ppb,
        packaging_type=pkg,
    )


def _build_read(ret: OrderReturn, session: Session) -> OrderReturnRead:
    order = session.get(Order, ret.order_id)
    creator = session.get(User, ret.created_by)
    customer = session.get(User, order.user_id) if order else None
    return OrderReturnRead(
        id=ret.id,
        order_id=ret.order_id,
        reason=ret.reason,
        notes=ret.notes,
        restocked=ret.restocked,
        refund_amount=ret.refund_amount,
        margin_impact=ret.margin_impact,
        created_at=ret.created_at,
        creator_name=creator.full_name if creator else None,
        customer_name=customer.full_name if customer else None,
        customer_segment_id=customer.segment_id if customer else None,
        items=[
            _build_item_read(item, session)
            for item in ret.items
        ],
    )


@router.get("", response_model=List[OrderReturnRead])
def list_returns(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
) -> Any:
    returns = session.exec(select(OrderReturn).order_by(OrderReturn.created_at.desc())).all()
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
    margin_impact = 0.0
    return_items = []

    for item_in in data.items:
        order_item = session.get(OrderItem, item_in.order_item_id)
        if not order_item or order_item.order_id != order.id:
            raise HTTPException(status_code=400, detail=f"Item {item_in.order_item_id} not found on this order")
        qty = min(item_in.quantity, order_item.quantity)
        refund_total += qty * order_item.unit_price

        if order_item.cmup is not None:
            margin_impact -= (order_item.unit_price - order_item.cmup) * qty

        if data.restock:
            product = session.get(Product, order_item.product_id)
            if product:
                product.stock_quantity += qty
                session.add(product)

        order_item.quantity -= qty
        session.add(order_item)

        return_items.append(OrderReturnItem(
            order_item_id=order_item.id,
            product_id=order_item.product_id,
            product_name=order_item.product_name,
            quantity=qty,
            unit_price=order_item.unit_price,
            pieces_per_box=order_item.pieces_per_box,
            packaging_type=order_item.packaging_type,
        ))

    ret = OrderReturn(
        order_id=order.id,
        created_by=current_user.id,
        reason=data.reason,
        notes=data.notes,
        restocked=data.restock,
        refund_amount=refund_total,
        margin_impact=round(margin_impact, 2) if margin_impact != 0.0 else None,
        items=return_items,
    )
    session.add(ret)
    session.flush()

    if refund_total > 0:
        order.total_amount = max(0.0, order.total_amount - refund_total)
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
            details={"amount": refund_total, "return_id": ret.id, "restocked": data.restock},
        )
        session.add(log)

    if order.user_id and refund_total > 0:
        _refresh_user_outstanding_balance(order.user_id, session)
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
