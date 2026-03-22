from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, TYPE_CHECKING
from datetime import datetime, timezone

if TYPE_CHECKING:
    from app.models.product import Product


class RestockItemBase(SQLModel):
    """Base restock item model - purchasing data only.

    Product data (name, brand, category, image, etc.) is stored in the Products table.
    This table only stores purchasing/supplier information.
    """
    # Link to product (required - all restock items must have a product)
    product_id: int = Field(foreign_key="products.id", index=True)
    # Supplier info
    supplier: str = Field(default="")
    phone: str = Field(default="")
    # Pricing
    prix_unite_achat: float = Field(default=0)  # Purchase price per unit
    unite_par_carton: int = Field(default=1)
    prix_carton: float = Field(default=0)
    nmb_carton: int = Field(default=0)
    # Flags
    carry: bool = Field(default=False)
    priority: int = Field(default=0)
    hidden: bool = Field(default=False)


class RestockItem(RestockItemBase, table=True):
    """Database model for restock items - purchasing data only"""
    __tablename__ = "restock_items"
    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: int = Field(foreign_key="products.id", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)

    # Relationship to product
    product: Optional["Product"] = Relationship()


class RestockItemCreate(RestockItemBase):
    """Model for creating a restock item"""
    pass


class RestockItemUpdate(SQLModel):
    """Model for updating a restock item"""
    product_id: Optional[int] = None
    supplier: Optional[str] = None
    phone: Optional[str] = None
    prix_unite_achat: Optional[float] = None
    unite_par_carton: Optional[int] = None
    prix_carton: Optional[float] = None
    nmb_carton: Optional[int] = None
    carry: Optional[bool] = None
    priority: Optional[int] = None
    hidden: Optional[bool] = None


class RestockItemRead(RestockItemBase):
    """Model for reading restock items with joined product data"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
