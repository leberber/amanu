from sqlmodel import SQLModel, Field, Relationship, JSON, Column
from typing import Optional, List, Dict, TYPE_CHECKING
from datetime import datetime, timezone

if TYPE_CHECKING:
    from app.models.product import Product

class CategoryBase(SQLModel):
    """Base category model with common fields"""
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
    
    image_url: Optional[str] = Field(default=None, max_length=255)
    is_active: bool = Field(default=True)

class Category(CategoryBase, table=True):
    """Database model for categories"""
    __tablename__ = "categories"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)
    
    # Relationships
    products: List["Product"] = Relationship(back_populates="category", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    
    def get_translated_name(self, language: str = "en") -> str:
        """Get category name in specified language"""
        if self.name_translations and language in self.name_translations:
            return self.name_translations[language]
        return self.name  # Fallback to default name
    
    def get_translated_description(self, language: str = "en") -> Optional[str]:
        """Get category description in specified language"""
        if self.description_translations and language in self.description_translations:
            return self.description_translations[language]
        return self.description  # Fallback to default description

class CategoryCreate(CategoryBase):
    """Model for creating a new category"""
    pass

class CategoryUpdate(SQLModel):
    """Model for updating categories"""
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = Field(default=None)
    name_translations: Optional[Dict[str, str]] = Field(default=None)
    description_translations: Optional[Dict[str, str]] = Field(default=None)
    image_url: Optional[str] = Field(default=None, max_length=255)
    is_active: Optional[bool] = Field(default=None)

class CategoryRead(CategoryBase):
    """Model for reading categories"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None