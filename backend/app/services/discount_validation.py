"""
Shared validation utilities for discount-related endpoints.
Centralizes validation logic to avoid duplication across:
- volume_discounts.py
- promotions.py
- cross_sell_promotions.py
"""

from fastapi import HTTPException
from datetime import datetime
from typing import Optional
from enum import Enum


class DiscountType(str, Enum):
    """Unified discount types across all discount systems"""
    PERCENTAGE = "percentage"
    FIXED = "fixed"
    FIXED_AMOUNT = "fixed_amount"
    FREE_UNITS = "free_units"


def validate_date_range(
    start_date: datetime,
    end_date: datetime,
    allow_null_dates: bool = False
) -> None:
    """
    Validate that end_date is after start_date.

    Args:
        start_date: Start date of the promotion/discount
        end_date: End date of the promotion/discount
        allow_null_dates: If True, allows None dates (for optional date ranges)

    Raises:
        HTTPException: If dates are invalid
    """
    if allow_null_dates and (start_date is None or end_date is None):
        return

    if end_date <= start_date:
        raise HTTPException(
            status_code=400,
            detail="End date must be after start date"
        )


def validate_percentage_discount(
    discount_type: str,
    discount_value: float,
    max_percentage: float = 100
) -> None:
    """
    Validate percentage discount doesn't exceed maximum.

    Args:
        discount_type: Type of discount (percentage, fixed, etc.)
        discount_value: The discount value
        max_percentage: Maximum allowed percentage (default 100)

    Raises:
        HTTPException: If percentage exceeds maximum
    """
    if discount_type in (DiscountType.PERCENTAGE, "percentage") and discount_value > max_percentage:
        raise HTTPException(
            status_code=400,
            detail=f"Percentage discount cannot exceed {max_percentage}%"
        )


def validate_free_units_discount(
    discount_type: str,
    discount_value: float,
    min_quantity: int
) -> None:
    """
    Validate free units discount value doesn't exceed minimum quantity.

    Args:
        discount_type: Type of discount
        discount_value: Number of free units
        min_quantity: Minimum quantity required

    Raises:
        HTTPException: If free units >= min_quantity
    """
    if discount_type in (DiscountType.FREE_UNITS, "free_units"):
        if discount_value >= min_quantity:
            raise HTTPException(
                status_code=400,
                detail="Free units cannot be equal to or greater than minimum quantity"
            )


def validate_discount_value(
    discount_type: str,
    discount_value: float,
    min_quantity: Optional[int] = None
) -> None:
    """
    Validate discount value based on type.
    Combines percentage and free units validation.

    Args:
        discount_type: Type of discount
        discount_value: The discount value
        min_quantity: Minimum quantity (required for free_units type)

    Raises:
        HTTPException: If validation fails
    """
    validate_percentage_discount(discount_type, discount_value)

    if min_quantity is not None:
        validate_free_units_discount(discount_type, discount_value, min_quantity)


def validate_target_not_in_triggers(
    target_product_id: int,
    trigger_product_ids: list[int]
) -> None:
    """
    Validate target product is not in trigger products list.

    Args:
        target_product_id: ID of the target product
        trigger_product_ids: List of trigger product IDs

    Raises:
        HTTPException: If target is in triggers
    """
    if target_product_id in trigger_product_ids:
        raise HTTPException(
            status_code=400,
            detail="Target product cannot be in the trigger products list"
        )


def validate_min_order_amount(
    subtotal: float,
    min_order_amount: float,
    error_message: Optional[str] = None
) -> bool:
    """
    Check if subtotal meets minimum order amount requirement.

    Args:
        subtotal: Cart subtotal
        min_order_amount: Minimum required amount
        error_message: Optional custom error message

    Returns:
        True if valid, False otherwise (doesn't raise, caller handles)
    """
    return subtotal >= min_order_amount
