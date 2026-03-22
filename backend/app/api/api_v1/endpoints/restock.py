from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlmodel import Session, select
from pydantic import BaseModel
from datetime import datetime, timezone

from app.database import get_session
from app.models.restock import RestockItem
from app.models.product import Product, ProductUnit, PackagingType
from app.models.brand import Brand
from app.models.category import Category
from app.services.s3 import S3Service

router = APIRouter()


# =============================================================================
# Request/Response Models
# =============================================================================

class RestockItemRequest(BaseModel):
    """Request model for saving restock items.

    Product fields are written to the Products table.
    Purchasing fields are written to the restock_items table.

    For new items (id is None or negative), if productId is None,
    a new Product will be created automatically.
    """
    id: Optional[int] = None
    productId: Optional[int] = None  # Optional - will auto-create product if None
    # Product fields (written to Products table)
    brandId: Optional[int] = None
    categoryId: Optional[int] = None
    name: str = ""
    image: str = ""
    description: str = ""
    productUnit: str = "piece"
    packageType: str = "Carton"
    volume: Optional[float] = None
    weight: Optional[float] = None
    # Purchasing fields (written to restock_items table)
    supplier: str = ""
    phone: str = ""
    prixUniteAchat: float = 0
    uniteParCarton: int = 1
    prixCarton: float = 0
    nmbCarton: int = 0
    carry: bool = False
    priority: int = 0
    hidden: bool = False


class RestockItemResponse(BaseModel):
    """Response model - combines product data + purchasing data"""
    id: int
    productId: int
    # Product fields (from Products table)
    brandId: Optional[int] = None
    categoryId: Optional[int] = None
    brand: str = ""
    category: str = ""
    name: str = ""
    image: str = ""
    description: str = ""
    productUnit: str = "piece"
    packageType: str = "Carton"
    volume: Optional[float] = None
    weight: Optional[float] = None
    # Purchasing fields (from restock_items table)
    supplier: str = ""
    phone: str = ""
    prixUniteAchat: float = 0
    uniteParCarton: int = 1
    prixCarton: float = 0
    nmbCarton: int = 0
    carry: bool = False
    priority: int = 0
    hidden: bool = False


class RestockData(BaseModel):
    items: List[RestockItemResponse]


# =============================================================================
# Helper Functions
# =============================================================================

def reverse_map_product_unit(unit: ProductUnit) -> str:
    """Map ProductUnit enum back to string for frontend"""
    mapping = {
        ProductUnit.PIECE: "piece",
        ProductUnit.KG: "kg",
        ProductUnit.GRAM: "g",
        ProductUnit.BOX: "box",
        ProductUnit.BUNCH: "bunch",
        ProductUnit.DOZEN: "dozen",
        ProductUnit.POUND: "pound",
    }
    return mapping.get(unit, "piece")


def reverse_map_package_type(packaging: PackagingType) -> str:
    """Map PackagingType enum back to string for frontend"""
    mapping = {
        PackagingType.CARTON: "Carton",
        PackagingType.PACK: "Paquet",
        PackagingType.BUNDLE: "Fardeau",
        PackagingType.BOX: "Boîte",
        PackagingType.BAG: "Sachet",
        PackagingType.CRATE: "Palette",
    }
    return mapping.get(packaging, "Carton")


def map_product_unit(unit: str) -> ProductUnit:
    """Map string to ProductUnit enum"""
    mapping = {
        "piece": ProductUnit.PIECE,
        "kg": ProductUnit.KG,
        "g": ProductUnit.GRAM,
        "gram": ProductUnit.GRAM,
        "box": ProductUnit.BOX,
        "bunch": ProductUnit.BUNCH,
        "dozen": ProductUnit.DOZEN,
        "pound": ProductUnit.POUND,
        "bottle": ProductUnit.PIECE,
        "can": ProductUnit.PIECE,
        "sachet": ProductUnit.PIECE,
    }
    return mapping.get(unit, ProductUnit.PIECE)


def map_package_type(restock_type: str) -> PackagingType:
    """Map string to PackagingType enum"""
    mapping = {
        "Carton": PackagingType.CARTON,
        "Paquet": PackagingType.PACK,
        "Fardeau": PackagingType.BUNDLE,
        "Sachet": PackagingType.BAG,
        "Boîte": PackagingType.BOX,
        "Palette": PackagingType.CRATE,
    }
    return mapping.get(restock_type, PackagingType.CARTON)


