from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from sqlalchemy import text
from pydantic import BaseModel
from datetime import datetime, timezone

from app.database import get_session
from app.models.stock import StockItem

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
        image=item.image,
        category=item.category,
        brand=item.brand,
        product=item.product,
        description=item.description,
        supplier=item.supplier,
        phone=item.phone,
        prixUnite=item.prix_unite,
        uniteParCarton=item.unite_par_carton,
        prixCarton=item.prix_carton,
        nmbCarton=item.nmb_carton,
        carry=item.carry,
        priority=item.priority,
        hidden=item.hidden
    )


@router.get("", response_model=StockData)
async def get_stock(session: Session = Depends(get_session)):
    """Get all stock items"""
    statement = select(StockItem).order_by(StockItem.id)
    items = session.exec(statement).all()
    return StockData(items=[db_to_response(item) for item in items])


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
