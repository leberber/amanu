import csv
import os
from typing import List
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))), "data")
STOCK_CSV_PATH = os.path.join(DATA_DIR, "stock.csv")


class StockItem(BaseModel):
    productId: int
    image: str
    category: str
    brand: str
    product: str
    description: str
    supplier: str = ''
    phone: str = ''
    prixUnite: float
    uniteParCarton: int
    prixCarton: float = 0
    nmbCarton: int
    carry: bool = False


class StockData(BaseModel):
    items: List[StockItem]


def ensure_data_dir():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)


@router.get("", response_model=StockData)
async def get_stock():
    items = []
    if os.path.exists(STOCK_CSV_PATH):
        try:
            with open(STOCK_CSV_PATH, 'r', newline='', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    items.append(StockItem(
                        productId=int(row['productId']),
                        image=row.get('image', ''),
                        category=row.get('category', ''),
                        brand=row.get('brand', ''),
                        product=row.get('product', ''),
                        description=row.get('description', ''),
                        supplier=row.get('supplier', ''),
                        phone=row.get('phone', ''),
                        prixUnite=float(row['prixUnite']) if row.get('prixUnite') else 0,
                        uniteParCarton=int(row['uniteParCarton']) if row.get('uniteParCarton') else 0,
                        prixCarton=float(row['prixCarton']) if row.get('prixCarton') else 0,
                        nmbCarton=int(row['nmbCarton']) if row.get('nmbCarton') else 0,
                        carry=row.get('carry', '').lower() == 'true'
                    ))
        except Exception as e:
            print(f"Error reading stock CSV: {e}")
    return StockData(items=items)


@router.post("", response_model=dict)
async def save_stock(data: StockData):
    ensure_data_dir()
    try:
        fieldnames = ['productId', 'image', 'category', 'brand', 'product', 'description', 'supplier', 'phone', 'prixUnite', 'uniteParCarton', 'prixCarton', 'nmbCarton', 'carry']
        with open(STOCK_CSV_PATH, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for item in data.items:
                writer.writerow({
                    'productId': item.productId,
                    'image': item.image,
                    'category': item.category,
                    'brand': item.brand,
                    'product': item.product,
                    'description': item.description,
                    'supplier': item.supplier,
                    'phone': item.phone,
                    'prixUnite': item.prixUnite,
                    'uniteParCarton': item.uniteParCarton,
                    'prixCarton': item.prixCarton,
                    'nmbCarton': item.nmbCarton,
                    'carry': item.carry
                })
        return {"success": True, "message": f"Saved {len(data.items)} items"}
    except Exception as e:
        return {"success": False, "message": str(e)}
