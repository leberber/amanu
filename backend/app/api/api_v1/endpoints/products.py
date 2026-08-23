# backend/app/api/api_v1/endpoints/products.py
from typing import Any, List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlmodel import Session, select, or_, func
from sqlalchemy import Text

from app.database import get_session
from app.models.segment import ProductSegment
from app.models.order import Order, OrderItem, OrderStatus
from app.models.product import Product, ProductCreate, ProductUpdate, ProductRead, ProductPromotion
from app.models.product_group_price import ProductGroupPrice, ProductGroupPriceRead, ProductGroupPriceUpsert, GroupDiscountType
from app.models.facturation import FacturationItem, Facturation
from app.models.category import Category
from app.models.promotion import Promotion, PromotionScope
from app.models.restock import RestockItem
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus
from app.models.user_group import UserGroup, UserGroupLink
from app.core.security import get_current_staff_user, get_current_active_user, get_optional_user
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


class ProductDailySale(BaseModel):
    date: str
    quantity: float
    revenue: float


class ProductCustomerSale(BaseModel):
    customer_id: int
    customer_name: str
    quantity: float
    revenue: float
    order_count: int


class ProductAnalyticsSummary(BaseModel):
    total_units: float
    total_revenue: float
    unique_customers: int
    order_count: int
    avg_quantity_per_order: float


class ProductAnalyticsResponse(BaseModel):
    product_id: int
    product_name: str
    pieces_per_box: Optional[int]
    packaging_type: Optional[str]
    daily_sales: List[ProductDailySale]
    customer_sales: List[ProductCustomerSale]
    summary: ProductAnalyticsSummary


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


def get_best_group_discount(product: Product, user: Optional[User], session: Session) -> Optional[float]:
    """Compute the best group discount (in DA) for a product given the user's groups."""
    if not user:
        return None

    links = session.exec(select(UserGroupLink).where(UserGroupLink.user_id == user.id)).all()
    group_ids = [link.group_id for link in links]
    if not group_ids:
        return None

    group_prices = session.exec(
        select(ProductGroupPrice).where(
            ProductGroupPrice.product_id == product.id,
            ProductGroupPrice.group_id.in_(group_ids)
        )
    ).all()
    if not group_prices:
        return None

    best = 0.0
    for gp in group_prices:
        if gp.discount_type == GroupDiscountType.FIXED:
            discount = gp.discount_value
        else:
            discount = product.price * (gp.discount_value / 100)
        if discount > best:
            best = discount

    return round(best, 2) if best > 0 else None


def get_product_segment_ids(product_id: int, session: Session) -> list:
    """Return list of segment_ids for a product."""
    links = session.exec(
        select(ProductSegment).where(ProductSegment.product_id == product_id)
    ).all()
    return [l.segment_id for l in links]


def set_product_segments(product_id: int, segment_ids: list, session: Session) -> None:
    """Replace all segment links for a product."""
    session.exec(
        select(ProductSegment).where(ProductSegment.product_id == product_id)
    )
    existing = session.exec(
        select(ProductSegment).where(ProductSegment.product_id == product_id)
    ).all()
    for link in existing:
        session.delete(link)
    for sid in segment_ids:
        session.add(ProductSegment(product_id=product_id, segment_id=sid))


def enrich_with_segments(product_data: dict, session: Session) -> dict:
    """Add segment_ids to a product dict."""
    product_data['segment_ids'] = get_product_segment_ids(product_data['id'], session)
    return product_data


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

    # Validate fraction options
    validate_fraction_options(product_in.fraction_options, product_in.pieces_per_box)

    segment_ids = product_in.segment_ids or []
    product_data = product_in.model_dump(exclude={'segment_ids'})
    product = Product(**product_data)
    session.add(product)
    session.flush()  # Get product ID before creating RestockItem

    # Save segment links
    set_product_segments(product.id, segment_ids, session)

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
    product_data = ProductRead.model_validate(product).model_dump()
    product_data['segment_ids'] = segment_ids
    return product_data

