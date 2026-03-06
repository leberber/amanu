from sqlmodel import SQLModel, Field, Relationship, JSON, Column
from typing import Optional, List, Dict, TYPE_CHECKING
from datetime import datetime, timezone
from enum import Enum

if TYPE_CHECKING:
    from app.models.category import Category
    from app.models.brand import Brand
    from app.models.product import Product
    from app.models.user import User
    from app.models.order import Order


class DiscountType(str, Enum):
    """Type of discount"""
    PERCENTAGE = "percentage"
    FIXED_AMOUNT = "fixed_amount"


class PromotionScope(str, Enum):
    """Scope of the promotion"""
    GLOBAL = "global"
    CATEGORY = "category"
    BRAND = "brand"
    PRODUCT = "product"


class PromotionBase(SQLModel):
    """Base promotion model with common fields"""
    name: str = Field(min_length=1, max_length=100, index=True)
    description: Optional[str] = Field(default=None)
    code: Optional[str] = Field(default=None, max_length=50, index=True)

    # Translation fields - store translations as JSON
    name_translations: Optional[Dict[str, str]] = Field(
        default_factory=dict,
        sa_column=Column(JSON)
    )
    description_translations: Optional[Dict[str, str]] = Field(
        default_factory=dict,
        sa_column=Column(JSON)
    )

    # Discount configuration
    discount_type: DiscountType = Field(default=DiscountType.PERCENTAGE)
    discount_value: float = Field(gt=0, description="Percentage (0-100) or fixed amount")

    # Scope
    scope: PromotionScope = Field(default=PromotionScope.GLOBAL)
    category_id: Optional[int] = Field(default=None, foreign_key="categories.id")
    brand_id: Optional[int] = Field(default=None, foreign_key="brands.id")
    product_id: Optional[int] = Field(default=None, foreign_key="products.id")

    # Conditions
    min_order_amount: float = Field(default=0, ge=0)
    max_discount: Optional[float] = Field(default=None, ge=0)
    usage_limit: Optional[int] = Field(default=None, ge=0)

    # Validity
    start_date: datetime
    end_date: datetime
    is_active: bool = Field(default=True)


