"""
Shipping cost calculation and pricing configuration endpoints
"""
from typing import Any, List
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.database import get_session
from app.models.user import User
from app.models.shipping import (
    H3DeliveryZone,
    ShippingPriceConfig,
    ShippingPriceConfigCreate,
    ShippingPriceConfigUpdate,
    ShippingPriceConfigRead,
    ShippingCostRequest,
    ShippingCostResponse,
    DeliveryPricing,
)
from app.core.security import get_current_active_user, get_current_admin_user, get_current_staff_user

router = APIRouter()


def get_pricing_config(warehouse_id: str, session: Session) -> ShippingPriceConfig:
    """Get pricing config for warehouse, falling back to default."""
    # Try to get warehouse-specific config
    config = session.exec(
        select(ShippingPriceConfig).where(
            ShippingPriceConfig.warehouse_id == warehouse_id,
            ShippingPriceConfig.is_active == True
        )
    ).first()

    if config:
        return config

    # Fall back to default config
    config = session.exec(
        select(ShippingPriceConfig).where(
            ShippingPriceConfig.warehouse_id == "default",
            ShippingPriceConfig.is_active == True
        )
    ).first()

    if config:
        return config

    # Return a default config if none exists
    return ShippingPriceConfig(
        warehouse_id="default",
        base_cost=200.0,
        price_per_km=30.0,
        price_per_kg=10.0,
        price_per_m3=500.0,
        price_per_min=0.0,
        min_shipping_cost=200.0,
        max_shipping_cost=5000.0,
    )


def get_applicable_discount_tier(
    tiers: list[dict] | None,
    order_total: float
) -> tuple[float, dict | None]:
    """
    Find the highest discount tier the order qualifies for.
    Returns (discount_percent, next_tier_info).
    """
    if not tiers:
        return 0.0, None

    # Sort tiers by min_order ascending
    sorted_tiers = sorted(tiers, key=lambda t: t.get("min_order", 0))

    applicable_discount = 0.0
    next_tier = None

    for i, tier in enumerate(sorted_tiers):
        min_order = tier.get("min_order", 0)
        discount = tier.get("discount_percent", 0)

        if order_total >= min_order:
            applicable_discount = discount
            # Check if there's a next tier
            if i + 1 < len(sorted_tiers):
                next_t = sorted_tiers[i + 1]
                next_tier = {
                    "min_order": next_t.get("min_order"),
                    "discount_percent": next_t.get("discount_percent"),
                    "amount_needed": round(next_t.get("min_order", 0) - order_total, 2)
                }
            else:
                next_tier = None
        else:
            # This tier is above current order total - it's the next tier
            if applicable_discount == 0:
                next_tier = {
                    "min_order": min_order,
                    "discount_percent": discount,
                    "amount_needed": round(min_order - order_total, 2)
                }
            break

    return applicable_discount, next_tier


def calculate_shipping_cost(
    delivery_zone: H3DeliveryZone,
    config: ShippingPriceConfig,
    weight_kg: float,
    volume_m3: float,
    order_total: float,
) -> ShippingCostResponse:
    """Calculate shipping cost based on delivery zone and pricing config."""

    # Calculate individual components
    base_cost = config.base_cost
    distance_cost = delivery_zone.distance_km * config.price_per_km
    weight_cost = weight_kg * config.price_per_kg
    volume_cost = volume_m3 * config.price_per_m3
    time_cost = delivery_zone.duration_min * config.price_per_min

    # Total cost before discount
    total_cost = base_cost + distance_cost + weight_cost + volume_cost + time_cost

    # Apply min/max bounds to get original cost
    original_cost = max(config.min_shipping_cost, min(config.max_shipping_cost, total_cost))

    # Get applicable discount tier
    discount_percent, next_tier = get_applicable_discount_tier(
        config.shipping_discount_tiers,
        order_total
    )

    # Apply discount
    discount_amount = original_cost * (discount_percent / 100)
    final_cost = original_cost - discount_amount

    # Check if it's free shipping (100% discount)
    free_shipping = discount_percent >= 100

    # Build message
    message = None
    if free_shipping:
        message = "Free shipping applied!"
    elif discount_percent > 0:
        message = f"{int(discount_percent)}% shipping discount applied!"

    # Add "add X more" hint if there's a next tier
    if next_tier and next_tier["amount_needed"] > 0:
        if message:
            message += f" Add {next_tier['amount_needed']} DZD more for {int(next_tier['discount_percent'])}% off!"
        else:
            message = f"Add {next_tier['amount_needed']} DZD more to get {int(next_tier['discount_percent'])}% off shipping!"

    # Calculate standard delivery price (discounted for batching)
    STANDARD_DISCOUNT_PERCENT = config.standard_delivery_discount_percent
    standard_cost = round(final_cost * (1 - STANDARD_DISCOUNT_PERCENT / 100), 2)

    # Build delivery type pricing
    priority_pricing = DeliveryPricing(
        cost=round(final_cost, 2),
        original_cost=round(original_cost, 2),
        discount_percent=discount_percent,
        description="Immediate dedicated delivery"
    )

    standard_pricing = DeliveryPricing(
        cost=standard_cost,
        original_cost=round(final_cost, 2),
        discount_percent=STANDARD_DISCOUNT_PERCENT,
        description="May be grouped with nearby orders"
    )

    return ShippingCostResponse(
        deliverable=True,
        shipping_cost=round(final_cost, 2),
        original_cost=round(original_cost, 2),
        distance_km=round(delivery_zone.distance_km, 2),
        duration_min=round(delivery_zone.duration_min, 2),
        discount_applied=discount_percent > 0,
        discount_percent=discount_percent,
        free_shipping=free_shipping,
        breakdown={
            "base_cost": round(base_cost, 2),
            "distance_cost": round(distance_cost, 2),
            "weight_cost": round(weight_cost, 2),
            "volume_cost": round(volume_cost, 2),
            "time_cost": round(time_cost, 2),
            "total_before_bounds": round(total_cost, 2),
            "discount_amount": round(discount_amount, 2),
        },
        next_tier=next_tier,
        message=message,
        priority_price=priority_pricing,
        standard_price=standard_pricing,
    )


