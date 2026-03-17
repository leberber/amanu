from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func
from typing import Any, List
from datetime import datetime, timezone

from app.database import get_session
from app.models.user_group import (
    UserGroup, UserGroupCreate, UserGroupUpdate, UserGroupRead, UserGroupLink
)
from app.models.user import User
from app.core.security import get_current_staff_user

router = APIRouter()


@router.get("", response_model=List[UserGroupRead])
def read_user_groups(
    active_only: bool = Query(False),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
) -> Any:
    """
    Retrieve all user groups (staff only).
    """
    query = select(UserGroup)

    if active_only:
        query = query.where(UserGroup.is_active == True)

    query = query.order_by(UserGroup.name)
    groups = session.exec(query).all()

    if not groups:
        return []

    # Batch load user counts for all groups in one query
    group_ids = [g.id for g in groups]
    counts = session.exec(
        select(UserGroupLink.group_id, func.count(UserGroupLink.user_id))
        .where(UserGroupLink.group_id.in_(group_ids))
        .group_by(UserGroupLink.group_id)
    ).all()
    count_map = {group_id: cnt for group_id, cnt in counts}

    # Add user count for each group
    result = []
    for group in groups:
        group_dict = UserGroupRead.model_validate(group).model_dump()
        group_dict["user_count"] = count_map.get(group.id, 0)
        result.append(UserGroupRead(**group_dict))

    return result


@router.get("/{group_id}", response_model=UserGroupRead)
def read_user_group(
    group_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
) -> Any:
    """
    Get user group by ID (staff only).
    """
    group = session.get(UserGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="User group not found")

    # Add user count
    count_query = select(func.count(UserGroupLink.user_id)).where(
        UserGroupLink.group_id == group.id
    )
    user_count = session.exec(count_query).one()

    result = UserGroupRead.model_validate(group)
    result.user_count = user_count

    return result


@router.post("", response_model=UserGroupRead)
def create_user_group(
    group_in: UserGroupCreate,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Create a new user group (staff only).
    """
    # Check if name already exists
    existing = session.exec(
        select(UserGroup).where(UserGroup.name == group_in.name)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Group name already exists")

    group = UserGroup.model_validate(group_in)
    group.created_at = datetime.now(timezone.utc)

    session.add(group)
    session.commit()
    session.refresh(group)

    result = UserGroupRead.model_validate(group)
    result.user_count = 0

    return result


@router.patch("/{group_id}", response_model=UserGroupRead)
def update_user_group(
    group_id: int,
    group_in: UserGroupUpdate,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Update a user group (staff only).
    """
    group = session.get(UserGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="User group not found")

    # Check if new name already exists (if name is being changed)
    if group_in.name and group_in.name != group.name:
        existing = session.exec(
            select(UserGroup).where(UserGroup.name == group_in.name)
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Group name already exists")

    # Update fields
    update_data = group_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(group, field, value)

    group.updated_at = datetime.now(timezone.utc)

    session.add(group)
    session.commit()
    session.refresh(group)

    # Add user count
    count_query = select(func.count(UserGroupLink.user_id)).where(
        UserGroupLink.group_id == group.id
    )
    user_count = session.exec(count_query).one()

    result = UserGroupRead.model_validate(group)
    result.user_count = user_count

    return result


@router.delete("/{group_id}")
def delete_user_group(
    group_id: int,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Delete a user group (staff only).
    This will also remove all user associations with this group.
    """
    group = session.get(UserGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="User group not found")

    # Delete all user-group links first
    links = session.exec(
        select(UserGroupLink).where(UserGroupLink.group_id == group_id)
    ).all()
    for link in links:
        session.delete(link)

    # Delete the group
    session.delete(group)
    session.commit()

    return {"message": "User group deleted successfully"}


@router.get("/{group_id}/users", response_model=List[int])
def get_group_users(
    group_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
) -> Any:
    """
    Get all user IDs in a group (staff only).
    """
    group = session.get(UserGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="User group not found")

    links = session.exec(
        select(UserGroupLink.user_id).where(UserGroupLink.group_id == group_id)
    ).all()

    return links