def db_to_response(
    item: RestockItem,
    product: Product,
    brands_map: dict = None,
    categories_map: dict = None
) -> RestockItemResponse:
    """Convert restock item + product to response model.

    Product data comes from the Products table.
    Purchasing data comes from the restock_items table.
    """
    brand_name = ""
    category_name = ""

    if product.brand_id:
        if brands_map:
            brand = brands_map.get(product.brand_id)
            if brand:
                brand_name = brand.name

    if product.category_id:
        if categories_map:
            category = categories_map.get(product.category_id)
            if category:
                category_name = category.name

    return RestockItemResponse(
        id=item.id,
        productId=item.product_id,
        # Product fields from Products table
        brandId=product.brand_id,
        categoryId=product.category_id,
        brand=brand_name,
        category=category_name,
        name=product.name or "",
        image=product.image_url or "",
        description=product.description or "",
        productUnit=reverse_map_product_unit(product.unit) if product.unit else "piece",
        packageType=reverse_map_package_type(product.packaging_type) if product.packaging_type else "Carton",
        volume=product.volume,
        weight=product.weight,
        # Purchasing fields from restock_items table
        supplier=item.supplier or "",
        phone=item.phone or "",
        prixUniteAchat=item.prix_unite_achat or 0,
        uniteParCarton=item.unite_par_carton or 1,
        prixCarton=item.prix_carton or 0,
        nmbCarton=item.nmb_carton or 0,
        carry=item.carry if item.carry is not None else False,
        priority=item.priority or 0,
        hidden=item.hidden if item.hidden is not None else False,
    )


def generate_name_translations(name: str) -> dict:
    """Generate name translations (all languages use same name)"""
    return {"en": name, "fr": name, "ar": name}


def generate_description(description: str, pieces_per_box: int = None) -> str:
    """Generate base description (French).

    If pieces_per_box is provided and no custom description, auto-generate.
    """
    if description:
        return description
    if pieces_per_box and pieces_per_box > 1:
        return f"{pieces_per_box} unités par carton"
    return ""


def generate_description_translations(description: str, pieces_per_box: int = None) -> dict:
    """Generate description translations.

    If pieces_per_box is provided and no custom description, auto-generate based on units per box.
    Otherwise, copy the description to all languages.
    """
    # Auto-generate based on pieces per box if no custom description
    if pieces_per_box and pieces_per_box > 1 and not description:
        return {
            "en": f"{pieces_per_box} units per box",
            "fr": f"{pieces_per_box} unités par carton",
            "ar": f"{pieces_per_box} وحدة في الصندوق"
        }

    if not description:
        return {}

    return {"en": description, "fr": description, "ar": description}


# =============================================================================
# CRUD Endpoints
# =============================================================================

@router.get("", response_model=RestockData)
async def get_restock(session: Session = Depends(get_session)):
    """Get all restock items with product data from Products table."""
    statement = select(RestockItem).order_by(RestockItem.id)
    items = session.exec(statement).all()

    if not items:
        return RestockData(items=[])

    # Batch load all products
    product_ids = {item.product_id for item in items}
    products = session.exec(select(Product).where(Product.id.in_(product_ids))).all()
    products_map = {p.id: p for p in products}

    # Batch load brands and categories from products
    brand_ids = {p.brand_id for p in products if p.brand_id}
    category_ids = {p.category_id for p in products if p.category_id}

    brands_map = {}
    if brand_ids:
        brands = session.exec(select(Brand).where(Brand.id.in_(brand_ids))).all()
        brands_map = {b.id: b for b in brands}

    categories_map = {}
    if category_ids:
        categories = session.exec(select(Category).where(Category.id.in_(category_ids))).all()
        categories_map = {c.id: c for c in categories}

    # Build response
    response_items = []
    for item in items:
        product = products_map.get(item.product_id)
        if product:
            response_items.append(db_to_response(item, product, brands_map, categories_map))

    return RestockData(items=response_items)


