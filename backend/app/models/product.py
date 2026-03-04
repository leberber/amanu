from sqlmodel import SQLModel, Field, Relationship, JSON, Column
from typing import Optional, List, Dict, TYPE_CHECKING
from datetime import datetime, timezone
from enum import Enum

if TYPE_CHECKING:
    from app.models.category import Category
    from app.models.brand import Brand
    from app.models.order import OrderItem

class ProductUnit(str, Enum):
    """Unit of measurement for products"""
    KG = "kg"
    GRAM = "gram"
    PIECE = "piece"
    BUNCH = "bunch"
    DOZEN = "dozen"
    POUND = "pound"
    BOX = "box"

class PackagingType(str, Enum):
    """Type of packaging/container for products"""
    BOX = "box"
    CARTON = "carton"
    CRATE = "crate"
    PACK = "pack"
    BAG = "bag"
    BUNDLE = "bundle"

class ProductBase(SQLModel):
    """Base product model with common fields"""
    # Core
    name: str = Field(min_length=1, max_length=100, index=True)
    price: float = Field(ge=0)
    unit: ProductUnit
    pieces_per_box: Optional[int] = Field(default=None, ge=1)
    packaging_type: Optional[PackagingType] = Field(default=PackagingType.CARTON)
    # Inventory
    stock_quantity: int = Field(ge=0)
    is_active: bool = Field(default=True)
    # Relations
    category_id: int = Field(foreign_key="categories.id")
    brand_id: Optional[int] = Field(default=None, foreign_key="brands.id")
    # Details
    description: Optional[str] = Field(default=None)
    name_translations: Optional[Dict[str, str]] = Field(default_factory=dict, sa_column=Column(JSON))
    description_translations: Optional[Dict[str, str]] = Field(default_factory=dict, sa_column=Column(JSON))
    is_organic: bool = Field(default=False)
    image_url: Optional[str] = Field(default=None, max_length=255)

class Product(ProductBase, table=True):
    """Database model for products"""
    __tablename__ = "products"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)
    
    # Relationships
    category: "Category" = Relationship(back_populates="products")
    brand: Optional["Brand"] = Relationship(back_populates="products")
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
    # Core
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    price: Optional[float] = Field(default=None, ge=0)
    unit: Optional[ProductUnit] = None
    pieces_per_box: Optional[int] = Field(default=None, ge=1)
    packaging_type: Optional[PackagingType] = Field(default=None)
    # Inventory
    stock_quantity: Optional[int] = Field(default=None, ge=0)
    is_active: Optional[bool] = Field(default=None)
    # Relations
    category_id: Optional[int] = Field(default=None)
    brand_id: Optional[int] = Field(default=None)
    # Details
    description: Optional[str] = Field(default=None)
    name_translations: Optional[Dict[str, str]] = Field(default=None)
    description_translations: Optional[Dict[str, str]] = Field(default=None)
    is_organic: Optional[bool] = Field(default=None)
    image_url: Optional[str] = Field(default=None, max_length=255)

class ProductPromotion(SQLModel):
    """Promotion info attached to a product"""
    id: int
    name: str
    discount_type: str  # 'percentage' or 'fixed_amount'
    discount_value: float
    discounted_price: float


class ProductRead(ProductBase):
    """Model for reading products"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    promotion: Optional[ProductPromotion] = None  # Active promotion for this product