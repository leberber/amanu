from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, TYPE_CHECKING
from datetime import datetime, timezone
from enum import Enum

if TYPE_CHECKING:
    from app.models.product import Product


class VolumeDiscountType(str, Enum):
    """Type of volume discount"""
    PERCENTAGE = "percentage"
    FIXED_AMOUNT = "fixed_amount"
    FREE_UNITS = "free_units"


class VolumeDiscountBase(SQLModel):
    """Base volume discount model"""
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = Field(default=None)

    # Product this discount applies to
    product_id: int = Field(foreign_key="products.id")

    # Minimum quantity (in cartons) to qualify
    min_quantity: int = Field(gt=0, description="Minimum cartons to qualify")

    # Discount configuration
    discount_type: VolumeDiscountType = Field(default=VolumeDiscountType.PERCENTAGE)
    discount_value: float = Field(gt=0, description="Percentage (0-100), fixed amount, or free units count")

    # Validity
    start_date: datetime
    end_date: datetime
    is_active: bool = Field(default=True)


class VolumeDiscount(VolumeDiscountBase, table=True):
    """Database model for volume discounts"""
    __tablename__ = "volume_discounts"

    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)

    # Relationships
    product: Optional["Product"] = Relationship()

    def is_valid(self) -> bool:
        """Check if discount is currently valid"""
        now = datetime.now(timezone.utc)
        start = self.start_date.replace(tzinfo=None) if self.start_date.tzinfo else self.start_date
        end = self.end_date.replace(tzinfo=None) if self.end_date.tzinfo else self.end_date
        return self.is_active and start <= now <= end


class VolumeDiscountCreate(SQLModel):
    """Model for creating a volume discount"""
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = None
    product_id: int
    min_quantity: int = Field(gt=0)
    discount_type: VolumeDiscountType = VolumeDiscountType.PERCENTAGE
    discount_value: float = Field(gt=0)
    start_date: datetime
    end_date: datetime
    is_active: bool = True


class VolumeDiscountUpdate(SQLModel):
    """Model for updating a volume discount"""
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = None
    product_id: Optional[int] = None
    min_quantity: Optional[int] = Field(default=None, gt=0)
    discount_type: Optional[VolumeDiscountType] = None
    discount_value: Optional[float] = Field(default=None, gt=0)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_active: Optional[bool] = None


class VolumeDiscountRead(VolumeDiscountBase):
    """Model for reading volume discounts"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    # Product info for display
    product_name: Optional[str] = None
    product_image: Optional[str] = None
    product_pieces_per_box: Optional[int] = None
    product_packaging_type: Optional[str] = None
