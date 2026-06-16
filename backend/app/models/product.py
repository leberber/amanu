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
    UNIT = "unit"
    PORTION = "portion"
    SLICE = "slice"
    BOTTLE = "bottle"
    CAN = "can"
    JAR = "jar"
    SACHET = "sachet"
    TRAY = "tray"
    POT = "pot"
    TUBE = "tube"
    LITER = "L"
    MILLILITER = "ml"
    CENTILITER = "cl"
    CARTON = "carton"
    CRATE = "crate"
    PACK = "pack"

class PackagingType(str, Enum):
    """Type of packaging/container for products"""
    BOX = "box"
    CARTON = "carton"
    CRATE = "crate"
    PACK = "pack"
    BAG = "bag"
    BUNDLE = "bundle"
    BOTTLE = "bottle"
    PALETTE = "palette"

class ProductBase(SQLModel):
    """Base product model with common fields"""
    # Core
    name: str = Field(min_length=1, max_length=100, index=True)
    unit: ProductUnit
    pieces_per_box: Optional[int] = Field(default=None, ge=1)
    packaging_type: Optional[PackagingType] = Field(default=PackagingType.CARTON)
    volume: Optional[float] = Field(default=None)  # in liters (L)
    weight: Optional[float] = Field(default=None)  # in kilograms (kg)
    # Pricing
    price: float = Field(ge=0)
    tva_rate: int = Field(default=0)  # TVA rate: 0, 9, or 19
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
    max_order_cartons: Optional[int] = Field(default=None)  # Max cartons a customer can order; null = no limit

class Product(SQLModel, table=True):
    """Database model for products"""
    __tablename__ = "products"

    # ID first
    id: Optional[int] = Field(default=None, primary_key=True)

    # Core
    name: str = Field(min_length=1, max_length=100, index=True)
    unit: ProductUnit = Field(default=ProductUnit.BOX)
    pieces_per_box: Optional[int] = Field(default=None, ge=1)
    packaging_type: Optional[PackagingType] = Field(default=PackagingType.CARTON)
    volume: Optional[float] = Field(default=None)  # in liters (L)
    weight: Optional[float] = Field(default=None)  # in kilograms (kg)

    # Pricing
    price: float = Field(ge=0)
    tva_rate: int = Field(default=0)  # TVA rate: 0, 9, or 19

    # Inventory
    stock_quantity: int = Field(default=0, ge=0)
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
    max_order_cartons: Optional[int] = Field(default=None)  # Max cartons a customer can order; null = no limit

    # Timestamps
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
    unit: Optional[ProductUnit] = None
    pieces_per_box: Optional[int] = Field(default=None, ge=1)
    packaging_type: Optional[PackagingType] = Field(default=None)
    volume: Optional[float] = Field(default=None)  # in liters (L)
    weight: Optional[float] = Field(default=None)  # in kilograms (kg)
    # Pricing
    price: Optional[float] = Field(default=None, ge=0)
    tva_rate: Optional[int] = Field(default=None)
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
    max_order_cartons: Optional[int] = Field(default=None)

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
    group_discount: Optional[float] = None      # Best group discount amount for current user (DA)
    effective_price: Optional[float] = None     # price after group discount