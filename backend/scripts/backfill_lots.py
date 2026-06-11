"""
Backfill script for product_purchase_lots table.

Replays all delivered purchase order items in chronological order (by delivered_at)
to compute CMUP mobile for each product retroactively.

Assumptions:
- stock_before starts at 0 for the first lot of each product (no historical stock data)
- quantity_rejected = 0 for all backfilled lots (wasn't tracked before)
- created_at is set to the order's delivered_at timestamp to preserve timeline

Run from the backend/ directory:
    python scripts/backfill_lots.py

Pass --dry-run to preview without writing to the database.
Pass --force to re-run even if lots already exist (deletes existing lots first).
"""

import sys
import os
import argparse
from collections import defaultdict
from datetime import datetime, timezone

# Ensure the backend/ directory is in sys.path so imports work
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, select
from app.database import engine
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus
from app.models.product_purchase_lot import ProductPurchaseLot


def run(dry_run: bool = False, force: bool = False):
    with Session(engine) as session:
        # Check if lots table already has data
        existing_count = session.exec(
            select(ProductPurchaseLot)
        ).all()

        if existing_count and not force:
            print(f"product_purchase_lots already has {len(existing_count)} rows.")
            print("Use --force to delete them and re-run the backfill.")
            return

        if existing_count and force:
            print(f"--force: deleting {len(existing_count)} existing lots...")
            if not dry_run:
                for lot in existing_count:
                    session.delete(lot)
                session.commit()

        # Fetch all delivered orders with items, ordered by delivered_at ASC
        orders = session.exec(
            select(PurchaseOrder)
            .where(PurchaseOrder.status == PurchaseOrderStatus.DELIVERED)
            .where(PurchaseOrder.delivered_at != None)
            .order_by(PurchaseOrder.delivered_at.asc())
        ).all()

        if not orders:
            print("No delivered purchase orders found. Nothing to backfill.")
            return

        print(f"Found {len(orders)} delivered orders. Processing...")

        # Running state per product: (cumulative_stock, current_cmup)
        state: dict[int, tuple[float, float]] = defaultdict(lambda: (0.0, 0.0))

        lots_to_insert: list[ProductPurchaseLot] = []
        skipped = 0

        for order in orders:
            delivered_at = order.delivered_at or datetime.now(timezone.utc)
            # Ensure timezone-aware
            if delivered_at.tzinfo is None:
                delivered_at = delivered_at.replace(tzinfo=timezone.utc)

            for item in order.items:
                # Skip items not linked to a product or with no pricing
                if not item.product_id:
                    skipped += 1
                    continue
                if item.unit_price <= 0 or item.units_per_carton <= 0:
                    skipped += 1
                    continue

                # Use quantity_received if set, otherwise quantity_ordered
                cartons = item.quantity_received if item.quantity_received > 0 else item.quantity_ordered
                units_to_add = float(cartons * item.units_per_carton)
                unit_price_per_unit = item.unit_price / item.units_per_carton

                stock_before, prev_cmup = state[item.product_id]

                # CMUP mobile formula
                if stock_before + units_to_add > 0:
                    new_cmup = (stock_before * prev_cmup + units_to_add * unit_price_per_unit) / (stock_before + units_to_add)
                else:
                    new_cmup = unit_price_per_unit

                new_cmup = round(new_cmup, 4)

                lot = ProductPurchaseLot(
                    product_id=item.product_id,
                    purchase_order_id=order.id,
                    purchase_order_item_id=item.id,
                    stock_before=round(stock_before, 2),
                    quantity_added=units_to_add,
                    quantity_rejected=0,
                    units_per_carton=item.units_per_carton,
                    unit_price_per_carton=item.unit_price,
                    unit_price=round(unit_price_per_unit, 4),
                    cmup=new_cmup,
                    created_at=delivered_at,
                )
                lots_to_insert.append(lot)

                # Update running state (stock grows with each delivery)
                state[item.product_id] = (stock_before + units_to_add, new_cmup)

        print(f"\nResults:")
        print(f"  Lots to insert : {len(lots_to_insert)}")
        print(f"  Items skipped  : {skipped} (no product link or missing price)")
        print(f"  Products touched: {len(state)}")

        if dry_run:
            print("\n[DRY RUN] No changes written. Re-run without --dry-run to apply.")
            # Print a preview of the first 10 lots
            print("\nPreview (first 10 lots):")
            print(f"  {'product_id':>10} {'order_id':>8} {'stock_before':>12} {'qty_added':>9} {'unit_price':>10} {'cmup':>10} {'created_at'}")
            for lot in lots_to_insert[:10]:
                print(f"  {lot.product_id:>10} {lot.purchase_order_id:>8} {lot.stock_before:>12.2f} {lot.quantity_added:>9.0f} {lot.unit_price:>10.4f} {lot.cmup:>10.4f} {lot.created_at}")
        else:
            print("\nInserting lots...")
            for lot in lots_to_insert:
                session.add(lot)
            session.commit()
            print(f"Done. {len(lots_to_insert)} lots inserted.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill product_purchase_lots from historical purchase orders.")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing to DB")
    parser.add_argument("--force", action="store_true", help="Delete existing lots and re-run")
    args = parser.parse_args()

    run(dry_run=args.dry_run, force=args.force)
