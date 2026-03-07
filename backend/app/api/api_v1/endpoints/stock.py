from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlmodel import Session, select
from sqlalchemy import text
from pydantic import BaseModel
from datetime import datetime, timezone

from app.database import get_session
from app.models.stock import StockItem
from app.services.s3 import S3Service

router = APIRouter()


class StockItemRequest(BaseModel):
    productId: int
    image: str = ""
    category: str = ""
    brand: str = ""
    product: str = ""
    description: str = ""
    supplier: str = ""
    phone: str = ""
    packageType: str = ""
    prixUnite: float = 0
    uniteParCarton: int = 1
    prixCarton: float = 0
    nmbCarton: int = 0
    carry: bool = False
    priority: int = 0
    hidden: bool = False


class StockItemResponse(BaseModel):
    productId: int
    image: str
    category: str
    brand: str
    product: str
    description: str
    supplier: str
    phone: str
    packageType: str
    prixUnite: float
    uniteParCarton: int
    prixCarton: float
    nmbCarton: int
    carry: bool
    priority: int
    hidden: bool


class StockData(BaseModel):
    items: List[StockItemResponse]


class StockSaveRequest(BaseModel):
    items: List[StockItemRequest]


def db_to_response(item: StockItem) -> StockItemResponse:
    """Convert database model to response model"""
    return StockItemResponse(
        productId=item.product_id,
        image=item.image or "",
        category=item.category or "",
        brand=item.brand or "",
        product=item.product or "",
        description=item.description or "",
        supplier=item.supplier or "",
        phone=item.phone or "",
        packageType=getattr(item, 'package_type', '') or "",
        prixUnite=item.prix_unite or 0,
        uniteParCarton=item.unite_par_carton or 1,
        prixCarton=item.prix_carton or 0,
        nmbCarton=item.nmb_carton or 0,
        carry=item.carry if item.carry is not None else False,
        priority=item.priority or 0,
        hidden=item.hidden if item.hidden is not None else False
    )


@router.get("", response_model=StockData)
async def get_stock(session: Session = Depends(get_session)):
    """Get all stock items"""
    statement = select(StockItem).order_by(StockItem.id)
    items = session.exec(statement).all()
    return StockData(items=[db_to_response(item) for item in items])


@router.delete("/item/{product_id}", response_model=dict)
async def delete_stock_item(product_id: int, session: Session = Depends(get_session)):
    """Delete a single stock item"""
    try:
        item = session.exec(
            select(StockItem).where(StockItem.product_id == product_id)
        ).first()

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


@router.post("/item", response_model=dict)
async def save_stock_item(item: StockItemRequest, session: Session = Depends(get_session)):
    """Save a single stock item"""
    try:
        # Generate new ID from sequence if product_id is negative (new row)
        product_id = item.productId
        if product_id < 0:
            result = session.execute(text("SELECT nextval('stock_product_id_seq')"))
            product_id = result.scalar()

        # Check if item already exists
        existing = session.exec(
            select(StockItem).where(StockItem.product_id == product_id)
        ).first()

        if existing:
            # Update existing item
            existing.image = item.image
            existing.category = item.category
            existing.brand = item.brand
            existing.product = item.product
            existing.description = item.description
            existing.supplier = item.supplier
            existing.phone = item.phone
            existing.package_type = item.packageType
            existing.prix_unite = item.prixUnite
            existing.unite_par_carton = item.uniteParCarton
            existing.prix_carton = item.prixCarton
            existing.nmb_carton = item.nmbCarton
            existing.carry = item.carry
            existing.priority = item.priority
            existing.hidden = item.hidden
            existing.updated_at = datetime.now(timezone.utc)
            session.add(existing)
        else:
            # Create new item
            db_item = StockItem(
                product_id=product_id,
                image=item.image,
                category=item.category,
                brand=item.brand,
                product=item.product,
                description=item.description,
                supplier=item.supplier,
                phone=item.phone,
                package_type=item.packageType,
                prix_unite=item.prixUnite,
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
        return {"success": True, "productId": product_id}
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=422, detail=str(e))


@router.post("", response_model=dict)
async def save_stock(data: StockSaveRequest, session: Session = Depends(get_session)):
    """Save stock items - replaces all existing items (stock_items is source of truth)"""
    print(f"Received {len(data.items)} items to save")
    try:
        # Delete all existing items
        statement = select(StockItem)
        existing_items = session.exec(statement).all()
        for item in existing_items:
            session.delete(item)

        # Add new items
        for item_data in data.items:
            # Generate new ID from sequence if product_id is negative (new row)
            product_id = item_data.productId
            if product_id < 0:
                result = session.execute(text("SELECT nextval('stock_product_id_seq')"))
                product_id = result.scalar()

            db_item = StockItem(
                product_id=product_id,
                image=item_data.image,
                category=item_data.category,
                brand=item_data.brand,
                product=item_data.product,
                description=item_data.description,
                supplier=item_data.supplier,
                phone=item_data.phone,
                package_type=item_data.packageType,
                prix_unite=item_data.prixUnite,
                unite_par_carton=item_data.uniteParCarton,
                prix_carton=item_data.prixCarton,
                nmb_carton=item_data.nmbCarton,
                carry=item_data.carry,
                priority=item_data.priority,
                hidden=item_data.hidden,
                created_at=datetime.now(timezone.utc)
            )
            session.add(db_item)

        session.commit()
        print(f"Saved {len(data.items)} stock items")
        return {"success": True, "message": f"Saved {len(data.items)} items"}
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/upload-image", response_model=dict)
async def upload_stock_image(
    file: UploadFile = File(...),
    brand: str = Form(...),
    category: str = Form(...),
    product: str = Form(...),
    productId: int = Form(...)
):
    """Upload product image to S3"""
    # Validate file type
    allowed_types = {'image/jpeg', 'image/png', 'image/webp', 'image/gif'}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}"
        )

    # Read file content
    image_data = await file.read()

    # Validate file size (max 10MB)
    if len(image_data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max size: 10MB")

    # Upload to S3
    success, result, key = S3Service.upload_image(
        image_data=image_data,
        brand=brand,
        category=category,
        product=product
    )

    if not success:
        raise HTTPException(status_code=500, detail=result)

    return {
        "success": True,
        "url": result,
        "key": key,
        "productId": productId
    }