@router.get("", response_model=List[ProductRead])
def read_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(1000, ge=1, le=1000),
    category_id: Optional[int] = None,
    brand_id: Optional[int] = None,
    is_organic: Optional[bool] = None,
    active_only: bool = Query(True),
    new_only: bool = Query(False),
    search: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort_by: str = Query("name", enum=["name", "price", "created_at"]),
    sort_order: str = Query("asc", enum=["asc", "desc"]),
    segment_id: Optional[int] = None,
    lang: str = Query("en", description="Language for translations (en, fr, ar)"),
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_optional_user),
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

    if new_only:
        query = query.where(Product.new_until >= datetime.now(timezone.utc))

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
    
    # Filter by segment if provided
    if segment_id is not None:
        product_in_segment = select(ProductSegment.product_id).where(
            ProductSegment.segment_id == segment_id
        )
        query = query.where(Product.id.in_(product_in_segment))

    # Apply pagination
    products = session.exec(query.offset(skip).limit(limit)).all()

    # Apply translations to each product
    for product in products:
        TranslationService.apply_translations_to_model(product, lang)

    # Build segment_ids map for all products in one query
    product_ids = [p.id for p in products]
    seg_links = session.exec(
        select(ProductSegment).where(ProductSegment.product_id.in_(product_ids))
    ).all() if product_ids else []
    seg_map: dict = {}
    for link in seg_links:
        seg_map.setdefault(link.product_id, []).append(link.segment_id)

    # Enrich products with promotion info + group discounts + segments
    enriched = enrich_products_with_promotions(products, session)
    for item in enriched:
        item['segment_ids'] = seg_map.get(item['id'], [])
        if current_user:
            product_obj = next((p for p in products if p.id == item['id']), None)
            if product_obj:
                discount = get_best_group_discount(product_obj, current_user, session)
                if discount:
                    item['group_discount'] = discount
                    item['effective_price'] = round(item['price'] - discount, 2)
    return enriched


@router.get("/admin/paginated", response_model=PaginatedProductsResponse)
def read_products_paginated(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=2000),
    category_id: Optional[int] = None,
    brand_id: Optional[int] = None,
    supplier_id: Optional[int] = None,
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

    if supplier_id:
        supplier_product_ids = select(PurchaseOrderItem.product_id).join(
            PurchaseOrder, PurchaseOrderItem.purchase_order_id == PurchaseOrder.id
        ).where(
            PurchaseOrder.supplier_id == supplier_id,
            PurchaseOrderItem.product_id.isnot(None)
        )
        base_query = base_query.where(Product.id.in_(supplier_product_ids))

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



