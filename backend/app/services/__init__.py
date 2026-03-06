"""
Services package for shared business logic.

This package contains:
- discount_validation: Shared validation utilities for discount-related endpoints
- discount_calculation: Centralized discount calculation service
- email: Email service for sending notifications
"""

from app.services.discount_validation import (
    validate_date_range,
    validate_percentage_discount,
    validate_free_units_discount,
    validate_discount_value,
    validate_target_not_in_triggers,
    validate_min_order_amount,
)

from app.services.discount_calculation import (
    calculate_volume_discount,
    calculate_promotion_discount,
    calculate_scope_based_discount,
    calculate_cross_sell_discount,
    calculate_cart_volume_discounts,
    VolumeDiscountResult,
    VolumeDiscountConfig,
    VolumeDiscountType,
    PromotionScope,
    CartItem,
    AppliedVolumeDiscount,
)

__all__ = [
    # Validation
    "validate_date_range",
    "validate_percentage_discount",
    "validate_free_units_discount",
    "validate_discount_value",
    "validate_target_not_in_triggers",
    "validate_min_order_amount",
    # Calculation
    "calculate_volume_discount",
    "calculate_promotion_discount",
    "calculate_scope_based_discount",
    "calculate_cross_sell_discount",
    "calculate_cart_volume_discounts",
    "VolumeDiscountResult",
    "VolumeDiscountConfig",
    "VolumeDiscountType",
    "PromotionScope",
    "CartItem",
    "AppliedVolumeDiscount",
]