class Promotion(PromotionBase, table=True):
    """Database model for promotions"""
    __tablename__ = "promotions"
    id: Optional[int] = Field(default=None, primary_key=True)
    usage_count: int = Field(default=0)
    created_by: Optional[int] = Field(default=None, foreign_key="users.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)

    # Relationships
    category: Optional["Category"] = Relationship()
    brand: Optional["Brand"] = Relationship()
    product: Optional["Product"] = Relationship()
    creator: Optional["User"] = Relationship()
    usages: List["PromotionUsage"] = Relationship(back_populates="promotion")

    def get_translated_name(self, language: str = "en") -> str:
        """Get promotion name in specified language"""
        if self.name_translations and language in self.name_translations:
            return self.name_translations[language]
        return self.name

    def get_translated_description(self, language: str = "en") -> Optional[str]:
        """Get promotion description in specified language"""
        if self.description_translations and language in self.description_translations:
            return self.description_translations[language]
        return self.description

    def is_valid(self) -> bool:
        """Check if promotion is currently valid"""
        now = datetime.utcnow()
        # Handle both timezone-aware and naive datetimes from DB
        start = self.start_date.replace(tzinfo=None) if self.start_date.tzinfo else self.start_date
        end = self.end_date.replace(tzinfo=None) if self.end_date.tzinfo else self.end_date
        return (
            self.is_active and
            start <= now <= end and
            (self.usage_limit is None or self.usage_count < self.usage_limit)
        )

    def calculate_discount(self, amount: float) -> float:
        """Calculate discount for a given amount"""
        if self.discount_type == DiscountType.PERCENTAGE:
            discount = amount * (self.discount_value / 100)
        else:
            discount = self.discount_value

        # Apply max discount cap if set
        if self.max_discount is not None:
            discount = min(discount, self.max_discount)

        # Discount cannot exceed the amount
        return min(discount, amount)


class PromotionUsage(SQLModel, table=True):
    """Track promotion usage per order"""
    __tablename__ = "promotion_usages"
    id: Optional[int] = Field(default=None, primary_key=True)
    promotion_id: int = Field(foreign_key="promotions.id")
    order_id: int = Field(foreign_key="orders.id")
    user_id: int = Field(foreign_key="users.id")
    discount_applied: float = Field(gt=0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Relationships
    promotion: Promotion = Relationship(back_populates="usages")


class PromotionCreate(SQLModel):
    """Model for creating a new promotion"""
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = None
    code: Optional[str] = Field(default=None, max_length=50)

    name_translations: Optional[Dict[str, str]] = None
    description_translations: Optional[Dict[str, str]] = None

    discount_type: DiscountType = DiscountType.PERCENTAGE
    discount_value: float = Field(gt=0)

    scope: PromotionScope = PromotionScope.GLOBAL
    category_id: Optional[int] = None
    brand_id: Optional[int] = None
    product_id: Optional[int] = None

    min_order_amount: float = Field(default=0, ge=0)
    max_discount: Optional[float] = Field(default=None, ge=0)
    usage_limit: Optional[int] = Field(default=None, ge=0)

    start_date: datetime
    end_date: datetime
    is_active: bool = True


class PromotionUpdate(SQLModel):
    """Model for updating promotions"""
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = None
    code: Optional[str] = Field(default=None, max_length=50)

    name_translations: Optional[Dict[str, str]] = None
    description_translations: Optional[Dict[str, str]] = None

    discount_type: Optional[DiscountType] = None
    discount_value: Optional[float] = Field(default=None, gt=0)

    scope: Optional[PromotionScope] = None
    category_id: Optional[int] = None
    brand_id: Optional[int] = None
    product_id: Optional[int] = None

    min_order_amount: Optional[float] = Field(default=None, ge=0)
    max_discount: Optional[float] = Field(default=None, ge=0)
    usage_limit: Optional[int] = Field(default=None, ge=0)

    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_active: Optional[bool] = None


class PromotionRead(PromotionBase):
    """Model for reading promotions"""
    id: int
    usage_count: int
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    # Entity names for display
    category_name: Optional[str] = None
    brand_name: Optional[str] = None
    product_name: Optional[str] = None
    # Entity images for display
    category_image: Optional[str] = None
    brand_image: Optional[str] = None
    product_image: Optional[str] = None


class PromotionValidation(SQLModel):
    """Response model for promo code validation"""
    valid: bool
    promotion: Optional[PromotionRead] = None
    error: Optional[str] = None


class CartItem(SQLModel):
    """Cart item for discount calculation"""
    product_id: int
    quantity: float = Field(gt=0)
    unit_price: float = Field(gt=0)
    category_id: Optional[int] = None
    brand_id: Optional[int] = None


class DiscountCalculationRequest(SQLModel):
    """Request model for calculating discount"""
    promotion_code: str
    cart_items: List[CartItem]


class DiscountCalculationResponse(SQLModel):
    """Response model for discount calculation"""
    subtotal: float
    discount_amount: float
    total: float
    promotion: Optional[PromotionRead] = None
    error: Optional[str] = None


class AutoApplyRequest(SQLModel):
    """Request model for auto-applying best promotions"""
    cart_items: List[CartItem]


class AppliedPromotionItem(SQLModel):
    """A single applied promotion with its discount"""
    promotion_id: int
    promotion_name: str
    discount_type: DiscountType
    discount_value: float
    scope: PromotionScope
    discount_amount: float


class AutoApplyResponse(SQLModel):
    """Response model for auto-applied promotions"""
    subtotal: float
    total_discount: float
    final_total: float
    applied_promotions: List[AppliedPromotionItem] = []
    best_promotion: Optional[PromotionRead] = None
    best_discount_amount: float = 0
