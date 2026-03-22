# backend/app/api/api_v1/endpoints/products.py
from typing import Any, List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlmodel import Session, select, or_, func
from sqlalchemy import Text

from app.database import get_session
from app.models.product import Product, ProductCreate, ProductUpdate, ProductRead, ProductPromotion
from app.models.category import Category
from app.models.promotion import Promotion, PromotionScope
from app.models.restock import RestockItem
from app.core.security import get_current_staff_user, get_current_active_user
from app.core.translation import TranslationService
from app.models.user import User
from app.services.s3 import S3Service

router = APIRouter()


class PaginatedProductsResponse(BaseModel):
    """Paginated response with total counts for admin panel"""
    items: List[ProductRead]
    total: int
    active_count: int
    inactive_count: int
    skip: int
    limit: int


def get_active_promotions(session: Session) -> List[Promotion]:
    """Get all currently active promotions"""
    now = datetime.utcnow()
    query = select(Promotion).where(
        Promotion.is_active == True,
        Promotion.start_date <= now,
        Promotion.end_date >= now
    )
    return list(session.exec(query).all())


def get_best_promotion_for_product(
    product: Product,
    promotions: List[Promotion]
) -> Optional[ProductPromotion]:
    """Find the best (highest discount) promotion applicable to a product"""
    applicable_promotions = []

    for promo in promotions:
        # Check if promotion applies to this product
        applies = False

        if promo.scope == PromotionScope.GLOBAL:
            applies = True
        elif promo.scope == PromotionScope.CATEGORY and promo.category_id == product.category_id:
            applies = True
        elif promo.scope == PromotionScope.BRAND and promo.brand_id == product.brand_id:
            applies = True
        elif promo.scope == PromotionScope.PRODUCT and promo.product_id == product.id:
            applies = True

        if applies and promo.is_valid():
            # Calculate discount for this product
            discount_amount = promo.calculate_discount(product.price)
            discounted_price = product.price - discount_amount
            applicable_promotions.append({
                'promotion': promo,
                'discount_amount': discount_amount,
                'discounted_price': discounted_price
            })

    if not applicable_promotions:
        return None

    # Return the promotion with the highest discount
    best = max(applicable_promotions, key=lambda x: x['discount_amount'])
    promo = best['promotion']

    return ProductPromotion(
        id=promo.id,
        name=promo.name,
        discount_type=promo.discount_type.value,
        discount_value=promo.discount_value,
        discounted_price=round(best['discounted_price'], 2)
    )


def enrich_products_with_promotions(
    products: List[Product],
    session: Session
) -> List[dict]:
    """Add promotion info to products"""
    promotions = get_active_promotions(session)
    result = []

    for product in products:
        product_data = ProductRead.model_validate(product).model_dump()
        product_data['promotion'] = get_best_promotion_for_product(product, promotions)
        result.append(product_data)

    return result