@router.post("/calculate", response_model=ShippingCostResponse)
def calculate_shipping(
    request: ShippingCostRequest,
    session: Session = Depends(get_session),
) -> Any:
    """
    Calculate shipping cost for a given H3 location.
    Public endpoint - no authentication required.
    """
    delivery_zone = None

    # If a specific warehouse is requested, try that first
    if request.warehouse_id and request.warehouse_id != "default":
        delivery_zone = session.exec(
            select(H3DeliveryZone).where(
                H3DeliveryZone.h3_index == request.h3_index,
                H3DeliveryZone.warehouse_id == request.warehouse_id
            )
        ).first()

    # If no specific warehouse or not found, find ANY warehouse that delivers here
    if not delivery_zone:
        delivery_zone = session.exec(
            select(H3DeliveryZone).where(
                H3DeliveryZone.h3_index == request.h3_index
            ).order_by(H3DeliveryZone.distance_km)  # Prefer closest warehouse
        ).first()

    if not delivery_zone:
        return ShippingCostResponse(
            deliverable=False,
            shipping_cost=0.0,
            original_cost=0.0,
            distance_km=0.0,
            duration_min=0.0,
            discount_applied=False,
            discount_percent=0.0,
            free_shipping=False,
            breakdown={},
            next_tier=None,
            message="Sorry, delivery is not available to your location."
        )

    # Get pricing config for the warehouse that will fulfill this delivery
    config = get_pricing_config(delivery_zone.warehouse_id, session)

    # Calculate and return shipping cost
    return calculate_shipping_cost(
        delivery_zone=delivery_zone,
        config=config,
        weight_kg=request.weight_kg,
        volume_m3=request.volume_m3,
        order_total=request.order_total,
    )


# Admin endpoints for pricing configuration

@router.get("/config", response_model=List[ShippingPriceConfigRead])
def list_pricing_configs(
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """Get all shipping price configurations (admin only)."""
    configs = session.exec(select(ShippingPriceConfig)).all()
    return configs


@router.get("/config/{warehouse_id}", response_model=ShippingPriceConfigRead)
def get_pricing_config_by_warehouse(
    warehouse_id: str,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """Get pricing config for a specific warehouse (admin only)."""
    config = session.exec(
        select(ShippingPriceConfig).where(
            ShippingPriceConfig.warehouse_id == warehouse_id
        )
    ).first()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pricing config for warehouse '{warehouse_id}' not found"
        )

    return config


@router.post("/config", response_model=ShippingPriceConfigRead)
def create_pricing_config(
    config_in: ShippingPriceConfigCreate,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """Create a new pricing configuration (admin only)."""
    # Check if config already exists for this warehouse
    existing = session.exec(
        select(ShippingPriceConfig).where(
            ShippingPriceConfig.warehouse_id == config_in.warehouse_id
        )
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Pricing config for warehouse '{config_in.warehouse_id}' already exists"
        )

    config = ShippingPriceConfig(**config_in.model_dump())
    session.add(config)
    session.commit()
    session.refresh(config)
    return config


@router.patch("/config/{warehouse_id}", response_model=ShippingPriceConfigRead)
def update_pricing_config(
    warehouse_id: str,
    config_in: ShippingPriceConfigUpdate,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """Update a pricing configuration (admin only)."""
    config = session.exec(
        select(ShippingPriceConfig).where(
            ShippingPriceConfig.warehouse_id == warehouse_id
        )
    ).first()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pricing config for warehouse '{warehouse_id}' not found"
        )

    update_data = config_in.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(config, field, value)

    config.updated_at = datetime.now(timezone.utc)
    session.add(config)
    session.commit()
    session.refresh(config)
    return config


@router.delete("/config/{warehouse_id}")
def delete_pricing_config(
    warehouse_id: str,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> None:
    """Delete a pricing configuration (admin only)."""
    if warehouse_id == "default":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the default pricing config"
        )

    config = session.exec(
        select(ShippingPriceConfig).where(
            ShippingPriceConfig.warehouse_id == warehouse_id
        )
    ).first()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pricing config for warehouse '{warehouse_id}' not found"
        )

    session.delete(config)
    session.commit()


@router.get("/zones/{warehouse_id}", response_model=dict)
def get_delivery_zones_stats(
    warehouse_id: str,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """Get delivery zone statistics for a warehouse (admin only)."""
    from sqlmodel import func

    # Combined query: get all stats in one query instead of 5 separate queries
    stats = session.exec(
        select(
            func.count(H3DeliveryZone.id),
            func.min(H3DeliveryZone.distance_km),
            func.max(H3DeliveryZone.distance_km),
            func.min(H3DeliveryZone.duration_min),
            func.max(H3DeliveryZone.duration_min)
        ).where(H3DeliveryZone.warehouse_id == warehouse_id)
    ).first()

    total_zones, min_distance, max_distance, min_duration, max_duration = stats

    return {
        "warehouse_id": warehouse_id,
        "total_zones": total_zones or 0,
        "distance_range": {
            "min_km": round(min_distance, 2) if min_distance else 0,
            "max_km": round(max_distance, 2) if max_distance else 0,
        },
        "duration_range": {
            "min_min": round(min_duration, 2) if min_duration else 0,
            "max_min": round(max_duration, 2) if max_duration else 0,
        }
    }
