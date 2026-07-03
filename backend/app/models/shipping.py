"""
Shipping cost models for delivery zone and pricing configuration
"""
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON
from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel


class ShippingDiscountTier(BaseModel):
    """A single discount tier"""
    min_order: float  # Minimum order total to qualify
    discount_percent: float  # Discount percentage (0-100)


class H3DeliveryZone(SQLModel, table=True):
    """
    Read-only model for pre-computed delivery zones.
    This table is populated by external ETL process.
    """
    __tablename__ = "h3_delivery_zones"

    idx: Optional[int] = Field(default=None, primary_key=True)
    warehouse_id: str = Field(index=True)
    h3_index: str = Field(index=True)
    distance_km: float
    duration_min: float


class ShippingPriceConfig(SQLModel, table=True):
    """
    Admin-configurable pricing parameters for shipping cost calculation.
    One config per warehouse (or a default config with warehouse_id = 'default').
    """
    __tablename__ = "shipping_price_configs"

    id: Optional[int] = Field(default=None, primary_key=True)
    warehouse_id: str = Field(unique=True, index=True, description="Warehouse ID or 'default'")

    # Base cost (fixed fee)
    base_cost: float = Field(default=200.0, description="Base delivery fee in DZD")

    # Distance-based pricing
    price_per_km: float = Field(default=30.0, description="Price per kilometer in DZD")

    # Weight-based pricing
    price_per_kg: float = Field(default=10.0, description="Price per kilogram in DZD")

    # Volume-based pricing
    price_per_m3: float = Field(default=500.0, description="Price per cubic meter in DZD")

    # Time-based pricing (for express delivery consideration)
    price_per_min: float = Field(default=0.0, description="Price per minute of travel in DZD")

    # Minimum and maximum shipping cost
    min_shipping_cost: float = Field(default=200.0, description="Minimum shipping cost in DZD")
    max_shipping_cost: float = Field(default=5000.0, description="Maximum shipping cost in DZD")

    # Tiered shipping discounts based on order total
    # Example: [{"min_order": 5000, "discount_percent": 50}, {"min_order": 10000, "discount_percent": 70}]
    shipping_discount_tiers: Optional[List[dict]] = Field(
        default=None,
        sa_column=Column(JSON),
        description="List of discount tiers: [{min_order, discount_percent}]"
    )

    # Standard delivery discount (applied when order is batched)
    standard_delivery_discount_percent: float = Field(
        default=30.0,
        description="Discount percentage applied to standard (batched) delivery vs priority (0-100)"
    )

    # Driver commission (percentage of shipping cost that goes to driver)
    driver_commission_percent: float = Field(
        default=100.0,
        description="Percentage of shipping cost paid to driver (0-100)"
    )

    # Active status
    is_active: bool = Field(default=True)

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)


class ShippingPriceConfigCreate(SQLModel):
    """Model for creating shipping price config"""
    warehouse_id: str
    base_cost: float = 200.0
    price_per_km: float = 30.0
    price_per_kg: float = 10.0
    price_per_m3: float = 500.0
    price_per_min: float = 0.0
    min_shipping_cost: float = 200.0
    max_shipping_cost: float = 5000.0
    shipping_discount_tiers: Optional[List[dict]] = None
    standard_delivery_discount_percent: float = 30.0
    driver_commission_percent: float = 100.0


class ShippingPriceConfigUpdate(SQLModel):
    """Model for updating shipping price config"""
    base_cost: Optional[float] = None
    price_per_km: Optional[float] = None
    price_per_kg: Optional[float] = None
    price_per_m3: Optional[float] = None
    price_per_min: Optional[float] = None
    min_shipping_cost: Optional[float] = None
    max_shipping_cost: Optional[float] = None
    shipping_discount_tiers: Optional[List[dict]] = None
    standard_delivery_discount_percent: Optional[float] = None
    driver_commission_percent: Optional[float] = None
    is_active: Optional[bool] = None


class ShippingPriceConfigRead(SQLModel):
    """Model for reading shipping price config"""
    id: int
    warehouse_id: str
    base_cost: float
    price_per_km: float
    price_per_kg: float
    price_per_m3: float
    price_per_min: float
    min_shipping_cost: float
    max_shipping_cost: float
    shipping_discount_tiers: Optional[List[dict]] = None
    standard_delivery_discount_percent: float
    driver_commission_percent: float
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]


# Request/Response models for shipping calculation
class ShippingCostRequest(BaseModel):
    """Request model for calculating shipping cost"""
    user_id: int  # Customer's user ID (used to look up their saved route)
    weight_kg: float = 0.0  # Total weight of order
    volume_m3: float = 0.0  # Total volume of order
    order_total: float = 0.0  # Order subtotal (for free shipping check)


class DeliveryPricing(BaseModel):
    """Pricing for a specific delivery type"""
    cost: float
    original_cost: float
    discount_percent: float = 0.0
    description: str = ""


class ShippingCostResponse(BaseModel):
    """Response model for shipping cost calculation"""
    deliverable: bool
    shipping_cost: float  # Final cost after discount (priority price for backwards compat)
    original_cost: float  # Cost before discount
    distance_km: float
    duration_min: float
    discount_applied: bool
    discount_percent: float  # 0-100
    free_shipping: bool  # True if discount is 100%
    breakdown: dict  # Detailed cost breakdown
    next_tier: Optional[dict] = None  # Info about next discount tier
    message: Optional[str] = None

    # New: Delivery type pricing
    priority_price: Optional[DeliveryPricing] = None  # Immediate dedicated delivery
    standard_price: Optional[DeliveryPricing] = None  # Batchable, discounted
