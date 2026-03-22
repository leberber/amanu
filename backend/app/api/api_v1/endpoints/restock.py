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
    id: Optional[int] = None
    brandId: Optional[int] = None
    categoryId: Optional[int] = None
    name: str = ""
    image: str = ""
    description: str = ""
    supplier: str = ""
    phone: str = ""
    productUnit: str = "piece"
    packageType: str = "Carton"
    volume: Optional[float] = None  # in liters (L)
    weight: Optional[float] = None  # in kilograms (kg)
    prixUniteAchat: float = 0
    uniteParCarton: int = 1
    prixCarton: float = 0
    nmbCarton: int = 0
    carry: bool = False
    priority: int = 0
    hidden: bool = False


class RestockItemResponse(BaseModel):
    id: int
    productId: Optional[int] = None
    brandId: Optional[int] = None
    categoryId: Optional[int] = None
    brand: str = ""
    category: str = ""
    name: str = ""
    image: str = ""
    description: str = ""
    supplier: str = ""
    phone: str = ""
    productUnit: str = "piece"
    packageType: str = ""
    volume: Optional[float] = None  # in liters (L)
    weight: Optional[float] = None  # in kilograms (kg)
    prixUniteAchat: float = 0
    uniteParCarton: int = 1
    prixCarton: float = 0
    nmbCarton: int = 0
    carry: bool = False
    priority: int = 0
    hidden: bool = False
    synced: bool = False


class RestockData(BaseModel):
    items: List[RestockItemResponse]


class SyncResult(BaseModel):
    success: bool
    restockId: int
    productId: Optional[int] = None
    message: str = ""


# =============================================================================
# Helper Functions
# =============================================================================

def db_to_response(
    item: RestockItem,
    session: Session,
    brands_map: dict = None,
    categories_map: dict = None
) -> RestockItemResponse:
    """Convert database model to response model with joined data.

    Args:
        item: The restock item
        session: Database session
        brands_map: Optional pre-loaded {brand_id: Brand} for batch optimization
        categories_map: Optional pre-loaded {category_id: Category} for batch optimization
    """
    brand_name = ""
    category_name = ""

    if item.brand_id:
        if brands_map:
            brand = brands_map.get(item.brand_id)
        else:
            brand = session.get(Brand, item.brand_id)
        if brand:
            brand_name = brand.name

    if item.category_id:
        if categories_map:
            category = categories_map.get(item.category_id)
        else:
            category = session.get(Category, item.category_id)
        if category:
            category_name = category.name

    return RestockItemResponse(
        id=item.id,
        productId=item.product_id,
        brandId=item.brand_id,
        categoryId=item.category_id,
        brand=brand_name,
        category=category_name,
        name=item.name or "",
        image=item.image or "",
        description=item.description or "",
        supplier=item.supplier or "",
        phone=item.phone or "",
        productUnit=item.product_unit or "box",
        packageType=item.package_type or "Carton",
        volume=item.volume,
        weight=item.weight,
        prixUniteAchat=item.prix_unite_achat or 0,
        uniteParCarton=item.unite_par_carton or 1,
        prixCarton=item.prix_carton or 0,
        nmbCarton=item.nmb_carton or 0,
        carry=item.carry if item.carry is not None else False,
        priority=item.priority or 0,
        hidden=item.hidden if item.hidden is not None else False,
        synced=item.product_id is not None
    )


def map_package_type(restock_type: str) -> PackagingType:
    """Map restock package type to product PackagingType enum"""
    mapping = {
        "Carton": PackagingType.CARTON,
        "Paquet": PackagingType.PACK,
        "Fardeau": PackagingType.BUNDLE,
        "Bouteille": PackagingType.BOX,
        "Sachet": PackagingType.BAG,
        "Boîte": PackagingType.BOX,
        "Palette": PackagingType.CRATE,
    }
    return mapping.get(restock_type, PackagingType.CARTON)


