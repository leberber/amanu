from typing import Any, List
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlmodel import Session, select, func
from pydantic import BaseModel

from app.database import get_session
from app.models.user import User, UserUpdate, UserRead, UserRole, UserGroupsUpdate, UserGroupBasic
from app.models.user_group import UserGroup, UserGroupLink
from app.core.security import (
    get_current_user,
    get_current_active_user,
    get_current_admin_user,
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
    current_user: User = Depends(get_current_admin_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Retrieve users (admin only).
    """
    # Get total count
    total = session.exec(select(func.count()).select_from(User)).first()

    # Get users with pagination
    users = session.exec(select(User).offset(skip).limit(limit)).all()

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

    # Add groups to each user
    users_with_groups = []
    for user in users:
        user_dict = UserRead.model_validate(user).model_dump()
        user_dict["groups"] = user_groups_map.get(user.id, [])
        users_with_groups.append(UserRead(**user_dict))

    # Return structured response
    return UsersResponse(users=users_with_groups, total=total)

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

    # Only admin can view other users
    if user.id != current_user.id and current_user.role != UserRole.ADMIN:
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
    current_user: User = Depends(get_current_admin_user),
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
    current_user: User = Depends(get_current_admin_user),
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
    current_user: User = Depends(get_current_admin_user),
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
    
    session.delete(user)
    session.commit()
    return None


@router.get("/{user_id}/groups", response_model=List[UserGroupBasic])
def get_user_groups(
    user_id: int,
    current_user: User = Depends(get_current_admin_user),
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
    current_user: User = Depends(get_current_admin_user),
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