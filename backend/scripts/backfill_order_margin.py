"""
Backfill margin fields for all existing orders.
Run from the backend/ directory:

    python scripts/backfill_order_margin.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, select
from app.database import engine
import app.models  # noqa: F401 — registers all SQLModel table models
from app.models.order_payments import OrderPayment, OrderAuditLog  # noqa: F401 — resolves Order relationships
from app.models.order import Order, OrderItem
from app.models.product_purchase_lot import ProductPurchaseLot


def backfill():
    with Session(engine) as session:
        orders = session.exec(select(Order)).all()
        print(f"Processing {len(orders)} orders...")

        updated = 0
        skipped = 0

        for order in orders:
            items = session.exec(
                select(OrderItem).where(OrderItem.order_id == order.id)
            ).all()
            if not items:
                skipped += 1
                continue

            product_ids = list({i.product_id for i in items})
            lots = session.exec(
                select(ProductPurchaseLot)
                .where(ProductPurchaseLot.product_id.in_(product_ids))
                .order_by(ProductPurchaseLot.product_id, ProductPurchaseLot.created_at.desc())
            ).all()
            cmup_map: dict = {}
            for lot in lots:
                if lot.product_id not in cmup_map:
                    cmup_map[lot.product_id] = lot.cmup

            if not cmup_map:
                skipped += 1
                continue

            total_margin = 0.0
            total_revenue = 0.0
            has_data = False
            for item in items:
                cmup = cmup_map.get(item.product_id)
                effective_price = item.custom_unit_price if item.custom_unit_price is not None else item.unit_price
                total_revenue += effective_price * item.quantity
                if cmup is not None:
                    has_data = True
                    item_margin = round((effective_price - cmup) * item.quantity, 2)
                    item_margin_pct = round((effective_price - cmup) / effective_price * 100, 1) if effective_price > 0 else None
                    total_margin += item_margin
                else:
                    item_margin = None
                    item_margin_pct = None
                item.cmup = cmup
                item.item_margin = item_margin
                item.item_margin_pct = item_margin_pct
                session.add(item)

            order.margin = round(total_margin, 2) if has_data and total_revenue > 0 else None
            order.margin_pct = round(total_margin / total_revenue * 100, 1) if has_data and total_revenue > 0 else None
            session.add(order)
            updated += 1

        session.commit()
        print(f"Done. Updated: {updated}, Skipped (no items/CMUP): {skipped}")


if __name__ == "__main__":
    backfill()