def map_product_unit(unit: str) -> ProductUnit:
    """Map restock product unit to ProductUnit enum"""
    mapping = {
        # Individual units
        "piece": ProductUnit.PIECE,
        "unit": ProductUnit.PIECE,
        "portion": ProductUnit.PIECE,
        "slice": ProductUnit.PIECE,
        # Container units
        "bottle": ProductUnit.PIECE,
        "can": ProductUnit.PIECE,
        "jar": ProductUnit.PIECE,
        "box": ProductUnit.BOX,
        "sachet": ProductUnit.PIECE,
        "tray": ProductUnit.PIECE,
        "pot": ProductUnit.PIECE,
        "tube": ProductUnit.PIECE,
        # Weight units
        "kg": ProductUnit.KG,
        "g": ProductUnit.GRAM,
        "gram": ProductUnit.GRAM,
        # Volume units
        "L": ProductUnit.PIECE,
        "ml": ProductUnit.PIECE,
        "cl": ProductUnit.PIECE,
        # Bulk units
        "carton": ProductUnit.BOX,
        "crate": ProductUnit.BOX,
        "pack": ProductUnit.BOX,
        "dozen": ProductUnit.DOZEN,
        "bunch": ProductUnit.BUNCH,
        "pound": ProductUnit.POUND,
    }
    return mapping.get(unit, ProductUnit.PIECE)


# =============================================================================
# Translation Helpers
# =============================================================================

# Product unit translations: restock_unit -> {en, fr, ar}
UNIT_TRANSLATIONS = {
    # Individual units
    "piece": {"en": "pieces", "fr": "pièces", "ar": "قطعة"},
    "unit": {"en": "units", "fr": "unités", "ar": "وحدة"},
    "portion": {"en": "portions", "fr": "portions", "ar": "حصة"},
    "slice": {"en": "slices", "fr": "tranches", "ar": "شريحة"},
    # Container units
    "bottle": {"en": "bottles", "fr": "bouteilles", "ar": "زجاجة"},
    "can": {"en": "cans", "fr": "canettes", "ar": "علبة"},
    "jar": {"en": "jars", "fr": "bocaux", "ar": "برطمان"},
    "box": {"en": "boxes", "fr": "boîtes", "ar": "صندوق"},
    "sachet": {"en": "sachets", "fr": "sachets", "ar": "كيس"},
    "tray": {"en": "trays", "fr": "barquettes", "ar": "صينية"},
    "pot": {"en": "pots", "fr": "pots", "ar": "وعاء"},
    "tube": {"en": "tubes", "fr": "tubes", "ar": "أنبوب"},
    # Weight units
    "kg": {"en": "kg", "fr": "kg", "ar": "كغ"},
    "g": {"en": "g", "fr": "g", "ar": "غ"},
    "gram": {"en": "grams", "fr": "grammes", "ar": "غرام"},
    # Volume units
    "L": {"en": "L", "fr": "L", "ar": "ل"},
    "ml": {"en": "ml", "fr": "ml", "ar": "مل"},
    "cl": {"en": "cl", "fr": "cl", "ar": "سل"},
    # Bulk units
    "carton": {"en": "cartons", "fr": "cartons", "ar": "كرتون"},
    "crate": {"en": "crates", "fr": "caisses", "ar": "صندوق"},
    "pack": {"en": "packs", "fr": "packs", "ar": "عبوة"},
    "dozen": {"en": "dozens", "fr": "douzaines", "ar": "دزينة"},
    "bunch": {"en": "bunches", "fr": "bottes", "ar": "حزمة"},
    "pound": {"en": "pounds", "fr": "livres", "ar": "رطل"},
}

# Package type translations: restock_package_type -> {en, fr, ar}
PACKAGE_TRANSLATIONS = {
    "Carton": {"en": "carton", "fr": "carton", "ar": "كرتون"},
    "Paquet": {"en": "pack", "fr": "paquet", "ar": "عبوة"},
    "Fardeau": {"en": "bundle", "fr": "fardeau", "ar": "حزمة"},
    "Bouteille": {"en": "bottle", "fr": "bouteille", "ar": "زجاجة"},
    "Sachet": {"en": "sachet", "fr": "sachet", "ar": "كيس"},
    "Boîte": {"en": "box", "fr": "boîte", "ar": "صندوق"},
    "Palette": {"en": "pallet", "fr": "palette", "ar": "منصة"},
}


def generate_name_translations(french_name: str) -> dict:
    """
    Generate name translations from French name.
    All languages use the French name.
    """
    return {
        "en": french_name,
        "fr": french_name,
        "ar": french_name
    }


def generate_description_translations(
    unite_par_carton: int,
    product_unit: str,
    package_type: str
) -> dict:
    """
    Generate description translations using template:
    "{unite_par_carton} {product_unit} par {package_type}"
    """
    # Get translations with fallbacks
    unit_trans = UNIT_TRANSLATIONS.get(product_unit, {
        "en": product_unit,
        "fr": product_unit,
        "ar": product_unit
    })

    package_trans = PACKAGE_TRANSLATIONS.get(package_type, {
        "en": package_type.lower(),
        "fr": package_type.lower(),
        "ar": package_type
    })

    return {
        "en": f"{unite_par_carton} {unit_trans['en']} per {package_trans['en']}",
        "fr": f"{unite_par_carton} {unit_trans['fr']} par {package_trans['fr']}",
        "ar": f"{unite_par_carton} {unit_trans['ar']} في {package_trans['ar']}"
    }


