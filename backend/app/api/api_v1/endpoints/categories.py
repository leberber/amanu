# backend/app/api/api_v1/endpoints/categories.py
from typing import Any, List
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.database import get_session
from app.models.category import Category, CategoryCreate, CategoryUpdate, CategoryRead
from app.core.security import get_current_staff_user, get_current_active_user
from app.core.translation import TranslationService
from app.models.user import User

router = APIRouter()

@router.post("", response_model=CategoryRead)
def create_category(
    category_in: CategoryCreate,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Create new category (staff only).
    """
    # Check if category already exists
    existing = session.exec(
        select(Category).where(Category.name == category_in.name)
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Category with this name already exists",
        )
    
    category = Category.model_validate(category_in)
    session.add(category)
    session.commit()
    session.refresh(category)
    return category

@router.get("", response_model=List[CategoryRead])
def read_categories(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    active_only: bool = Query(False),
    lang: str = Query("en", description="Language for translations (en, fr, ar)"),
    session: Session = Depends(get_session),
) -> Any:
    """
    Retrieve categories with translation support.
    """
    query = select(Category)
    
    if active_only:
        query = query.where(Category.is_active == True)
    
    categories = session.exec(query.offset(skip).limit(limit)).all()
    
    # Apply translations to each category
    for category in categories:
        TranslationService.apply_translations_to_model(category, lang)
    
    return categories

@router.get("/{category_id}", response_model=CategoryRead)
def read_category(
    category_id: int,
    lang: str = Query("en", description="Language for translations (en, fr, ar)"),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get category by ID with translation support.
    """
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(
            status_code=404,
            detail="Category not found",
        )
    
    # Apply translations
    TranslationService.apply_translations_to_model(category, lang)
    
    return category

@router.patch("/{category_id}", response_model=CategoryRead)
def update_category(
    category_id: int,
    category_in: CategoryUpdate,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Update a category (staff only).
    """
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(
            status_code=404,
            detail="Category not found",
        )
    
    # Check if name is being changed and already exists
    if category_in.name is not None and category_in.name != category.name:
        existing = session.exec(
            select(Category).where(Category.name == category_in.name)
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Category with this name already exists",
            )
    
    # Update fields
    update_data = category_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(category, field, value)
    
    category.updated_at = datetime.now(timezone.utc)
    
    session.add(category)
    session.commit()
    session.refresh(category)
    return category

@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> None:
    """
    Delete a category (staff only).
    """
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(
            status_code=404,
            detail="Category not found",
        )
    
    # Check if category has products
    if category.products:
        # Instead of deleting, mark as inactive
        category.is_active = False
        category.updated_at = datetime.now(timezone.utc)
        session.add(category)
        session.commit()
    else:
        # Delete category if it has no products
        session.delete(category)
        session.commit()
    
    return None