from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime, timezone
from enum import Enum

if TYPE_CHECKING:
    from app.models.category import Category
    from app.models.order import OrderItem

class ProductUnit(str, Enum):
    """Unit of measurement for products"""
    KG = "kg"
    GRAM = "gram"
    PIECE = "piece"
    BUNCH = "bunch"
    DOZEN = "dozen"
    POUND = "pound"

class ProductBase(SQLModel):
    """Base product model with common fields"""
    name: str = Field(min_length=1, max_length=100, index=True)
    description: Optional[str] = Field(default=None)
    price: float = Field(gt=0)
    unit: ProductUnit
    stock_quantity: int = Field(ge=0)
    image_url: Optional[str] = Field(default=None, max_length=255)
    is_organic: bool = Field(default=False)
    is_active: bool = Field(default=True)
    category_id: int = Field(foreign_key="categories.id")

class Product(ProductBase, table=True):
    """Database model for products"""
    __tablename__ = "products"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)
    
    # Relationships
    category: "Category" = Relationship(back_populates="products")
    order_items: List["OrderItem"] = Relationship(back_populates="product")

class ProductCreate(ProductBase):
    """Model for creating a new product"""
    pass

class ProductUpdate(SQLModel):
    """Model for updating products"""
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = Field(default=None)
    price: Optional[float] = Field(default=None, gt=0)
    unit: Optional[ProductUnit] = None
    stock_quantity: Optional[int] = Field(default=None, ge=0)
    image_url: Optional[str] = Field(default=None, max_length=255)
    is_organic: Optional[bool] = Field(default=None)
    is_active: Optional[bool] = Field(default=None)
    category_id: Optional[int] = Field(default=None)

class ProductRead(ProductBase):
    """Model for reading products"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None