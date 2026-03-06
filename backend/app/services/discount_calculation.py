"""
Centralized discount calculation service.
Provides unified calculation logic for:
- Volume discounts (percentage, fixed_amount, free_units)
- Promotion discounts (global, category, brand, product scopes)
- Cross-sell discounts

This service is used by:
- volume_discounts.py endpoints
- promotions.py endpoints
- cross_sell_promotions.py endpoints
- Order calculation logic
"""

from dataclasses import dataclass
from typing import Optional, List, Dict, Any
from enum import Enum
from math import floor


class VolumeDiscountType(str, Enum):
    PERCENTAGE = "percentage"
    FIXED_AMOUNT = "fixed_amount"
    FREE_UNITS = "free_units"


class PromotionScope(str, Enum):
    GLOBAL = "global"
    CATEGORY = "category"
    BRAND = "brand"
    PRODUCT = "product"


@dataclass
class VolumeDiscountResult:
    """Result of volume discount calculation"""
    qualifies: bool
    sets: int
    saved_amount: float
    free_cartons: int
    free_units: int


@dataclass
class CartItem:
    """Cart item for discount calculations"""
    product_id: int
    quantity: int
    unit_price: float
    pieces_per_box: int = 1
    category_id: Optional[int] = None
    brand_id: Optional[int] = None


@dataclass
class VolumeDiscountConfig:
    """Volume discount configuration"""
    discount_type: VolumeDiscountType
    discount_value: float
    min_quantity: int  # In cartons


def calculate_volume_discount(
    cartons_ordered: int,
    discount: VolumeDiscountConfig,
    unit_price: float,
    pieces_per_box: int
) -> VolumeDiscountResult:
    """
    Calculate volume discount for given quantity and discount configuration.

    Args:
        cartons_ordered: Number of cartons ordered
        discount: Volume discount configuration
        unit_price: Price per unit (piece)
        pieces_per_box: Number of pieces per carton

    Returns:
        VolumeDiscountResult with calculation details
    """
    qualifies = cartons_ordered >= discount.min_quantity

    if not qualifies:
        return VolumeDiscountResult(
            qualifies=False,
            sets=0,
            saved_amount=0,
            free_cartons=0,
            free_units=0
        )

    sets = floor(cartons_ordered / discount.min_quantity)

    if discount.discount_type == VolumeDiscountType.PERCENTAGE:
        # Percentage discount applies to qualifying sets only
        qualifying_pieces = sets * discount.min_quantity * pieces_per_box
        qualifying_price = qualifying_pieces * unit_price
        saved_amount = qualifying_price * (discount.discount_value / 100)
        return VolumeDiscountResult(
            qualifies=True,
            sets=sets,
            saved_amount=round(saved_amount, 2),
            free_cartons=0,
            free_units=0
        )

    elif discount.discount_type == VolumeDiscountType.FIXED_AMOUNT:
        # Fixed amount discount per qualifying set
        saved_amount = sets * discount.discount_value
        return VolumeDiscountResult(
            qualifies=True,
            sets=sets,
            saved_amount=round(saved_amount, 2),
            free_cartons=0,
            free_units=0
        )

    elif discount.discount_type == VolumeDiscountType.FREE_UNITS:
        # Free cartons per qualifying set
        free_cartons = sets * int(discount.discount_value)
        free_units = free_cartons * pieces_per_box
        saved_amount = free_units * unit_price
        return VolumeDiscountResult(
            qualifies=True,
            sets=sets,
            saved_amount=round(saved_amount, 2),
            free_cartons=free_cartons,
            free_units=free_units
        )

    return VolumeDiscountResult(
        qualifies=False,
        sets=0,
        saved_amount=0,
        free_cartons=0,
        free_units=0
    )


def calculate_promotion_discount(
    base_amount: float,
    discount_type: str,
    discount_value: float,
    max_discount: Optional[float] = None
) -> float:
    """
    Calculate promotion discount amount.

    Args:
        base_amount: Base amount to apply discount to
        discount_type: Type of discount (percentage, fixed, fixed_amount)
        discount_value: Discount value
        max_discount: Optional maximum discount cap

    Returns:
        Calculated discount amount
    """
    if discount_type == "percentage":
        discount = base_amount * (discount_value / 100)
    else:
        # fixed or fixed_amount
        discount = discount_value

    # Apply maximum discount cap if specified
    if max_discount is not None and max_discount > 0:
        discount = min(discount, max_discount)

    # Don't exceed base amount
    discount = min(discount, base_amount)

    return round(discount, 2)


