from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime, timezone

if TYPE_CHECKING:
    from app.models.user import User


class UserGroupLink(SQLModel, table=True):
    """Junction table for User-UserGroup many-to-many relationship"""
    __tablename__ = "user_group_links"

    user_id: int = Field(foreign_key="users.id", primary_key=True)
    group_id: int = Field(foreign_key="user_groups.id", primary_key=True)
    added_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserGroupBase(SQLModel):
    """Base model for user groups"""
    name: str = Field(max_length=50, unique=True, index=True)
    description: Optional[str] = Field(default=None, max_length=200)
    color: Optional[str] = Field(default="#3b82f6", max_length=20)  # Hex color for UI
    is_active: bool = Field(default=True)


class UserGroup(UserGroupBase, table=True):
    """Database model for user groups/segments"""
    __tablename__ = "user_groups"

    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)

    # Relationships
    users: List["User"] = Relationship(
        back_populates="groups",
        link_model=UserGroupLink
    )


class UserGroupCreate(UserGroupBase):
    """Model for creating a user group"""
    pass


class UserGroupUpdate(SQLModel):
    """Model for updating a user group"""
    name: Optional[str] = Field(default=None, max_length=50)
    description: Optional[str] = Field(default=None, max_length=200)
    color: Optional[str] = Field(default=None, max_length=20)
    is_active: Optional[bool] = Field(default=None)


class UserGroupRead(UserGroupBase):
    """Model for reading user groups"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    user_count: Optional[int] = None  # Computed field for number of users in group
