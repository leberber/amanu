from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime, timezone
from enum import Enum


class GroupDiscountType(str, Enum):
    FIXED = "fixed"           # Fixed amount off per unit (DA)
    PERCENTAGE = "percentage"  # Percentage off


class ProductGroupPrice(SQLModel, table=True):
    __tablename__ = "product_group_prices"

    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: int = Field(foreign_key="products.id", index=True)
    group_id: int = Field(foreign_key="user_groups.id", index=True)
    discount_type: GroupDiscountType = Field(default=GroupDiscountType.FIXED)
    discount_value: float = Field(ge=0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProductGroupPriceRead(SQLModel):
    id: int
    product_id: int
    group_id: int
    discount_type: GroupDiscountType
    discount_value: float
    group_name: Optional[str] = None
    group_color: Optional[str] = None


class ProductGroupPriceUpsert(SQLModel):
    group_id: int
    discount_type: GroupDiscountType
    discount_value: float = Field(ge=0)