# =============================================================================
# CRUD Endpoints
# =============================================================================

@router.get("", response_model=RestockData)
async def get_restock(session: Session = Depends(get_session)):
    """Get all restock items with joined brand/category names"""
    statement = select(RestockItem).order_by(RestockItem.id)
    items = session.exec(statement).all()

    if not items:
        return RestockData(items=[])

    # Batch load brands and categories
    brand_ids = {item.brand_id for item in items if item.brand_id}
    category_ids = {item.category_id for item in items if item.category_id}

    brands_map = {}
    if brand_ids:
        brands = session.exec(select(Brand).where(Brand.id.in_(brand_ids))).all()
        brands_map = {b.id: b for b in brands}

    categories_map = {}
    if category_ids:
        categories = session.exec(select(Category).where(Category.id.in_(category_ids))).all()
        categories_map = {c.id: c for c in categories}

    return RestockData(items=[db_to_response(item, session, brands_map, categories_map) for item in items])


@router.post("/item", response_model=dict)
async def save_restock_item(item: RestockItemRequest, session: Session = Depends(get_session)):
    """Save a single restock item"""
    try:
        if item.id and item.id > 0:
            # Update existing item
            existing = session.get(RestockItem, item.id)
            if not existing:
                raise HTTPException(status_code=404, detail="Item not found")

            existing.brand_id = item.brandId
            existing.category_id = item.categoryId
            existing.name = item.name
            existing.image = item.image
            existing.description = item.description
            existing.supplier = item.supplier
            existing.phone = item.phone
            existing.product_unit = item.productUnit
            existing.package_type = item.packageType
            existing.volume = item.volume
            existing.weight = item.weight
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
            session.refresh(existing)
            return {"success": True, "id": existing.id}
        else:
            # Create new item
            db_item = RestockItem(
                product_id=None,
                brand_id=item.brandId,
                category_id=item.categoryId,
                name=item.name,
                image=item.image,
                description=item.description,
                supplier=item.supplier,
                phone=item.phone,
                product_unit=item.productUnit,
                package_type=item.packageType,
                volume=item.volume,
                weight=item.weight,
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
            return {"success": True, "id": db_item.id}
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=422, detail=str(e))


@router.delete("/item/{item_id}", response_model=dict)
async def delete_restock_item(item_id: int, session: Session = Depends(get_session)):
    """Delete a single restock item"""
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
# Sync Endpoints
# =============================================================================

