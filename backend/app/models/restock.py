from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, TYPE_CHECKING
from datetime import datetime, timezone

if TYPE_CHECKING:
    from app.models.category import Category
    from app.models.brand import Brand
    from app.models.product import Product


class RestockItemBase(SQLModel):
    """Base restock item model"""
    # Links
    product_id: Optional[int] = Field(default=None, foreign_key="products.id", index=True)
    brand_id: Optional[int] = Field(default=None, foreign_key="brands.id")
    category_id: Optional[int] = Field(default=None, foreign_key="categories.id")
    # Product info
    name: str = Field(default="")
    image: str = Field(default="")
    description: str = Field(default="")
    # Supplier info
    supplier: str = Field(default="")
    phone: str = Field(default="")
    # Pricing
    package_type: str = Field(default="Carton")
    prix_unite_achat: float = Field(default=0)  # Purchase price per unit
    prix_unite_vente: float = Field(default=0)  # Selling price per unit
    unite_par_carton: int = Field(default=1)
    prix_carton: float = Field(default=0)
    nmb_carton: int = Field(default=0)
    # Flags
    carry: bool = Field(default=False)
    priority: int = Field(default=0)
    hidden: bool = Field(default=False)


class RestockItem(RestockItemBase, table=True):
    """Database model for restock items"""
    __tablename__ = "restock_items"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)

    # Relationships
    brand: Optional["Brand"] = Relationship()
    category: Optional["Category"] = Relationship()
    product: Optional["Product"] = Relationship()


class RestockItemCreate(RestockItemBase):
    """Model for creating a restock item"""
    pass


class RestockItemUpdate(SQLModel):
    """Model for updating a restock item"""
    product_id: Optional[int] = None
    brand_id: Optional[int] = None
    category_id: Optional[int] = None
    name: Optional[str] = None
    image: Optional[str] = None
    description: Optional[str] = None
    supplier: Optional[str] = None
    phone: Optional[str] = None
    package_type: Optional[str] = None
    prix_unite_achat: Optional[float] = None
    prix_unite_vente: Optional[float] = None
    unite_par_carton: Optional[int] = None
    prix_carton: Optional[float] = None
    nmb_carton: Optional[int] = None
    carry: Optional[bool] = None
    priority: Optional[int] = None
    hidden: Optional[bool] = None


class RestockItemRead(RestockItemBase):
    """Model for reading restock items with joined data"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    # Joined fields for display
    brand_name: Optional[str] = None
    category_name: Optional[str] = None
    synced: bool = False  # True if product_id is set
