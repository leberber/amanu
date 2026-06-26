from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, JSON
from typing import Optional, List, Dict, TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.product import Product
    from app.models.user import User


class Segment(SQLModel, table=True):
    """Business segment (e.g. cafeteria, boulangerie, alimentation)"""
    __tablename__ = "segments"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=50, unique=True, index=True)   # e.g. "cafeteria"
    label_fr: str = Field(max_length=100)                       # e.g. "Cafétéria"
    label_translations: Optional[Dict[str, str]] = Field(
        default_factory=dict,
        sa_column=Column(JSON)
    )  # e.g. {"en": "Cafeteria", "ar": "كافيتيريا"}

    product_links: List["ProductSegment"] = Relationship(back_populates="segment")
    user_links: List["UserSegment"] = Relationship(back_populates="segment")


class ProductSegment(SQLModel, table=True):
    """Join table: which segments a product belongs to"""
    __tablename__ = "product_segments"

    product_id: int = Field(foreign_key="products.id", primary_key=True)
    segment_id: int = Field(foreign_key="segments.id", primary_key=True)

    segment: Optional[Segment] = Relationship(back_populates="product_links")


class UserSegment(SQLModel, table=True):
    """Join table: which segments a user (client) belongs to"""
    __tablename__ = "user_segments"

    user_id: int = Field(foreign_key="users.id", primary_key=True)
    segment_id: int = Field(foreign_key="segments.id", primary_key=True)

    segment: Optional[Segment] = Relationship(back_populates="user_links")


class SegmentCreate(SQLModel):
    name: str
    label_fr: str
    label_translations: Optional[Dict[str, str]] = None


class SegmentRead(SQLModel):
    id: int
    name: str
    label_fr: str
    label_translations: Optional[Dict[str, str]] = None

    model_config = {"from_attributes": True}