@router.post("/sync/{item_id}", response_model=SyncResult)
async def sync_restock_item(item_id: int, session: Session = Depends(get_session)):
    """Sync a single restock item to products table (smart update - only changed fields)"""
    try:
        restock_item = session.get(RestockItem, item_id)
        if not restock_item:
            raise HTTPException(status_code=404, detail="Restock item not found")

        # Validate required fields
        if not restock_item.name:
            return SyncResult(success=False, restockId=item_id, message="Product name is required")
        if not restock_item.category_id:
            return SyncResult(success=False, restockId=item_id, message="Category is required")

        # Validate category exists
        category = session.get(Category, restock_item.category_id)
        if not category:
            return SyncResult(success=False, restockId=item_id, message=f"Category ID {restock_item.category_id} not found")

        # Validate brand exists (if set)
        if restock_item.brand_id:
            brand_check = session.get(Brand, restock_item.brand_id)
            if not brand_check:
                return SyncResult(success=False, restockId=item_id, message=f"Brand ID {restock_item.brand_id} not found - please update the brand")

        # Get brand name for S3 operations
        new_brand_name = ""
        if restock_item.brand_id:
            brand = session.get(Brand, restock_item.brand_id)
            if brand:
                new_brand_name = brand.name

        # Check if already synced - update existing product
        if restock_item.product_id:
            product = session.get(Product, restock_item.product_id)
            if product:
                changes = []
                image_renamed = False

                # Get old brand name for comparison
                old_brand_name = ""
                if product.brand_id:
                    old_brand = session.get(Brand, product.brand_id)
                    if old_brand:
                        old_brand_name = old_brand.name

                # Check if brand or name changed (need to rename S3)
                brand_changed = product.brand_id != restock_item.brand_id
                name_changed = product.name != restock_item.name

                s3_rename_error = None
                if (brand_changed or name_changed) and restock_item.image:
                    # Try to rename S3 image
                    old_name = product.name or ""
                    new_name = restock_item.name or ""

                    if old_brand_name and old_name and new_brand_name and new_name:
                        success, new_url, msg = S3Service.rename_image(
                            old_brand=old_brand_name,
                            old_name=old_name,
                            new_brand=new_brand_name,
                            new_name=new_name
                        )
                        if success and new_url:
                            restock_item.image = new_url
                            image_renamed = True
                            changes.append("image_renamed")
                        elif not success:
                            s3_rename_error = msg

                # Update only changed fields
                # NOTE: price and stock_quantity are NOT synced to preserve selling price and inventory
                if product.name != restock_item.name:
                    product.name = restock_item.name
                    changes.append("name")

                new_unit = map_product_unit(restock_item.product_unit or "piece")
                if product.unit != new_unit:
                    product.unit = new_unit
                    changes.append("unit")

                if product.category_id != restock_item.category_id:
                    product.category_id = restock_item.category_id
                    changes.append("category")

                if product.brand_id != restock_item.brand_id:
                    product.brand_id = restock_item.brand_id
                    changes.append("brand")

                if product.description != restock_item.description:
                    product.description = restock_item.description
                    changes.append("description")

                if product.image_url != restock_item.image:
                    product.image_url = restock_item.image
                    changes.append("image_url")

                new_packaging = map_package_type(restock_item.package_type or "Carton")
                if product.packaging_type != new_packaging:
                    product.packaging_type = new_packaging
                    changes.append("packaging_type")

                if product.volume != restock_item.volume:
                    product.volume = restock_item.volume
                    changes.append("volume")

                if product.weight != restock_item.weight:
                    product.weight = restock_item.weight
                    changes.append("weight")

                new_pieces_per_box = restock_item.unite_par_carton if restock_item.unite_par_carton and restock_item.unite_par_carton >= 1 else None
                if product.pieces_per_box != new_pieces_per_box:
                    product.pieces_per_box = new_pieces_per_box
                    changes.append("pieces_per_box")

                # NOTE: stock_quantity is NOT synced - managed via deliveries/sales

                new_active = not restock_item.hidden
                if product.is_active != new_active:
                    product.is_active = new_active
                    changes.append("is_active")

                # Update translations
                new_name_translations = generate_name_translations(restock_item.name)
                if product.name_translations != new_name_translations:
                    product.name_translations = new_name_translations
                    changes.append("name_translations")

                new_description_translations = generate_description_translations(
                    unite_par_carton=restock_item.unite_par_carton or 1,
                    product_unit=restock_item.product_unit or "piece",
                    package_type=restock_item.package_type or "Carton"
                )
                if product.description_translations != new_description_translations:
                    product.description_translations = new_description_translations
                    changes.append("description_translations")

                if changes:
                    product.updated_at = datetime.now(timezone.utc)
                    session.add(product)

                    # Update restock item image if renamed
                    if image_renamed:
                        restock_item.updated_at = datetime.now(timezone.utc)
                        session.add(restock_item)

                    session.commit()
                    message = f"Updated: {', '.join(changes)}"
                    # Include S3 rename error if any
                    if s3_rename_error:
                        message += f" (Warning: image rename failed: {s3_rename_error})"
                else:
                    message = "No changes"
                    if s3_rename_error:
                        message = f"No changes (Warning: image rename failed: {s3_rename_error})"

                return SyncResult(
                    success=True,
                    restockId=item_id,
                    productId=product.id,
                    message=message
                )

        # Check for duplicate product (same name and brand)
        duplicate_query = select(Product).where(
            Product.name == restock_item.name,
            Product.brand_id == restock_item.brand_id
        )
        existing_product = session.exec(duplicate_query).first()

        if existing_product:
            # Link to existing product instead of creating duplicate
            restock_item.product_id = existing_product.id
            restock_item.updated_at = datetime.now(timezone.utc)
            session.add(restock_item)
            session.commit()

            return SyncResult(
                success=True,
                restockId=item_id,
                productId=existing_product.id,
                message=f"Linked to existing product (ID: {existing_product.id})"
            )

        # Generate translations
        name_translations = generate_name_translations(restock_item.name)
        description_translations = generate_description_translations(
            unite_par_carton=restock_item.unite_par_carton or 1,
            product_unit=restock_item.product_unit or "piece",
            package_type=restock_item.package_type or "Carton"
        )

        # Create new product (inactive with 0 stock/price until delivery)
        product = Product(
            name=restock_item.name,
            price=0,
            unit=map_product_unit(restock_item.product_unit or "piece"),
            pieces_per_box=restock_item.unite_par_carton if restock_item.unite_par_carton and restock_item.unite_par_carton >= 1 else None,
            packaging_type=map_package_type(restock_item.package_type or "Carton"),
            volume=restock_item.volume,
            weight=restock_item.weight,
            stock_quantity=0,
            is_active=False,
            category_id=restock_item.category_id,
            brand_id=restock_item.brand_id,
            description=restock_item.description,
            description_translations=description_translations,
            name_translations=name_translations,
            image_url=restock_item.image,
            created_at=datetime.now(timezone.utc)
        )
        session.add(product)
        session.commit()
        session.refresh(product)

        # Link restock item to product
        restock_item.product_id = product.id
        restock_item.updated_at = datetime.now(timezone.utc)
        session.add(restock_item)
        session.commit()

        return SyncResult(
            success=True,
            restockId=item_id,
            productId=product.id,
            message="Product created"
        )

    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        import traceback
        error_detail = f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}"
        print(f"Sync error for item {item_id}: {error_detail}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync-all", response_model=dict)
