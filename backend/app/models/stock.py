from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime, timezone


class StockItemBase(SQLModel):
    """Base stock item model"""
    product_id: int = Field(index=True)
    image: str = Field(default="")
    category: str = Field(default="")
    brand: str = Field(default="")
    product: str = Field(default="")
    description: str = Field(default="")
    supplier: str = Field(default="")
    phone: str = Field(default="")
    package_type: Optional[str] = Field(default="")
    prix_unite: float = Field(default=0)
    unite_par_carton: int = Field(default=1)
    prix_carton: float = Field(default=0)
    nmb_carton: int = Field(default=0)
    carry: bool = Field(default=False)
    priority: int = Field(default=0)
    hidden: bool = Field(default=False)


class StockItem(StockItemBase, table=True):
    """Database model for stock items"""
    __tablename__ = "stock_items"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)


class StockItemCreate(StockItemBase):
    """Model for creating a stock item"""
    pass


class StockItemUpdate(SQLModel):
    """Model for updating a stock item"""
    image: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    product: Optional[str] = None
    description: Optional[str] = None
    supplier: Optional[str] = None
    phone: Optional[str] = None
    package_type: Optional[str] = None
    prix_unite: Optional[float] = None
    unite_par_carton: Optional[int] = None
    prix_carton: Optional[float] = None
    nmb_carton: Optional[int] = None
    carry: Optional[bool] = None
    priority: Optional[int] = None
    hidden: Optional[bool] = None


class StockItemRead(StockItemBase):
    """Model for reading stock items"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