def calculate_scope_based_discount(
    cart_items: List[CartItem],
    scope: PromotionScope,
    target_id: Optional[int],
    discount_type: str,
    discount_value: float,
    min_order_amount: float = 0,
    max_discount: Optional[float] = None
) -> Dict[str, Any]:
    """
    Calculate discount based on promotion scope.

    Args:
        cart_items: List of cart items
        scope: Promotion scope (global, category, brand, product)
        target_id: ID of target entity (category_id, brand_id, or product_id)
        discount_type: Type of discount
        discount_value: Discount value
        min_order_amount: Minimum order amount required
        max_discount: Optional maximum discount cap

    Returns:
        Dictionary with applicable_amount, discount_amount, and qualifying_items
    """
    # Calculate totals based on scope
    if scope == PromotionScope.GLOBAL:
        applicable_amount = sum(item.unit_price * item.quantity for item in cart_items)
        qualifying_items = cart_items
    elif scope == PromotionScope.CATEGORY:
        qualifying_items = [i for i in cart_items if i.category_id == target_id]
        applicable_amount = sum(item.unit_price * item.quantity for item in qualifying_items)
    elif scope == PromotionScope.BRAND:
        qualifying_items = [i for i in cart_items if i.brand_id == target_id]
        applicable_amount = sum(item.unit_price * item.quantity for item in qualifying_items)
    elif scope == PromotionScope.PRODUCT:
        qualifying_items = [i for i in cart_items if i.product_id == target_id]
        applicable_amount = sum(item.unit_price * item.quantity for item in qualifying_items)
    else:
        return {"applicable_amount": 0, "discount_amount": 0, "qualifying_items": []}

    # Check minimum order amount
    if applicable_amount < min_order_amount:
        return {"applicable_amount": applicable_amount, "discount_amount": 0, "qualifying_items": []}

    # Calculate discount
    discount_amount = calculate_promotion_discount(
        applicable_amount,
        discount_type,
        discount_value,
        max_discount
    )

    return {
        "applicable_amount": round(applicable_amount, 2),
        "discount_amount": round(discount_amount, 2),
        "qualifying_items": qualifying_items
    }


def calculate_cross_sell_discount(
    target_price: float,
    discount_type: str,
    discount_value: float
) -> float:
    """
    Calculate cross-sell discount for a single unit.

    Args:
        target_price: Unit price of target product
        discount_type: Type of discount (percentage, fixed)
        discount_value: Discount value

    Returns:
        Discount amount per unit
    """
    if discount_type == "percentage":
        discount = target_price * (discount_value / 100)
    else:
        discount = min(discount_value, target_price)

    return round(discount, 2)


@dataclass
class AppliedVolumeDiscount:
    """Applied volume discount for a cart item"""
    product_id: int
    discount_id: int
    discount_name: str
    discount_type: VolumeDiscountType
    saved_amount: float
    free_units: int
    free_cartons: int


def calculate_cart_volume_discounts(
    cart_items: List[CartItem],
    active_discounts: List[Dict]
) -> List[AppliedVolumeDiscount]:
    """
    Calculate volume discounts for all cart items.

    Args:
        cart_items: List of cart items with product_id, quantity, unit_price, pieces_per_box
        active_discounts: List of active volume discount configurations
            Each should have: id, name, product_id, min_quantity, discount_type, discount_value

    Returns:
        List of AppliedVolumeDiscount for each qualifying item
    """
    applied = []

    for item in cart_items:
        # Convert quantity to cartons
        cartons_ordered = floor(item.quantity / item.pieces_per_box)

        # Find applicable discount for this product
        discount_config = None
        discount_info = None
        for d in active_discounts:
            if d["product_id"] == item.product_id and cartons_ordered >= d["min_quantity"]:
                discount_config = VolumeDiscountConfig(
                    discount_type=VolumeDiscountType(d["discount_type"]),
                    discount_value=d["discount_value"],
                    min_quantity=d["min_quantity"]
                )
                discount_info = d
                break

        if not discount_config:
            continue

        result = calculate_volume_discount(
            cartons_ordered,
            discount_config,
            item.unit_price,
            item.pieces_per_box
        )

        if result.qualifies:
            applied.append(AppliedVolumeDiscount(
                product_id=item.product_id,
                discount_id=discount_info["id"],
                discount_name=discount_info.get("name", ""),
                discount_type=discount_config.discount_type,
                saved_amount=result.saved_amount,
                free_units=result.free_units,
                free_cartons=result.free_cartons
            ))

    return applied
