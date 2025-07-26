from sqlmodel import SQLModel, Field, Relationship, JSON, Column
from typing import Optional, List, Dict, TYPE_CHECKING
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
    
    # Translation fields - store translations as JSON
    name_translations: Optional[Dict[str, str]] = Field(
        default_factory=dict, 
        sa_column=Column(JSON)
    )
    description_translations: Optional[Dict[str, str]] = Field(
        default_factory=dict, 
        sa_column=Column(JSON)
    )
    
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
    
    def get_translated_name(self, language: str = "en") -> str:
        """Get product name in specified language"""
        if self.name_translations and language in self.name_translations:
            return self.name_translations[language]
        return self.name  # Fallback to default name
    
    def get_translated_description(self, language: str = "en") -> Optional[str]:
        """Get product description in specified language"""
        if self.description_translations and language in self.description_translations:
            return self.description_translations[language]
        return self.description  # Fallback to default description

class ProductCreate(ProductBase):
    """Model for creating a new product"""
    pass

class ProductUpdate(SQLModel):
    """Model for updating products"""
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = Field(default=None)
    name_translations: Optional[Dict[str, str]] = Field(default=None)
    description_translations: Optional[Dict[str, str]] = Field(default=None)
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