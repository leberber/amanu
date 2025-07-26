# backend/app/api/api_v1/endpoints/products.py
from typing import Any, List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, or_

from app.database import get_session
from app.models.product import Product, ProductCreate, ProductUpdate, ProductRead
from app.models.category import Category
from app.core.security import get_current_staff_user, get_current_active_user
from app.core.translation import TranslationService
from app.models.user import User

router = APIRouter()

@router.post("", response_model=ProductRead)
def create_product(
    product_in: ProductCreate,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Create new product (staff only).
    """
    # Check if category exists
    category = session.get(Category, product_in.category_id)
    if not category:
        raise HTTPException(
            status_code=404,
            detail="Category not found",
        )
    
    product = Product.model_validate(product_in)
    session.add(product)
    session.commit()
    session.refresh(product)
    return product

@router.get("", response_model=List[ProductRead])
def read_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    category_id: Optional[int] = None,
    is_organic: Optional[bool] = None,
    active_only: bool = Query(True),
    search: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort_by: str = Query("name", enum=["name", "price", "created_at"]),
    sort_order: str = Query("asc", enum=["asc", "desc"]),
    lang: str = Query("en", description="Language for translations (en, fr, ar)"),
    session: Session = Depends(get_session),
) -> Any:
    """
    Retrieve products with various filters and translation support.
    """
    query = select(Product)
    
    # Apply filters
    if category_id:
        query = query.where(Product.category_id == category_id)
    
    if is_organic is not None:
        query = query.where(Product.is_organic == is_organic)
    
    if active_only:
        query = query.where(Product.is_active == True)
    
    if min_price is not None:
        query = query.where(Product.price >= min_price)
    
    if max_price is not None:
        query = query.where(Product.price <= max_price)
    
    if search:
        # Search in both default fields and translations
        search_conditions = [
            Product.name.ilike(f"%{search}%"),
            Product.description.ilike(f"%{search}%")
        ]
        
        # Add translation-based search for better multilingual support
        # Note: SQLite JSON search is limited, this is a basic implementation
        search_conditions.extend([
            Product.name_translations.ilike(f"%{search}%"),
            Product.description_translations.ilike(f"%{search}%")
        ])
        
        query = query.where(or_(*search_conditions))
    
    # Apply sorting
    if sort_by == "name":
        query = query.order_by(Product.name.desc() if sort_order == "desc" else Product.name)
    elif sort_by == "price":
        query = query.order_by(Product.price.desc() if sort_order == "desc" else Product.price)
    elif sort_by == "created_at":
        query = query.order_by(Product.created_at.desc() if sort_order == "desc" else Product.created_at)
    
    # Apply pagination
    products = session.exec(query.offset(skip).limit(limit)).all()
    
    # Apply translations to each product
    for product in products:
        TranslationService.apply_translations_to_model(product, lang)
    
    return products

@router.get("/{product_id}", response_model=ProductRead)
def read_product(
    product_id: int,
    lang: str = Query("en", description="Language for translations (en, fr, ar)"),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get product by ID with translation support.
    """
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(
            status_code=404,
            detail="Product not found",
        )
    
    # Apply translations
    TranslationService.apply_translations_to_model(product, lang)
    
    return product

@router.patch("/{product_id}", response_model=ProductRead)
def update_product(
    product_id: int,
    product_in: ProductUpdate,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Update a product (staff only).
    """
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(
            status_code=404,
            detail="Product not found",
        )
    
    # Check if category exists if being updated
    if product_in.category_id is not None:
        category = session.get(Category, product_in.category_id)
        if not category:
            raise HTTPException(
                status_code=404,
                detail="Category not found",
            )
    
    # Update fields
    update_data = product_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)
    
    product.updated_at = datetime.now(timezone.utc)
    
    session.add(product)
    session.commit()
    session.refresh(product)
    return product

@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Delete a product (staff only).
    """
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(
            status_code=404,
            detail="Product not found",
        )
    
    # Check if product has related orders
    if product.order_items:
        # Instead of deleting, mark as inactive
        product.is_active = False
        product.updated_at = datetime.now(timezone.utc)
        session.add(product)
        session.commit()
    else:
        # Delete product if no related records
        session.delete(product)
        session.commit()
    
    return None

@router.get("/category/{category_id}", response_model=List[ProductRead])
def read_products_by_category(
    category_id: int,
    active_only: bool = Query(True),
    lang: str = Query("en", description="Language for translations (en, fr, ar)"),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get all products in a specific category with translation support.
    """
    # Check if category exists
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(
            status_code=404,
            detail="Category not found",
        )
    
    # Build query
    query = select(Product).where(Product.category_id == category_id)
    
    if active_only:
        query = query.where(Product.is_active == True)
    
    products = session.exec(query).all()
    
    # Apply translations to each product
    for product in products:
        TranslationService.apply_translations_to_model(product, lang)
    
    return products