from sqlmodel import SQLModel, Field, Relationship, JSON, Column
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime, timezone

from app.models.promotion import DiscountType

if TYPE_CHECKING:
    from app.models.product import Product


class CrossSellPromotionBase(SQLModel):
    """Base cross-sell promotion model with common fields"""
    name: str = Field(min_length=1, max_length=100, index=True)

    # Target product (the one that gets discounted)
    target_product_id: int = Field(foreign_key="products.id", index=True)

    # Trigger products (buying any of these triggers the discount)
    trigger_product_ids: List[int] = Field(
        default_factory=list,
        sa_column=Column(JSON)
    )

    # Discount configuration
    discount_type: DiscountType = Field(default=DiscountType.FIXED_AMOUNT)
    discount_value: float = Field(gt=0, description="Fixed amount or percentage (0-100)")

    # Minimum quantity of trigger product needed
    min_trigger_quantity: int = Field(default=1, ge=1)

    # Validity
    start_date: Optional[datetime] = Field(default=None)
    end_date: Optional[datetime] = Field(default=None)
    is_active: bool = Field(default=True)


class CrossSellPromotion(CrossSellPromotionBase, table=True):
    """Database model for cross-sell promotions"""
    __tablename__ = "cross_sell_promotions"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)

    # Relationships
    target_product: Optional["Product"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[CrossSellPromotion.target_product_id]"}
    )

    def is_valid(self) -> bool:
        """Check if cross-sell promotion is currently valid"""
        if not self.is_active:
            return False

        now = datetime.utcnow()

        # Check start date
        if self.start_date:
            start = self.start_date.replace(tzinfo=None) if self.start_date.tzinfo else self.start_date
            if now < start:
                return False

        # Check end date
        if self.end_date:
            end = self.end_date.replace(tzinfo=None) if self.end_date.tzinfo else self.end_date
            if now > end:
                return False

        return True

    def calculate_discount(self, original_price: float) -> float:
        """Calculate discount for the target product"""
        if self.discount_type == DiscountType.PERCENTAGE:
            discount = original_price * (self.discount_value / 100)
        else:
            discount = self.discount_value

        # Discount cannot exceed the original price
        return min(discount, original_price)

    def is_triggered_by(self, cart_items: List[dict]) -> bool:
        """
        Check if this promotion is triggered by items in the cart.
        cart_items: List of dicts with 'product_id' and 'quantity' keys
        """
        for item in cart_items:
            if item['product_id'] in self.trigger_product_ids:
                if item['quantity'] >= self.min_trigger_quantity:
                    return True
        return False


class CrossSellPromotionCreate(SQLModel):
    """Model for creating a new cross-sell promotion"""
    name: str = Field(min_length=1, max_length=100)
    target_product_id: int
    trigger_product_ids: List[int] = Field(min_length=1)
    discount_type: DiscountType = DiscountType.FIXED_AMOUNT
    discount_value: float = Field(gt=0)
    min_trigger_quantity: int = Field(default=1, ge=1)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_active: bool = True


class CrossSellPromotionUpdate(SQLModel):
    """Model for updating cross-sell promotions"""
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    target_product_id: Optional[int] = None
    trigger_product_ids: Optional[List[int]] = None
    discount_type: Optional[DiscountType] = None
    discount_value: Optional[float] = Field(default=None, gt=0)
    min_trigger_quantity: Optional[int] = Field(default=None, ge=1)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_active: Optional[bool] = None


class CrossSellPromotionRead(CrossSellPromotionBase):
    """Model for reading cross-sell promotions"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    # For display purposes
    target_product_name: Optional[str] = None
    target_product_image: Optional[str] = None
    target_product_pieces_per_box: Optional[int] = None
    trigger_product_names: Optional[List[str]] = None
    trigger_product_images: Optional[List[str]] = None


# Request/Response models for cart calculation

class CrossSellCartItem(SQLModel):
    """Cart item for cross-sell calculation"""
    product_id: int
    quantity: int = Field(gt=0)
    unit_price: float = Field(gt=0)


class CrossSellCalculationRequest(SQLModel):
    """Request model for calculating cross-sell discounts"""
    cart_items: List[CrossSellCartItem]


class CrossSellDiscountItem(SQLModel):
    """Individual cross-sell discount applied to a product"""
    target_product_id: int
    triggered_by_product_id: int
    promotion_id: int
    promotion_name: str
    discount_per_unit: float
    units_discounted: int = 1  # Always 1 as per requirements
    total_discount: float


class CrossSellCalculationResponse(SQLModel):
    """Response model for cross-sell calculation"""
    cross_sell_discounts: List[CrossSellDiscountItem]
    total_savings: float
