from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from typing import Any, List
from datetime import datetime, timezone

from app.database import get_session
from app.models.supplier import Supplier, SupplierCreate, SupplierUpdate, SupplierRead
from app.models.user import User
from app.core.security import get_current_staff_user

router = APIRouter()


@router.get("", response_model=List[SupplierRead])
def read_suppliers(
    active_only: bool = Query(True),
    session: Session = Depends(get_session),
) -> Any:
    """
    Retrieve all suppliers.
    """
    query = select(Supplier)

    if active_only:
        query = query.where(Supplier.is_active == True)

    # Order by name
    query = query.order_by(Supplier.name)

    suppliers = session.exec(query).all()
    return suppliers


@router.get("/{supplier_id}", response_model=SupplierRead)
def read_supplier(
    supplier_id: int,
    session: Session = Depends(get_session),
) -> Any:
    """
    Get supplier by ID.
    """
    supplier = session.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(
            status_code=404,
            detail="Supplier not found",
        )
    return supplier


@router.post("", response_model=SupplierRead)
def create_supplier(
    supplier_in: SupplierCreate,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Create a new supplier (staff only).
    """
    supplier = Supplier.model_validate(supplier_in)
    supplier.created_at = datetime.now(timezone.utc)

    session.add(supplier)
    session.commit()
    session.refresh(supplier)
    return supplier


@router.patch("/{supplier_id}", response_model=SupplierRead)
def update_supplier(
    supplier_id: int,
    supplier_in: SupplierUpdate,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Update a supplier (staff only).
    """
    supplier = session.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(
            status_code=404,
            detail="Supplier not found",
        )

    # Update fields
    update_data = supplier_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(supplier, field, value)

    supplier.updated_at = datetime.now(timezone.utc)

    session.add(supplier)
    session.commit()
    session.refresh(supplier)
    return supplier


@router.delete("/{supplier_id}")
def delete_supplier(
    supplier_id: int,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Delete a supplier (staff only).
    Mark as inactive if related data exists.
    """
    supplier = session.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(
            status_code=404,
            detail="Supplier not found",
        )

    # For now, just mark as inactive to preserve data integrity
    # In the future, could check for related purchase orders
    supplier.is_active = False
    supplier.updated_at = datetime.now(timezone.utc)
    session.add(supplier)
    session.commit()

    return None
