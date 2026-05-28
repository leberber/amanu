from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func, or_
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_session
from app.models.user import User
from app.models.product import Product
from app.models.purchase_order import PurchaseOrderItem
from app.models.facturation import (
    CompanySettings, CompanySettingsUpdate, CompanySettingsResponse,
    Facturation, FacturationItem,
    FacturationCreate, FacturationResponse, FacturationItemResponse,
    FacturationListResponse, FacturationClientView
)


class FacturationCatalogItem(BaseModel):
    id: int
    name: str
    price: float
    unit: str
    packaging_type: Optional[str]
    pieces_per_box: Optional[int]
    tva_rate: int
    category_id: Optional[int]
    brand_id: Optional[int]
    facture_stock: int  # cartons received (supplier invoice) minus cartons already billed to clients
    image_url: Optional[str] = None

router = APIRouter()


# =============================================================================
# Helpers
# =============================================================================

def generate_reference(session: Session) -> str:
    year = datetime.now().year
    count = session.exec(
        select(func.count(Facturation.id)).where(
            Facturation.reference.like(f"F-{year}-%")
        )
    ).one()
    return f"F-{year}-{(count + 1):03d}"


def calc_ht(unit_price: float, quantity: int, tva_rate: int) -> float:
    total_ttc = unit_price * quantity
    if tva_rate == 0:
        return round(total_ttc, 2)
    return round(total_ttc / (1 + tva_rate / 100), 2)


def user_to_client_view(u: User) -> FacturationClientView:
    display_name = u.store_name or u.full_name
    return FacturationClientView(
        id=u.id,
        display_name=display_name,
        full_name=u.full_name,
        store_name=u.store_name,
        address=u.address,
        fiscal_info=u.fiscal_info,
    )


def facturation_to_response(f: Facturation) -> FacturationResponse:
    return FacturationResponse(
        id=f.id,
        reference=f.reference,
        client_id=f.client_id,
        client_name=f.client_name,
        client_address=f.client_address,
        client_rc=f.client_rc,
        client_na=f.client_na,
        client_nif=f.client_nif,
        client_nis=f.client_nis,
        payment_mode=f.payment_mode,
        total_ht=f.total_ht,
        total_tva=f.total_tva,
        remise=f.remise,
        timbre=f.timbre,
        total_ttc=f.total_ttc,
        notes=f.notes,
        created_at=f.created_at,
        items=[
            FacturationItemResponse(
                id=item.id,
                product_id=item.product_id,
                reference=item.reference,
                product_name=item.product_name,
                unit=item.unit,
                quantity=item.quantity,
                unit_price=item.unit_price,
                tva_rate=item.tva_rate,
                total_ht=item.total_ht,
                total_ttc=item.total_ttc,
            )
            for item in f.items
        ]
    )


# =============================================================================
# Company Settings
# =============================================================================

@router.get("/company-settings", response_model=CompanySettingsResponse)
async def get_company_settings(session: Session = Depends(get_session)):
    settings = session.exec(select(CompanySettings)).first()
    if not settings:
        settings = CompanySettings(name="Mon Entreprise")
        session.add(settings)
        session.commit()
        session.refresh(settings)
    return CompanySettingsResponse(
        id=settings.id, name=settings.name, activity=settings.activity,
        address=settings.address, phone=settings.phone,
        rc=settings.rc, na=settings.na, nif=settings.nif, nis=settings.nis,
    )


@router.put("/company-settings", response_model=CompanySettingsResponse)
async def update_company_settings(data: CompanySettingsUpdate, session: Session = Depends(get_session)):
    settings = session.exec(select(CompanySettings)).first()
    if not settings:
        settings = CompanySettings(name="")
        session.add(settings)
        session.flush()
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(settings, field, value)
    session.add(settings)
    session.commit()
    session.refresh(settings)
    return CompanySettingsResponse(
        id=settings.id, name=settings.name, activity=settings.activity,
        address=settings.address, phone=settings.phone,
        rc=settings.rc, na=settings.na, nif=settings.nif, nis=settings.nis,
    )


# =============================================================================
# Clients — users selectable for invoicing  (must be before /{facturation_id})
# =============================================================================

@router.get("/clients", response_model=List[FacturationClientView])
async def list_invoice_clients(
    search: str = Query("", description="Search by name or store name"),
    session: Session = Depends(get_session)
):
    """Return users who can be invoiced (customers + staff/admin with store info)."""
    query = select(User).where(User.is_active == True).order_by(User.store_name, User.full_name)
    if search:
        q = f"%{search}%"
        query = query.where(
            or_(User.full_name.ilike(q), User.store_name.ilike(q))
        )
    users = session.exec(query).all()
    return [user_to_client_view(u) for u in users]


# =============================================================================
# Catalog — products that have been received with supplier invoice
# =============================================================================

