from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime, timezone, date


class ProductPurchaseLot(SQLModel, table=True):
    """
    Records a stock lot at each purchase delivery.
    Tracks CMUP mobile, rejected units, and optional expiry date.
    One row per PurchaseOrderItem delivery confirmation.
    """
    __tablename__ = "product_purchase_lots"

    id: Optional[int] = Field(default=None, primary_key=True)

    # References
    product_id: int = Field(foreign_key="products.id", index=True)
    purchase_order_id: int = Field(foreign_key="purchase_orders.id", index=True)
    purchase_order_item_id: int = Field(foreign_key="purchase_order_items.id", index=True)

    # Snapshot at delivery
    stock_before: float = 0           # Units in stock before this delivery
    quantity_added: float = 0         # Units actually added (rejected cartons excluded)
    quantity_rejected: int = 0        # Cartons rejected at delivery
    units_per_carton: int = 1

    # Pricing
    unit_price_per_carton: float = 0  # Purchase price per carton
    unit_price: float = 0             # Purchase price per single unit

    # CMUP mobile — recalculated at each delivery
    cmup: float = 0                   # New CMUP after this lot

    # Optional tracking
    made_date: Optional[date] = None
    expiry_date: Optional[date] = None

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