@router.post("", response_model=ProductRead)
def create_product(
    product_in: ProductCreate,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Create new product (staff only).
    Also creates a linked RestockItem so the product appears in the purchasing page.
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
    session.flush()  # Get product ID before creating RestockItem

    # Auto-create RestockItem so product appears in purchasing page
    restock_item = RestockItem(
        product_id=product.id,
        supplier="",
        phone="",
        prix_unite_achat=0,
        unite_par_carton=product.pieces_per_box or 1,
        prix_carton=0,
        nmb_carton=0,
        carry=False,
        priority=0,
        hidden=not product.is_active,
        created_at=datetime.now(timezone.utc)
    )
    session.add(restock_item)

    session.commit()
    session.refresh(product)
    return product

@router.get("", response_model=List[ProductRead])
def read_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    category_id: Optional[int] = None,
    brand_id: Optional[int] = None,
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

    if brand_id:
        query = query.where(Product.brand_id == brand_id)
    
    if is_organic is not None:
        query = query.where(Product.is_organic == is_organic)
    
    if active_only:
        query = query.where(Product.is_active == True)
    
    if min_price is not None:
        query = query.where(Product.price >= min_price)
    
    if max_price is not None:
        query = query.where(Product.price <= max_price)
    
    if search:
        # Search in basic text fields (default language)
        search_conditions = [
            Product.name.ilike(f"%{search}%"),
            Product.description.ilike(f"%{search}%")
        ]
        
        # Search in translations for the current language
        if lang and lang in TranslationService.SUPPORTED_LANGUAGES:
            # PostgreSQL JSON extraction: Search in specific language translations
            search_conditions.extend([
                func.coalesce(
                    func.json_extract_path_text(Product.name_translations, lang),
                    Product.name
                ).ilike(f"%{search}%"),
                func.coalesce(
                    func.json_extract_path_text(Product.description_translations, lang),
                    Product.description
                ).ilike(f"%{search}%")
            ])
        else:
            # Fallback: Search in all translations (convert entire JSON to text)
            search_conditions.extend([
                func.cast(Product.name_translations, Text).ilike(f"%{search}%"),
                func.cast(Product.description_translations, Text).ilike(f"%{search}%")
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

    # Enrich products with promotion info
    return enrich_products_with_promotions(products, session)


@router.get("/admin/paginated", response_model=PaginatedProductsResponse)
def read_products_paginated(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    category_id: Optional[int] = None,
    brand_id: Optional[int] = None,
    status_filter: str = Query("all", enum=["all", "active", "inactive"]),
    search: Optional[str] = None,
    lang: str = Query("en", description="Language for translations (en, fr, ar)"),
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Admin endpoint: Get paginated products with total counts.
    Returns items, total count, active count, and inactive count.
    """
    # Base query for filtering
    base_query = select(Product)

    # Apply filters
    if category_id:
        base_query = base_query.where(Product.category_id == category_id)

    if brand_id:
        base_query = base_query.where(Product.brand_id == brand_id)

    if search:
        search_conditions = [
            Product.name.ilike(f"%{search}%"),
            Product.description.ilike(f"%{search}%")
        ]
        if lang and lang in TranslationService.SUPPORTED_LANGUAGES:
            search_conditions.extend([
                func.coalesce(
                    func.json_extract_path_text(Product.name_translations, lang),
                    Product.name
                ).ilike(f"%{search}%"),
            ])
        base_query = base_query.where(or_(*search_conditions))

    # Get total counts (before status filter)
    count_query = select(func.count()).select_from(base_query.subquery())
    total = session.exec(count_query).one()

    # Count active/inactive
    active_query = select(func.count()).select_from(
        base_query.where(Product.is_active == True).subquery()
    )
    active_count = session.exec(active_query).one()
    inactive_count = total - active_count

    # Apply status filter for actual results
    if status_filter == "active":
        base_query = base_query.where(Product.is_active == True)
    elif status_filter == "inactive":
        base_query = base_query.where(Product.is_active == False)

    # Get filtered total for pagination
    filtered_count_query = select(func.count()).select_from(base_query.subquery())
    filtered_total = session.exec(filtered_count_query).one()

    # Apply sorting (newest first) and pagination
    query = base_query.order_by(Product.created_at.desc()).offset(skip).limit(limit)
    products = session.exec(query).all()

    # Apply translations
    for product in products:
        TranslationService.apply_translations_to_model(product, lang)

    # Enrich with promotions
    enriched = enrich_products_with_promotions(products, session)

    return PaginatedProductsResponse(
        items=enriched,
        total=filtered_total,
        active_count=active_count,
        inactive_count=inactive_count,
        skip=skip,
        limit=limit
    )


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

    # Add promotion info
    promotions = get_active_promotions(session)
    product_data = ProductRead.model_validate(product).model_dump()
    product_data['promotion'] = get_best_promotion_for_product(product, promotions)

    return product_data

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
    Also deletes the linked RestockItem.
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

        # Also mark RestockItem as hidden
        restock_item = session.exec(
            select(RestockItem).where(RestockItem.product_id == product_id)
        ).first()
        if restock_item:
            restock_item.hidden = True
            restock_item.updated_at = datetime.now(timezone.utc)
            session.add(restock_item)

        session.commit()
    else:
        # Delete RestockItem first (foreign key constraint)
        restock_item = session.exec(
            select(RestockItem).where(RestockItem.product_id == product_id)
        ).first()
        if restock_item:
            session.delete(restock_item)

        # Delete product
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

    # Enrich products with promotion info
    return enrich_products_with_promotions(products, session)


@router.post("/upload-image", response_model=dict)
async def upload_product_image(
    file: UploadFile = File(...),
    brand: str = Form(...),
    name: str = Form(...),
    current_user: User = Depends(get_current_staff_user),
):
    """Upload product image to S3 and return the URL.

    This endpoint is used by the admin add/edit product page.
    It uploads the image and returns the URL without requiring a product_id.
    """
    allowed_types = {'image/jpeg', 'image/png', 'image/webp', 'image/gif'}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}"
        )

    image_data = await file.read()

    if len(image_data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max size: 10MB")

    success, result, key = S3Service.upload_image(
        image_data=image_data,
        brand=brand,
        product=name
    )

    if not success:
        raise HTTPException(status_code=500, detail=result)

    return {
        "success": True,
        "url": result,
        "key": key
    }