async def sync_all_restock(session: Session = Depends(get_session)):
    """Sync all restock items to products table (smart update - only changed fields)"""
    try:
        restock_items = session.exec(select(RestockItem)).all()
        results = []
        success_count = 0
        error_count = 0
        no_change_count = 0

        for restock_item in restock_items:
            try:
                if not restock_item.name or not restock_item.category_id:
                    results.append({
                        "restockId": restock_item.id,
                        "success": False,
                        "message": "Missing name or category"
                    })
                    error_count += 1
                    continue

                # Get brand name for S3 operations
                new_brand_name = ""
                if restock_item.brand_id:
                    brand = session.get(Brand, restock_item.brand_id)
                    if brand:
                        new_brand_name = brand.name

                if restock_item.product_id:
                    product = session.get(Product, restock_item.product_id)
                    if product:
                        changes = []

                        # Get old brand name
                        old_brand_name = ""
                        if product.brand_id:
                            old_brand = session.get(Brand, product.brand_id)
                            if old_brand:
                                old_brand_name = old_brand.name

                        # Check if brand or name changed (need to rename S3)
                        brand_changed = product.brand_id != restock_item.brand_id
                        name_changed = product.name != restock_item.name

                        if (brand_changed or name_changed) and restock_item.image:
                            old_name = product.name or ""
                            new_name = restock_item.name or ""
                            if old_brand_name and old_name and new_brand_name and new_name:
                                success, new_url, _ = S3Service.rename_image(
                                    old_brand=old_brand_name,
                                    old_name=old_name,
                                    new_brand=new_brand_name,
                                    new_name=new_name
                                )
                                if success and new_url:
                                    restock_item.image = new_url
                                    changes.append("image_renamed")

                        # Update only changed fields
                        if product.name != restock_item.name:
                            product.name = restock_item.name
                            changes.append("name")

                        # Use round for float comparison to avoid precision issues
                        if round(product.price or 0, 2) != round(restock_item.prix_unite_achat or 0, 2):
                            product.price = restock_item.prix_unite_achat
                            changes.append("price")

                        new_unit = map_product_unit(restock_item.product_unit or "piece")
                        if product.unit != new_unit:
                            product.unit = new_unit
                            changes.append("unit")

                        if product.category_id != restock_item.category_id:
                            product.category_id = restock_item.category_id
                            changes.append("category")

                        if product.brand_id != restock_item.brand_id:
                            product.brand_id = restock_item.brand_id
                            changes.append("brand")

                        if product.description != restock_item.description:
                            product.description = restock_item.description
                            changes.append("description")

                        if product.image_url != restock_item.image:
                            product.image_url = restock_item.image
                            changes.append("image_url")

                        new_packaging = map_package_type(restock_item.package_type or "Carton")
                        if product.packaging_type != new_packaging:
                            product.packaging_type = new_packaging
                            changes.append("packaging_type")

                        if product.volume != restock_item.volume:
                            product.volume = restock_item.volume
                            changes.append("volume")

                        if product.weight != restock_item.weight:
                            product.weight = restock_item.weight
                            changes.append("weight")

                        new_pieces_per_box = restock_item.unite_par_carton if restock_item.unite_par_carton and restock_item.unite_par_carton >= 1 else None
                        if product.pieces_per_box != new_pieces_per_box:
                            product.pieces_per_box = new_pieces_per_box
                            changes.append("pieces_per_box")

                        if product.stock_quantity != restock_item.nmb_carton:
                            product.stock_quantity = restock_item.nmb_carton
                            changes.append("stock_quantity")

                        new_active = not restock_item.hidden
                        if product.is_active != new_active:
                            product.is_active = new_active
                            changes.append("is_active")

                        # Update translations
                        new_name_translations = generate_name_translations(restock_item.name)
                        if product.name_translations != new_name_translations:
                            product.name_translations = new_name_translations
                            changes.append("name_translations")

                        new_description_translations = generate_description_translations(
                            unite_par_carton=restock_item.unite_par_carton or 1,
                            product_unit=restock_item.product_unit or "piece",
                            package_type=restock_item.package_type or "Carton"
                        )
                        if product.description_translations != new_description_translations:
                            product.description_translations = new_description_translations
                            changes.append("description_translations")

                        if changes:
                            product.updated_at = datetime.now(timezone.utc)
                            session.add(product)
                            if "image_renamed" in changes:
                                restock_item.updated_at = datetime.now(timezone.utc)
                                session.add(restock_item)
                            results.append({
                                "restockId": restock_item.id,
                                "productId": product.id,
                                "success": True,
                                "message": f"Updated: {len(changes)} fields"
                            })
                            success_count += 1
                        else:
                            results.append({
                                "restockId": restock_item.id,
                                "productId": product.id,
                                "success": True,
                                "message": "No changes"
                            })
                            no_change_count += 1
                        continue

                # Check for duplicate product (same name and brand)
                duplicate_query = select(Product).where(
                    Product.name == restock_item.name,
                    Product.brand_id == restock_item.brand_id
                )
                existing_product = session.exec(duplicate_query).first()

                if existing_product:
                    # Link to existing product instead of creating duplicate
                    restock_item.product_id = existing_product.id
                    restock_item.updated_at = datetime.now(timezone.utc)
                    session.add(restock_item)
                    results.append({
                        "restockId": restock_item.id,
                        "productId": existing_product.id,
                        "success": True,
                        "message": f"Linked to existing product"
                    })
                    success_count += 1
                    continue

                # Generate translations
                name_translations = generate_name_translations(restock_item.name)
                description_translations = generate_description_translations(
                    unite_par_carton=restock_item.unite_par_carton or 1,
                    product_unit=restock_item.product_unit or "piece",
                    package_type=restock_item.package_type or "Carton"
                )

                # Create new product
                product = Product(
                    name=restock_item.name,
                    price=restock_item.prix_unite_achat,
                    unit=map_product_unit(restock_item.product_unit or "piece"),
                    pieces_per_box=restock_item.unite_par_carton if restock_item.unite_par_carton and restock_item.unite_par_carton >= 1 else None,
                    packaging_type=map_package_type(restock_item.package_type or "Carton"),
                    volume=restock_item.volume,
                    weight=restock_item.weight,
                    stock_quantity=restock_item.nmb_carton,
                    is_active=not restock_item.hidden,
                    category_id=restock_item.category_id,
                    brand_id=restock_item.brand_id,
                    description=restock_item.description,
                    description_translations=description_translations,
                    name_translations=name_translations,
                    image_url=restock_item.image,
                    created_at=datetime.now(timezone.utc)
                )
                session.add(product)
                session.flush()

                restock_item.product_id = product.id
                restock_item.updated_at = datetime.now(timezone.utc)
                session.add(restock_item)

                results.append({
                    "restockId": restock_item.id,
                    "productId": product.id,
                    "success": True,
                    "message": "Created"
                })
                success_count += 1

            except Exception as e:
                results.append({
                    "restockId": restock_item.id,
                    "success": False,
                    "message": str(e)
                })
                error_count += 1

        session.commit()

        return {
            "success": True,
            "total": len(restock_items),
            "synced": success_count,
            "unchanged": no_change_count,
            "errors": error_count,
            "results": results
        }

    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))


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
    """Upload product image to S3 and persist URL to restock item"""
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

    # Persist image URL to restock item in database
    restock_item = session.get(RestockItem, restockId)
    if restock_item:
        restock_item.image = result
        restock_item.updated_at = datetime.now(timezone.utc)
        session.add(restock_item)
        session.commit()

    return {
        "success": True,
        "url": result,
        "key": key,
        "restockId": restockId
    }
