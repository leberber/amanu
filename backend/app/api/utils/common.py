from typing import Dict, List, Union, Any
from datetime import datetime

def format_price(price: float) -> float:
    """Format price to 2 decimal places"""
    return round(price, 2)

def calculate_order_total(items: List[Dict[str, Any]]) -> float:
    """Calculate the total price of order items"""
    return sum(item.get("quantity", 0) * item.get("unit_price", 0) for item in items)

def format_date(date: datetime) -> str:
    """Format date to ISO string"""
    return date.isoformat()