@router.get("/barcode/{code}", response_model=ProductRead)
def get_product_by_barcode(
    code: str,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """Look up a product by its EAN/UPC barcode (staff only)."""
    product = session.exec(select(Product).where(Product.barcode == code.strip())).first()
    if not product:
        raise HTTPException(status_code=404, detail="Produit non trouvé pour ce code-barres")

    promotions = get_active_promotions(session)
    product_data = ProductRead.model_validate(product).model_dump()
    product_data['promotion'] = get_best_promotion_for_product(product, promotions)
    product_data['segment_ids'] = get_product_segment_ids(product.id, session)

    discount = get_best_group_discount(product, current_user, session)
    if discount:
        product_data['group_discount'] = discount
        product_data['effective_price'] = round(product_data['price'] - discount, 2)

    return product_data

@router.get("/{product_id}", response_model=ProductRead)
def read_product(
    product_id: int,
    lang: str = Query("en", description="Language for translations (en, fr, ar)"),
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_optional_user),
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
    product_data['segment_ids'] = get_product_segment_ids(product.id, session)

    # Add group discount if user is authenticated
    if current_user:
        discount = get_best_group_discount(product, current_user, session)
        if discount:
            product_data['group_discount'] = discount
            product_data['effective_price'] = round(product_data['price'] - discount, 2)

    return product_data

def validate_fraction_options(fraction_options, pieces_per_box):
    """Validate that each fraction's denominator divides evenly into pieces_per_box."""
    if not fraction_options:
        return
    for frac in fraction_options:
        n = frac.get('n')
        d = frac.get('d')
        if not isinstance(n, int) or not isinstance(d, int) or d <= 0 or n <= 0 or n >= d:
            raise HTTPException(status_code=400, detail=f"Fraction invalide: {n}/{d}")
        if pieces_per_box and pieces_per_box % d != 0:
            raise HTTPException(
                status_code=400,
                detail=f"pieces_per_box ({pieces_per_box}) doit être divisible par {d} pour la fraction {n}/{d}"
            )


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

    # Validate fraction options
    ppb = product_in.pieces_per_box if product_in.pieces_per_box is not None else product.pieces_per_box
    validate_fraction_options(product_in.fraction_options, ppb)

    # Check if category exists if being updated
    if product_in.category_id is not None:
        category = session.get(Category, product_in.category_id)
        if not category:
            raise HTTPException(
                status_code=404,
                detail="Category not found",
            )
    
    # Update fields (excluding segment_ids which are handled separately)
    update_data = product_in.model_dump(exclude_unset=True, exclude={'segment_ids'})
    for field, value in update_data.items():
        setattr(product, field, value)

    product.updated_at = datetime.now(timezone.utc)
    session.add(product)

    # Update segment links if provided
    if product_in.segment_ids is not None:
        set_product_segments(product.id, product_in.segment_ids, session)

    session.commit()
    session.refresh(product)
    product_data = ProductRead.model_validate(product).model_dump()
    product_data['segment_ids'] = get_product_segment_ids(product.id, session)
    return product_data

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


class ProductStockStats(BaseModel):
    stock_quantity: int
    total_received: int
    total_facture_received: int
    total_invoiced: int
    facture_remaining: int
    total_left: int
    units_per_carton: int
    packaging_type: Optional[str]


@router.get("/{product_id}/stock-stats", response_model=ProductStockStats)
def get_product_stock_stats(
    product_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
):
    """Return stock statistics for a product: physical stock, facture remaining, and total left."""
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    total_received = session.exec(
        select(func.coalesce(func.sum(PurchaseOrderItem.quantity_received), 0))
        .join(PurchaseOrder, PurchaseOrderItem.purchase_order_id == PurchaseOrder.id)
        .where(PurchaseOrderItem.product_id == product_id, PurchaseOrder.status == PurchaseOrderStatus.DELIVERED)
    ).one()

    total_facture_received = session.exec(
        select(func.coalesce(func.sum(PurchaseOrderItem.facture_quantity), 0))
        .join(PurchaseOrder, PurchaseOrderItem.purchase_order_id == PurchaseOrder.id)
        .where(PurchaseOrderItem.product_id == product_id, PurchaseOrder.status == PurchaseOrderStatus.DELIVERED)
    ).one()

    total_invoiced = session.exec(
        select(func.coalesce(func.sum(FacturationItem.quantity), 0))
        .join(Facturation, FacturationItem.facturation_id == Facturation.id)
        .where(FacturationItem.product_id == product_id)
        .where(Facturation.document_type == 'facture')
    ).one()

    tr = int(total_received)
    tfr = int(total_facture_received)
    ti = int(total_invoiced)

    return ProductStockStats(
        stock_quantity=product.stock_quantity,
        total_received=tr,
        total_facture_received=tfr,
        total_invoiced=ti,
        facture_remaining=tfr - ti,
        total_left=tr - ti,
        units_per_carton=product.pieces_per_box or 1,
        packaging_type=product.packaging_type.value if product.packaging_type else None,
    )


class ProductPriceHistoryPoint(BaseModel):
    date: str
    unit_price: float
    quantity_received: int
    supplier_id: Optional[int]
    supplier_name: str
    purchase_order_id: int
    purchase_order_reference: str


@router.get("/{product_id}/price-history", response_model=List[ProductPriceHistoryPoint])
def get_product_price_history(
    product_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
):
    """Return full price history for a product across all suppliers (delivered orders only)."""
    rows = session.exec(
        select(PurchaseOrderItem, PurchaseOrder)
        .join(PurchaseOrder, PurchaseOrderItem.purchase_order_id == PurchaseOrder.id)
        .where(
            PurchaseOrderItem.product_id == product_id,
            PurchaseOrder.status == PurchaseOrderStatus.DELIVERED
        )
        .order_by(PurchaseOrder.delivered_at, PurchaseOrder.created_at)
    ).all()

    return [
        ProductPriceHistoryPoint(
            date=(order.delivered_at or order.created_at).isoformat(),
            unit_price=item.unit_price,
            quantity_received=item.quantity_received,
            supplier_id=order.supplier_id,
            supplier_name=order.supplier_name,
            purchase_order_id=order.id,
            purchase_order_reference=order.reference
        )
        for item, order in rows
    ]


# =============================================================================
# GROUP PRICING ENDPOINTS
# =============================================================================

@router.get("/{product_id}/group-prices", response_model=List[ProductGroupPriceRead])
def get_product_group_prices(
    product_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
) -> Any:
    """Get all group discounts configured for a product (staff only)."""
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    prices = session.exec(
        select(ProductGroupPrice).where(ProductGroupPrice.product_id == product_id)
    ).all()

    # Load group names and colors
    group_ids = [p.group_id for p in prices]
    groups_map = {}
    if group_ids:
        groups = session.exec(select(UserGroup).where(UserGroup.id.in_(group_ids))).all()
        groups_map = {g.id: g for g in groups}

    return [
        ProductGroupPriceRead(
            id=p.id,
            product_id=p.product_id,
            group_id=p.group_id,
            discount_type=p.discount_type,
            discount_value=p.discount_value,
            group_name=groups_map[p.group_id].name if p.group_id in groups_map else None,
            group_color=groups_map[p.group_id].color if p.group_id in groups_map else None,
        )
        for p in prices
    ]


@router.put("/{product_id}/group-prices", response_model=List[ProductGroupPriceRead])
def set_product_group_prices(
    product_id: int,
    prices_in: List[ProductGroupPriceUpsert],
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
) -> Any:
    """Replace all group discounts for a product (staff only). Pass empty list to clear all."""
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Delete existing group prices for this product
    existing = session.exec(
        select(ProductGroupPrice).where(ProductGroupPrice.product_id == product_id)
    ).all()
    for ep in existing:
        session.delete(ep)

    # Insert new ones
    new_prices = []
    for p in prices_in:
        gp = ProductGroupPrice(
            product_id=product_id,
            group_id=p.group_id,
            discount_type=p.discount_type,
            discount_value=p.discount_value,
        )
        session.add(gp)
        new_prices.append(gp)

    session.commit()
    for gp in new_prices:
        session.refresh(gp)

    # Load group info for response
    group_ids = [p.group_id for p in prices_in]
    groups_map = {}
    if group_ids:
        groups = session.exec(select(UserGroup).where(UserGroup.id.in_(group_ids))).all()
        groups_map = {g.id: g for g in groups}

    return [
        ProductGroupPriceRead(
            id=gp.id,
            product_id=gp.product_id,
            group_id=gp.group_id,
            discount_type=gp.discount_type,
            discount_value=gp.discount_value,
            group_name=groups_map[gp.group_id].name if gp.group_id in groups_map else None,
            group_color=groups_map[gp.group_id].color if gp.group_id in groups_map else None,
        )
        for gp in new_prices
    ]


# =============================================================================
# PRODUCT ANALYTICS
# =============================================================================

@router.get("/{product_id}/analytics", response_model=ProductAnalyticsResponse)
def get_product_analytics(
    product_id: int,
    from_date: Optional[datetime] = Query(None, description="Start date (ISO 8601)"),
    to_date: Optional[datetime] = Query(None, description="End date (ISO 8601)"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
) -> Any:
    """Sales analytics for a product: daily sales, per-customer breakdown, summary (staff only)."""
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    conditions = [
        OrderItem.product_id == product_id,
        Order.status != OrderStatus.CANCELLED,
    ]
    if from_date:
        conditions.append(Order.created_at >= from_date)
    if to_date:
        conditions.append(Order.created_at <= to_date)

    # Daily sales
    daily_q = (
        select(
            func.date(Order.created_at).label('sale_date'),
            func.sum(OrderItem.quantity).label('quantity'),
            func.sum(OrderItem.quantity * OrderItem.unit_price).label('revenue'),
        )
        .select_from(OrderItem)
        .join(Order, Order.id == OrderItem.order_id)
        .where(*conditions)
        .group_by(func.date(Order.created_at))
        .order_by(func.date(Order.created_at))
    )
    daily_rows = session.execute(daily_q).all()

    # Per-customer sales
    customer_q = (
        select(
            Order.user_id,
            User.full_name,
            func.sum(OrderItem.quantity).label('quantity'),
            func.sum(OrderItem.quantity * OrderItem.unit_price).label('revenue'),
            func.count(Order.id.distinct()).label('order_count'),
        )
        .select_from(OrderItem)
        .join(Order, Order.id == OrderItem.order_id)
        .join(User, User.id == Order.user_id)
        .where(*conditions)
        .group_by(Order.user_id, User.full_name)
        .order_by(func.sum(OrderItem.quantity).desc())
    )
    customer_rows = sorted(session.execute(customer_q).all(), key=lambda r: float(r.quantity), reverse=True)

    # Summary
    summary_q = (
        select(
            func.coalesce(func.sum(OrderItem.quantity), 0).label('total_units'),
            func.coalesce(func.sum(OrderItem.quantity * OrderItem.unit_price), 0).label('total_revenue'),
            func.count(Order.user_id.distinct()).label('unique_customers'),
            func.count(Order.id.distinct()).label('order_count'),
        )
        .select_from(OrderItem)
        .join(Order, Order.id == OrderItem.order_id)
        .where(*conditions)
    )
    summary_row = session.execute(summary_q).first()

    total_units = float(summary_row.total_units) if summary_row else 0.0
    total_revenue = float(summary_row.total_revenue) if summary_row else 0.0
    order_count = int(summary_row.order_count) if summary_row else 0
    avg_qty = round(total_units / order_count, 2) if order_count > 0 else 0.0

    return ProductAnalyticsResponse(
        product_id=product_id,
        product_name=product.name,
        pieces_per_box=product.pieces_per_box,
        packaging_type=product.packaging_type,
        daily_sales=[
            ProductDailySale(
                date=str(r.sale_date),
                quantity=float(r.quantity),
                revenue=float(r.revenue),
            )
            for r in daily_rows
        ],
        customer_sales=[
            ProductCustomerSale(
                customer_id=r.user_id,
                customer_name=r.full_name or f"Client #{r.user_id}",
                quantity=float(r.quantity),
                revenue=float(r.revenue),
                order_count=int(r.order_count),
            )
            for r in customer_rows
        ],
        summary=ProductAnalyticsSummary(
            total_units=total_units,
            total_revenue=total_revenue,
            unique_customers=int(summary_row.unique_customers) if summary_row else 0,
            order_count=order_count,
            avg_quantity_per_order=avg_qty,
        ),
    )