@router.get("/catalog", response_model=List[FacturationCatalogItem])
async def get_facturation_catalog(session: Session = Depends(get_session)):
    """Return products that have facture_quantity > 0 in any purchase order,
    with their remaining cartons to invoice and TVA rate from deliveries."""

    # Step 1: Aggregate per product from purchase order items
    received_rows = session.exec(
        select(
            PurchaseOrderItem.product_id,
            func.sum(PurchaseOrderItem.facture_quantity),
            func.max(PurchaseOrderItem.tva_rate)
        )
        .where(
            PurchaseOrderItem.product_id != None,
            PurchaseOrderItem.facture_quantity > 0
        )
        .group_by(PurchaseOrderItem.product_id)
    ).all()

    if not received_rows:
        return []

    received_map = {row[0]: int(row[1] or 0) for row in received_rows}
    tva_map = {row[0]: int(row[2] or 0) for row in received_rows}
    product_ids = list(received_map.keys())

    # Step 2: Get the actual products
    products = session.exec(
        select(Product).where(Product.id.in_(product_ids)).order_by(Product.name)
    ).all()

    # Step 3: Total already billed to clients per product
    invoiced_rows = session.exec(
        select(FacturationItem.product_id, func.sum(FacturationItem.quantity))
        .where(FacturationItem.product_id.in_(product_ids))
        .group_by(FacturationItem.product_id)
    ).all()
    invoiced_map = {row[0]: int(row[1] or 0) for row in invoiced_rows}

    return [
        FacturationCatalogItem(
            id=p.id,
            name=p.name,
            price=p.price,
            unit=p.unit,
            packaging_type=p.packaging_type.value if p.packaging_type else None,
            pieces_per_box=p.pieces_per_box,
            tva_rate=tva_map.get(p.id, 0),
            category_id=p.category_id,
            brand_id=p.brand_id,
            facture_stock=max(0, received_map.get(p.id, 0) - invoiced_map.get(p.id, 0)),
            image_url=p.image_url,
        )
        for p in products
    ]


# =============================================================================
# Facturations
# =============================================================================

@router.get("", response_model=FacturationListResponse)
async def list_facturations(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    session: Session = Depends(get_session)
):
    total = session.exec(select(func.count(Facturation.id))).one()
    facturations = session.exec(
        select(Facturation).order_by(Facturation.created_at.desc()).offset(skip).limit(limit)
    ).all()
    return FacturationListResponse(
        facturations=[facturation_to_response(f) for f in facturations],
        total=total
    )


@router.get("/{facturation_id}", response_model=FacturationResponse)
async def get_facturation(facturation_id: int, session: Session = Depends(get_session)):
    f = session.get(Facturation, facturation_id)
    if not f:
        raise HTTPException(status_code=404, detail="Facturation not found")
    return facturation_to_response(f)


@router.post("", response_model=FacturationResponse)
async def create_facturation(data: FacturationCreate, session: Session = Depends(get_session)):
    try:
        user = session.get(User, data.client_id)
        if not user:
            raise HTTPException(status_code=404, detail="Client not found")

        # Use provided fiscal_info or fall back to user's saved fiscal_info
        fiscal = data.fiscal_info or user.fiscal_info or {}

        # If fiscal_info was provided and differs, save it back to the user
        if data.fiscal_info and data.fiscal_info != user.fiscal_info:
            user.fiscal_info = data.fiscal_info
            session.add(user)

        reference = generate_reference(session)
        total_ht = 0.0
        total_tva = 0.0

        f = Facturation(
            reference=reference,
            client_id=user.id,
            client_name=user.store_name or user.full_name,
            client_address=user.address,
            client_rc=fiscal.get("rc"),
            client_na=fiscal.get("na"),
            client_nif=fiscal.get("nif"),
            client_nis=fiscal.get("nis"),
            payment_mode=data.payment_mode,
            remise=data.remise,
            timbre=data.timbre,
            notes=data.notes,
        )
        session.add(f)
        session.flush()

        for item_data in data.items:
            total_ttc = round(item_data.unit_price * item_data.quantity, 2)
            ht = calc_ht(item_data.unit_price, item_data.quantity, item_data.tva_rate)
            tva = round(total_ttc - ht, 2)

            item = FacturationItem(
                facturation_id=f.id,
                product_id=item_data.product_id,
                reference=item_data.reference,
                product_name=item_data.product_name,
                unit=item_data.unit,
                quantity=item_data.quantity,
                unit_price=item_data.unit_price,
                tva_rate=item_data.tva_rate,
                total_ht=ht,
                total_ttc=total_ttc,
            )
            session.add(item)
            total_ht += ht
            total_tva += tva

        f.total_ht = round(total_ht, 2)
        f.total_tva = round(total_tva, 2)
        f.total_ttc = round(total_ht + total_tva - data.remise + data.timbre, 2)

        session.add(f)
        session.commit()
        session.refresh(f)
        return facturation_to_response(f)

    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=422, detail=str(e))


@router.delete("/{facturation_id}")
async def delete_facturation(facturation_id: int, session: Session = Depends(get_session)):
    f = session.get(Facturation, facturation_id)
    if not f:
        raise HTTPException(status_code=404, detail="Facturation not found")
    try:
        session.delete(f)
        session.commit()
        return {"success": True}
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=422, detail=str(e))
