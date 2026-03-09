from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime, timezone


class DriverSystemConfig(SQLModel, table=True):
    """Configurable settings for the driver system"""
    __tablename__ = "driver_system_config"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Assignment settings
    assignment_timeout_minutes: int = Field(
        default=30,
        description="Minutes before an unacknowledged assignment returns to pool"
    )
    max_active_orders_default: int = Field(
        default=3,
        description="Default maximum concurrent orders per driver"
    )

    # Cancellation settings
    max_cancellations_per_period: int = Field(
        default=3,
        description="Maximum allowed cancellations before flagging"
    )
    cancellation_period_days: int = Field(
        default=7,
        description="Days for cancellation tracking period"
    )
    auto_flag_on_max_cancellations: bool = Field(
        default=True,
        description="Automatically flag driver when max cancellations reached"
    )
    auto_suspend_on_max_cancellations: bool = Field(
        default=False,
        description="Automatically suspend driver when max cancellations reached"
    )
    suspension_duration_hours: int = Field(
        default=24,
        description="Hours to suspend driver when auto-suspended"
    )

    # Earnings settings
    base_delivery_fee: float = Field(
        default=0.0,
        description="Base fee paid to driver per delivery"
    )
    per_km_rate: float = Field(
        default=0.0,
        description="Additional rate per kilometer"
    )
    driver_commission_percent: float = Field(
        default=0.0,
        description="Percentage of delivery fee given to driver"
    )

    # System settings
    allow_driver_self_assign: bool = Field(
        default=True,
        description="Allow drivers to self-assign from pool"
    )
    require_admin_approval: bool = Field(
        default=False,
        description="Require admin approval for driver assignments"
    )
    notify_driver_on_new_order: bool = Field(
        default=True,
        description="Send notification when new order available"
    )

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)
    updated_by_id: Optional[int] = Field(default=None, foreign_key="users.id")


class DriverSystemConfigRead(SQLModel):
    """Read model for driver system config"""
    id: int
    assignment_timeout_minutes: int
    max_active_orders_default: int
    max_cancellations_per_period: int
    cancellation_period_days: int
    auto_flag_on_max_cancellations: bool
    auto_suspend_on_max_cancellations: bool
    suspension_duration_hours: int
    base_delivery_fee: float
    per_km_rate: float
    driver_commission_percent: float
    allow_driver_self_assign: bool
    require_admin_approval: bool
    notify_driver_on_new_order: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class DriverSystemConfigUpdate(SQLModel):
    """Update model for driver system config"""
    assignment_timeout_minutes: Optional[int] = None
    max_active_orders_default: Optional[int] = None
    max_cancellations_per_period: Optional[int] = None
    cancellation_period_days: Optional[int] = None
    auto_flag_on_max_cancellations: Optional[bool] = None
    auto_suspend_on_max_cancellations: Optional[bool] = None
    suspension_duration_hours: Optional[int] = None
    base_delivery_fee: Optional[float] = None
    per_km_rate: Optional[float] = None
    driver_commission_percent: Optional[float] = None
    allow_driver_self_assign: Optional[bool] = None
    require_admin_approval: Optional[bool] = None
    notify_driver_on_new_order: Optional[bool] = None
