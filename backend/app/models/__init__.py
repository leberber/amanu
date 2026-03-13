# User models
from app.models.user import (
    User, UserBase, UserCreate, UserUpdate, UserRead,
    UserRole, AuthProvider, UserGroupBasic, UserGroupsUpdate
)

# User group models
from app.models.user_group import (
    UserGroup, UserGroupBase, UserGroupCreate, UserGroupUpdate, UserGroupRead,
    UserGroupLink
)

# Product models
from app.models.product import Product

# Category models
from app.models.category import Category

# Brand models
from app.models.brand import Brand

# Order models
from app.models.order import Order, OrderItem, DeliveryType

# Trip models
from app.models.trip import (
    Trip, TripStop, TripStatus, StopStatus,
    TripRead, TripWithStops, TripStopRead,
    TripCreate, TripUpdate, TripStopUpdate
)

# Driver models
from app.models.driver import (
    DriverProfile, DriverProfileBase, DriverProfileCreate,
    DriverProfileRead, DriverProfileUpdate, DriverProfileWithFlags,
    DriverProfileAdminUpdate, DriverRegister, VehicleType, DriverStatus,
    DriverStats, DriverEarning, DriverEarningsResponse
)

# Driver config models
from app.models.driver_config import (
    DriverSystemConfig, DriverSystemConfigRead, DriverSystemConfigUpdate
)

# Other models
from app.models.promotion import Promotion
from app.models.push_subscription import PushSubscription
from app.models.notification_history import NotificationHistory
from app.models.user_notification import UserNotification
from app.models.password_reset import PasswordResetToken
from app.models.email_verification import EmailVerificationToken
from app.models.restock import RestockItem

# Customer route models (for delivery optimization)
from app.models.customer_route import CustomerRoute