@router.post("/item", response_model=dict)
async def save_restock_item(item: RestockItemRequest, session: Session = Depends(get_session)):
    """Save a restock item.

    Product fields → written to Products table
    Purchasing fields → written to restock_items table

    For new items without productId, a new Product is created automatically.
    """
    try:
        product = None

        # If productId provided, get existing product
        if item.productId:
            product = session.get(Product, item.productId)
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {item.productId} not found")
        else:
            # Auto-create product for new items
            if not item.name:
                raise HTTPException(status_code=422, detail="Product name is required")
            if not item.categoryId:
                raise HTTPException(status_code=422, detail="Category is required")

            # Check for duplicate (same name + brand)
            duplicate_query = select(Product).where(
                Product.name == item.name,
                Product.brand_id == item.brandId
            )
            existing = session.exec(duplicate_query).first()
            if existing:
                # Link to existing product instead
                product = existing
            else:
                # Create new product
                product = Product(
                    name=item.name,
                    price=0,
                    unit=map_product_unit(item.productUnit),
                    pieces_per_box=item.uniteParCarton if item.uniteParCarton >= 1 else None,
                    packaging_type=map_package_type(item.packageType),
                    volume=item.volume,
                    weight=item.weight,
                    stock_quantity=0,
                    is_active=False,
                    category_id=item.categoryId,
                    brand_id=item.brandId,
                    description=generate_description(item.description, item.uniteParCarton),
                    name_translations=generate_name_translations(item.name),
                    description_translations=generate_description_translations(item.description, item.uniteParCarton),
                    image_url=item.image,
                    created_at=datetime.now(timezone.utc)
                )
                session.add(product)
                session.flush()  # Get the product ID

        # Update product fields in Products table
        product.name = item.name
        product.brand_id = item.brandId
        product.category_id = item.categoryId
        product.image_url = item.image
        product.description = generate_description(item.description, item.uniteParCarton)
        product.volume = item.volume
        product.weight = item.weight
        product.unit = map_product_unit(item.productUnit)
        product.packaging_type = map_package_type(item.packageType)
        product.pieces_per_box = item.uniteParCarton if item.uniteParCarton >= 1 else None
        product.name_translations = generate_name_translations(item.name)
        product.description_translations = generate_description_translations(item.description, item.uniteParCarton)
        product.updated_at = datetime.now(timezone.utc)
        session.add(product)

        if item.id and item.id > 0:
            # Update existing restock item
            existing = session.get(RestockItem, item.id)
            if not existing:
                raise HTTPException(status_code=404, detail="Restock item not found")

            existing.supplier = item.supplier
            existing.phone = item.phone
            existing.prix_unite_achat = item.prixUniteAchat
            existing.unite_par_carton = item.uniteParCarton
            existing.prix_carton = item.prixCarton
            existing.nmb_carton = item.nmbCarton
            existing.carry = item.carry
            existing.priority = item.priority
            existing.hidden = item.hidden
            existing.updated_at = datetime.now(timezone.utc)
            session.add(existing)
            session.commit()
            return {"success": True, "id": existing.id}
        else:
            # Create new restock item (use product.id which may have been auto-created)
            db_item = RestockItem(
                product_id=product.id,
                supplier=item.supplier,
                phone=item.phone,
                prix_unite_achat=item.prixUniteAchat,
                unite_par_carton=item.uniteParCarton,
                prix_carton=item.prixCarton,
                nmb_carton=item.nmbCarton,
                carry=item.carry,
                priority=item.priority,
                hidden=item.hidden,
                created_at=datetime.now(timezone.utc)
            )
            session.add(db_item)
            session.commit()
            session.refresh(db_item)
            return {"success": True, "id": db_item.id, "productId": product.id}

    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=422, detail=str(e))


@router.delete("/item/{item_id}", response_model=dict)
async def delete_restock_item(item_id: int, session: Session = Depends(get_session)):
    """Delete a restock item (does not delete the product)"""
    try:
        item = session.get(RestockItem, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")

        session.delete(item)
        session.commit()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=422, detail=str(e))


# =============================================================================
# Image Upload
# =============================================================================

@router.post("/upload-image", response_model=dict)
async def upload_restock_image(
    file: UploadFile = File(...),
    brand: str = Form(...),
    name: str = Form(...),
    restockId: int = Form(...),
    session: Session = Depends(get_session)
):
    """Upload product image to S3 and update the Product's image_url"""
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

    # Update the product's image_url
    restock_item = session.get(RestockItem, restockId)
    if restock_item:
        product = session.get(Product, restock_item.product_id)
        if product:
            product.image_url = result
            product.updated_at = datetime.now(timezone.utc)
            session.add(product)
            session.commit()

    return {
        "success": True,
        "url": result,
        "key": key,
        "restockId": restockId
    }
