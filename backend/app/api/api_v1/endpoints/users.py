from typing import Any, List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlmodel import Session, select, func
from sqlalchemy import or_, update, case
from pydantic import BaseModel

from app.database import get_session
from app.models.user import User, UserUpdate, UserRead, UserRole, UserGroupsUpdate, UserGroupBasic
from app.models.push_subscription import PushSubscription
from app.models.order import OrderStatus, OrderItem
from app.models.product import Product
from app.models.user_group import UserGroup, UserGroupLink
from app.models.segment import UserSegment, SegmentRead
from pydantic import BaseModel as PydanticBaseModel

class UserSegmentsUpdate(PydanticBaseModel):
    segment_ids: list[int]
from app.models.order import Order
from app.models.trip import Trip
from app.models.driver import Driver, DriverVehicle
from app.core.security import (
    get_current_user,
    get_current_active_user,
    get_current_admin_user,
    get_current_staff_user,
    get_password_hash,
)
from app.core.geo import lat_lng_to_h3
from app.services.email import send_store_password_email

router = APIRouter()

# Add response model for paginated users
class UsersResponse(BaseModel):
    users: List[UserRead]
    total: int

@router.get("/me", response_model=UserRead)
def read_user_me(
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Get current user.
    """
    return current_user

@router.patch("/me", response_model=UserRead)
def update_user_me(
    user_in: UserUpdate,
    current_user: User = Depends(get_current_user),  # Allow inactive users to complete their profile
    session: Session = Depends(get_session),
) -> Any:
    """
    Update own user information.
    """
    # Ensure user can't update their own role
    if user_in.role is not None:
        raise HTTPException(
            status_code=400,
            detail="Changing your own role is not allowed",
        )

    # Update user fields
    update_data = user_in.model_dump(exclude_unset=True)

    # Handle password update
    if "password" in update_data:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))

    # Calculate H3 index if coordinates are being updated
    new_lat = update_data.get("latitude", current_user.latitude)
    new_lng = update_data.get("longitude", current_user.longitude)
    if "latitude" in update_data or "longitude" in update_data:
        update_data["h3_index"] = lat_lng_to_h3(new_lat, new_lng)

    # Apply updates
    for field, value in update_data.items():
        setattr(current_user, field, value)

    current_user.updated_at = datetime.now(timezone.utc)

    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return current_user

def get_user_groups_for_user(user_id: int, session: Session) -> List[UserGroupBasic]:
    """Helper function to get groups for a user."""
    links = session.exec(
        select(UserGroupLink).where(UserGroupLink.user_id == user_id)
    ).all()
    if not links:
        return []

    # Batch load all groups
    group_ids = [link.group_id for link in links]
    groups_list = session.exec(select(UserGroup).where(UserGroup.id.in_(group_ids))).all()
    groups_map = {g.id: g for g in groups_list}

    groups = []
    for link in links:
        group = groups_map.get(link.group_id)
        if group:
            groups.append(UserGroupBasic(id=group.id, name=group.name, color=group.color))
    return groups


@router.get("", response_model=UsersResponse)
def read_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Retrieve users (admin only).
    """
    base_query = select(User)
    count_query = select(func.count()).select_from(User)

    if search:
        search_filter = or_(
            User.full_name.ilike(f"%{search}%"),
            User.email.ilike(f"%{search}%"),
            User.phone.ilike(f"%{search}%"),
        )
        base_query = base_query.where(search_filter)
        count_query = count_query.where(search_filter)

    # Get total count
    total = session.exec(count_query).first()

    # Get users with pagination
    users = session.exec(base_query.offset(skip).limit(limit)).all()

    if not users:
        return UsersResponse(users=[], total=total)

    # Batch load all user group links for these users
    user_ids = [u.id for u in users]
    links = session.exec(
        select(UserGroupLink).where(UserGroupLink.user_id.in_(user_ids))
    ).all()

    # Batch load all referenced groups
    group_ids = {link.group_id for link in links}
    groups_map = {}
    if group_ids:
        groups = session.exec(select(UserGroup).where(UserGroup.id.in_(group_ids))).all()
        groups_map = {g.id: g for g in groups}

    # Build user_id -> groups mapping
    user_groups_map = {}
    for link in links:
        if link.user_id not in user_groups_map:
            user_groups_map[link.user_id] = []
        group = groups_map.get(link.group_id)
        if group:
            user_groups_map[link.user_id].append(
                UserGroupBasic(id=group.id, name=group.name, color=group.color)
            )

    # Compute remaining balance per user in one aggregate query
    outstanding_expr = case(
        (
            Order.total_amount + func.coalesce(Order.shipping_cost, 0.0) - func.coalesce(Order.total_paid, 0.0) > 0,
            Order.total_amount + func.coalesce(Order.shipping_cost, 0.0) - func.coalesce(Order.total_paid, 0.0)
        ),
        else_=0.0
    )
    balance_rows = session.exec(
        select(Order.user_id, func.sum(outstanding_expr).label('remaining_balance'))
        .where(Order.user_id.in_(user_ids), Order.status != OrderStatus.CANCELLED)
        .group_by(Order.user_id)
    ).all()
    balance_map = {row[0]: row[1] for row in balance_rows}

    # Batch load push subscription presence per user
    push_rows = session.exec(
        select(PushSubscription.user_id, func.count(PushSubscription.id).label('cnt'))
        .where(PushSubscription.user_id.in_(user_ids))
        .group_by(PushSubscription.user_id)
    ).all()
    push_map = {row[0]: row[1] > 0 for row in push_rows}

    # Batch load segment links for these users
    seg_links = session.exec(
        select(UserSegment).where(UserSegment.user_id.in_(user_ids))
    ).all()
    user_segments_map: dict = {}
    for link in seg_links:
        user_segments_map.setdefault(link.user_id, []).append(link.segment_id)

    # Add groups, balance, push status, and segments to each user
    users_with_groups = []
    for user in users:
        user_dict = UserRead.model_validate(user).model_dump()
        user_dict["groups"] = user_groups_map.get(user.id, [])
        user_dict["remaining_balance"] = balance_map.get(user.id, 0.0)
        user_dict["has_push"] = push_map.get(user.id, False)
        user_dict["segment_ids"] = user_segments_map.get(user.id, [])
        users_with_groups.append(UserRead(**user_dict))

    # Return structured response
    return UsersResponse(users=users_with_groups, total=total)

class AdminUserCreate(BaseModel):
    email: str
    password: str
    full_name: str
    phone: Optional[str] = None
    store_name: Optional[str] = None
    address: Optional[str] = None
    role: str = "customer"


@router.post("", response_model=UserRead)
def admin_create_user(
    user_in: AdminUserCreate,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """Admin: Create a new active user account."""
    existing = session.exec(select(User).where(User.email == user_in.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="The user with this email already exists.")

    new_user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        phone=user_in.phone or None,
        store_name=user_in.store_name or None,
        address=user_in.address,
        role=user_in.role,
        is_active=True,
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    return new_user


@router.get("/{user_id}", response_model=UserRead)
def read_user_by_id(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get a specific user by id.
    """
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    # Only admin/staff can view other users
    if user.id != current_user.id and current_user.role not in [UserRole.ADMIN, UserRole.STAFF]:
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    # Add groups to user response
    user_dict = UserRead.model_validate(user).model_dump()
    user_dict["groups"] = get_user_groups_for_user(user.id, session)

    return UserRead(**user_dict)

@router.patch("/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    user_in: UserUpdate,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Update a user (admin only).
    """
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    # Update user fields
    update_data = user_in.model_dump(exclude_unset=True)

    # Staff cannot change roles — only admins can
    if current_user.role != UserRole.ADMIN:
        update_data.pop("role", None)

    # Handle password update
    if "password" in update_data:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))

    # Calculate H3 index if coordinates are being updated
    new_lat = update_data.get("latitude", user.latitude)
    new_lng = update_data.get("longitude", user.longitude)
    if "latitude" in update_data or "longitude" in update_data:
        update_data["h3_index"] = lat_lng_to_h3(new_lat, new_lng)

    # Apply updates
    for field, value in update_data.items():
        setattr(user, field, value)

    user.updated_at = datetime.now(timezone.utc)

    session.add(user)
    session.commit()
    session.refresh(user)
    return user

class SetPasswordRequest(BaseModel):
    password: str


@router.post("/{user_id}/set-password", response_model=UserRead)
async def set_user_password(
    user_id: int,
    data: SetPasswordRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """Set password for a user and notify them by email (admin only)."""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = get_password_hash(data.password)
    user.updated_at = datetime.now(timezone.utc)
    session.add(user)
    session.commit()
    session.refresh(user)

    name = user.store_name or user.full_name or user.email
    background_tasks.add_task(send_store_password_email, user.email, name, data.password)

    return user


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> None:
    """
    Delete a user (admin only).
    """
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )
    
    # Prevent self-deletion
    if user.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete your own user account",
        )
    
    # Unassign any orders/trips where this user was the driver
    session.exec(update(Order).where(Order.driver_id == user_id).values(driver_id=None))
    session.exec(update(Trip).where(Trip.driver_id == user_id).values(driver_id=None))
    session.exec(update(Trip).where(Trip.suggested_driver_id == user_id).values(suggested_driver_id=None))

    # Explicitly delete driver vehicles and driver profile (cascade not reliable)
    driver = session.exec(select(Driver).where(Driver.user_id == user_id)).first()
    if driver:
        vehicles = session.exec(select(DriverVehicle).where(DriverVehicle.driver_id == driver.id)).all()
        for v in vehicles:
            session.delete(v)
        session.flush()
        session.delete(driver)
        session.flush()

    session.delete(user)
    session.commit()
    return None


@router.get("/{user_id}/groups", response_model=List[UserGroupBasic])
def get_user_groups(
    user_id: int,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get groups for a specific user (admin only).
    """
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get user's groups via the link table
    links = session.exec(
        select(UserGroupLink).where(UserGroupLink.user_id == user_id)
    ).all()

    if not links:
        return []

    # Batch load all groups
    group_ids = [link.group_id for link in links]
    groups_list = session.exec(select(UserGroup).where(UserGroup.id.in_(group_ids))).all()
    groups_map = {g.id: g for g in groups_list}

    groups = []
    for link in links:
        group = groups_map.get(link.group_id)
        if group:
            groups.append(UserGroupBasic(id=group.id, name=group.name, color=group.color))

    return groups


@router.put("/{user_id}/groups", response_model=List[UserGroupBasic])
def update_user_groups(
    user_id: int,
    groups_in: UserGroupsUpdate,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Update groups for a specific user (admin only).
    This replaces all existing group assignments.
    """
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Batch load all groups to validate they exist
    groups_list = session.exec(
        select(UserGroup).where(UserGroup.id.in_(groups_in.group_ids))
    ).all()
    groups_map = {g.id: g for g in groups_list}

    # Validate all group IDs exist
    for group_id in groups_in.group_ids:
        if group_id not in groups_map:
            raise HTTPException(status_code=400, detail=f"Group with ID {group_id} not found")

    # Remove all existing group links for this user
    existing_links = session.exec(
        select(UserGroupLink).where(UserGroupLink.user_id == user_id)
    ).all()
    for link in existing_links:
        session.delete(link)

    # Add new group links
    for group_id in groups_in.group_ids:
        link = UserGroupLink(user_id=user_id, group_id=group_id)
        session.add(link)

    session.commit()

    # Return updated groups using pre-loaded map
    groups = []
    for group_id in groups_in.group_ids:
        group = groups_map.get(group_id)
        if group:
            groups.append(UserGroupBasic(id=group.id, name=group.name, color=group.color))

    return groups


@router.get("/{user_id}/segments", response_model=List[int])
def get_user_segments(
    user_id: int,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    links = session.exec(select(UserSegment).where(UserSegment.user_id == user_id)).all()
    return [l.segment_id for l in links]


class UserDailyActivity(BaseModel):
    date: str
    order_count: int
    revenue: float


class UserTopProduct(BaseModel):
    product_id: int
    product_name: str
    pieces_per_box: Optional[int]
    packaging_type: Optional[str]
    quantity: float
    revenue: float
    order_count: int


class UserAnalyticsSummary(BaseModel):
    total_orders: int
    total_spent: float
    avg_order_value: float
    unique_products: int
    avg_days_between_orders: Optional[float]
    first_order_date: Optional[str]
    last_order_date: Optional[str]


class UserAnalyticsResponse(BaseModel):
    user_id: int
    user_name: str
    daily_activity: List[UserDailyActivity]
    top_products: List[UserTopProduct]
    summary: UserAnalyticsSummary


@router.get("/{user_id}/analytics", response_model=UserAnalyticsResponse)
def get_user_analytics(
    user_id: int,
    from_date: Optional[datetime] = Query(None, description="Start date (ISO 8601)"),
    to_date: Optional[datetime] = Query(None, description="End date (ISO 8601)"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
) -> Any:
    """Purchase analytics for a specific user (staff only)."""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    conditions = [
        Order.user_id == user_id,
        Order.status != OrderStatus.CANCELLED,
    ]
    if from_date:
        conditions.append(Order.created_at >= from_date)
    if to_date:
        conditions.append(Order.created_at <= to_date)

    # Daily activity
    daily_q = (
        select(
            func.date(Order.created_at).label('activity_date'),
            func.count(Order.id.distinct()).label('order_count'),
            func.sum(Order.total_amount).label('revenue'),
        )
        .where(*conditions)
        .group_by(func.date(Order.created_at))
        .order_by(func.date(Order.created_at))
    )
    daily_rows = session.execute(daily_q).all()

    # Top products
    item_conditions = [
        Order.user_id == user_id,
        Order.status != OrderStatus.CANCELLED,
        OrderItem.order_id == Order.id,
    ]
    if from_date:
        item_conditions.append(Order.created_at >= from_date)
    if to_date:
        item_conditions.append(Order.created_at <= to_date)

    products_q = (
        select(
            OrderItem.product_id,
            OrderItem.product_name,
            Product.pieces_per_box,
            Product.packaging_type,
            func.sum(OrderItem.quantity).label('quantity'),
            func.sum(OrderItem.quantity * OrderItem.unit_price).label('revenue'),
            func.count(Order.id.distinct()).label('order_count'),
        )
        .select_from(OrderItem)
        .join(Order, Order.id == OrderItem.order_id)
        .outerjoin(Product, Product.id == OrderItem.product_id)
        .where(*item_conditions)
        .group_by(OrderItem.product_id, OrderItem.product_name, Product.pieces_per_box, Product.packaging_type)
        .order_by(func.sum(OrderItem.quantity).desc())
    )
    product_rows = sorted(session.execute(products_q).all(), key=lambda r: float(r.quantity), reverse=True)

    # Summary
    summary_q = (
        select(
            func.count(Order.id.distinct()).label('total_orders'),
            func.coalesce(func.sum(Order.total_amount), 0).label('total_spent'),
            func.min(Order.created_at).label('first_order'),
            func.max(Order.created_at).label('last_order'),
        )
        .where(*conditions)
    )
    summary_row = session.execute(summary_q).first()

    total_orders = int(summary_row.total_orders) if summary_row else 0
    total_spent = float(summary_row.total_spent) if summary_row else 0.0
    avg_order_value = round(total_spent / total_orders, 2) if total_orders > 0 else 0.0
    unique_products = len(set(r.product_id for r in product_rows))

    # Average days between orders
    avg_days = None
    if total_orders > 1 and summary_row and summary_row.first_order and summary_row.last_order:
        span = (summary_row.last_order - summary_row.first_order).days
        avg_days = round(span / (total_orders - 1), 1)

    return UserAnalyticsResponse(
        user_id=user_id,
        user_name=user.full_name or f"Client #{user_id}",
        daily_activity=[
            UserDailyActivity(
                date=str(r.activity_date),
                order_count=int(r.order_count),
                revenue=float(r.revenue),
            )
            for r in daily_rows
        ],
        top_products=[
            UserTopProduct(
                product_id=r.product_id,
                product_name=r.product_name,
                pieces_per_box=r.pieces_per_box,
                packaging_type=r.packaging_type,
                quantity=float(r.quantity),
                revenue=float(r.revenue),
                order_count=int(r.order_count),
            )
            for r in product_rows
        ],
        summary=UserAnalyticsSummary(
            total_orders=total_orders,
            total_spent=total_spent,
            avg_order_value=avg_order_value,
            unique_products=unique_products,
            avg_days_between_orders=avg_days,
            first_order_date=str(summary_row.first_order.date()) if summary_row and summary_row.first_order else None,
            last_order_date=str(summary_row.last_order.date()) if summary_row and summary_row.last_order else None,
        ),
    )


@router.put("/{user_id}/segments", response_model=List[int])
def update_user_segments(
    user_id: int,
    segments_in: UserSegmentsUpdate,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = session.exec(select(UserSegment).where(UserSegment.user_id == user_id)).all()
    for link in existing:
        session.delete(link)

    for segment_id in segments_in.segment_ids:
        session.add(UserSegment(user_id=user_id, segment_id=segment_id))

    session.commit()
    return segments_in.segment_ids