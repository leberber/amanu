from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlmodel import Session, select, func, or_, and_
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from pydantic import BaseModel as PydanticBaseModel
from pydantic import BaseModel
import httpx

from app.database import get_session
from app.core.security import get_current_user
from app.models.user import User
from app.models.product import Product
from app.models.brand import Brand
from app.models.purchase_order import PurchaseOrderItem
from app.models.order import Order
from app.models.facturation import (
    CompanySettings, CompanySettingsUpdate, CompanySettingsResponse,
    Facturation, FacturationItem,
    FacturationCreate, ExternalFactureCreate,
    FacturationResponse, FacturationItemResponse,
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
    brand_name: Optional[str] = None
    facture_stock: int  # cartons received (supplier invoice) minus cartons already billed to clients
    image_url: Optional[str] = None
    facture_unit_price: float = 0.0  # most recent prix facturé per unit from purchase orders

router = APIRouter()


# =============================================================================
# Image proxy — fetches S3 images server-side to avoid browser CORS restrictions
# =============================================================================

@router.get("/image-proxy")
async def proxy_image(url: str):
    """Proxy an image URL through the backend so the PDF service can read it without CORS issues."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
        if resp.status_code != 200:
            raise HTTPException(status_code=404, detail="Image not found")
        content_type = resp.headers.get("content-type", "image/webp")
        return Response(content=resp.content, media_type=content_type)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to fetch image")


# =============================================================================
# Helpers
# =============================================================================

def generate_reference(session: Session, document_type: str = "facture") -> str:
    year = datetime.now().year
    prefix = "BL" if document_type == "bon_de_livraison" else "F"
    count = session.exec(
        select(func.count(Facturation.id)).where(
            Facturation.reference.like(f"{prefix}-{year}-%")
        )
    ).one()
    return f"{prefix}-{year}-{(count + 1):03d}"


def generate_ext_reference(session: Session, year: int) -> str:
    count = session.exec(
        select(func.count(Facturation.id)).where(
            Facturation.reference.like(f"EXT-{year}-%")
        )
    ).one()
    return f"EXT-{year}-{(count + 1):03d}"


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


def facturation_to_response(
    f: Facturation,
    session: Optional[Session] = None,
    converted_ref_map: Optional[dict[int, str]] = None,
) -> FacturationResponse:
    converted_to_facture_reference = None
    if f.converted_to_facture_id:
        if converted_ref_map is not None:
            converted_to_facture_reference = converted_ref_map.get(f.converted_to_facture_id)
        elif session:
            linked = session.get(Facturation, f.converted_to_facture_id)
            if linked:
                converted_to_facture_reference = linked.reference
    return FacturationResponse(
        id=f.id,
        reference=f.reference,
        document_type=f.document_type,
        converted_to_facture_id=f.converted_to_facture_id,
        converted_to_facture_reference=converted_to_facture_reference,
        converted_from_bl_reference=f.converted_from_bl_reference,
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
        is_external=f.is_external,
        merchant_name=f.merchant_name,
        ext_impose=f.ext_impose,
        ext_exonere=f.ext_exonere,
        created_at=f.created_at,
        items=[
            FacturationItemResponse(
                id=item.id,
                product_id=item.product_id,
                reference=item.reference,
                product_name=item.product_name,
                brand_name=item.brand_name,
                unit=item.unit,
                quantity=item.quantity,
                unit_price=item.unit_price,
                tva_rate=item.tva_rate,
                total_ht=item.total_ht,
                total_ttc=item.total_ttc,
                pieces_per_box=item.pieces_per_box,
                image_url=item.image_url,
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
        email=settings.email, timbre_tiers=settings.timbre_tiers,
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
        email=settings.email, timbre_tiers=settings.timbre_tiers,
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


class FiscalInfoUpdate(PydanticBaseModel):
    rc: Optional[str] = None
    na: Optional[str] = None
    nif: Optional[str] = None
    nis: Optional[str] = None
    montant_declare: Optional[float] = None


@router.patch("/clients/{client_id}/fiscal-info", response_model=FacturationClientView)
async def update_client_fiscal_info(
    client_id: int,
    data: FiscalInfoUpdate,
    session: Session = Depends(get_session),
):
    """Update a client's fiscal info (accessible to accountants)."""
    user = session.get(User, client_id)
    if not user:
        raise HTTPException(status_code=404, detail="Client introuvable")
    existing = user.fiscal_info or {}
    updated = {**existing, **data.model_dump(exclude_none=True)}
    user.fiscal_info = updated
    session.add(user)
    session.commit()
    session.refresh(user)
    return user_to_client_view(user)


# =============================================================================
# Catalog — products that have been received with supplier invoice
# =============================================================================

@router.get("/catalog", response_model=List[FacturationCatalogItem])
async def get_facturation_catalog(session: Session = Depends(get_session)):
    """Return all active products with their TVA rate and stock info from purchase orders."""

    # Step 1: All active products
    products = session.exec(
        select(Product).where(Product.is_active == True).order_by(Product.name)
    ).all()

    if not products:
        return []

    product_ids = [p.id for p in products]

    # Step 2+3: Single query — sum(facture_quantity) and max(facture_unit_price) per product
    po_agg_rows = session.exec(
        select(
            PurchaseOrderItem.product_id,
            func.sum(PurchaseOrderItem.facture_quantity),
            func.max(PurchaseOrderItem.facture_unit_price),
        )
        .where(PurchaseOrderItem.product_id.in_(product_ids))
        .group_by(PurchaseOrderItem.product_id)
    ).all()

    received_map: dict[int, int] = {}
    facture_price_map: dict[int, float] = {}
    for pid, total_qty, max_price in po_agg_rows:
        if total_qty:
            received_map[pid] = int(total_qty)
        if max_price and max_price > 0:
            facture_price_map[pid] = float(max_price)

    # Step 3b: Fallback — use latest PO unit_price/units_per_carton for products without facture_unit_price
    fallback_ids = [pid for pid in product_ids if pid not in facture_price_map]
    po_price_map: dict[int, float] = {}
    if fallback_ids:
        latest_ids = select(func.max(PurchaseOrderItem.id)).where(
            PurchaseOrderItem.product_id.in_(fallback_ids)
        ).group_by(PurchaseOrderItem.product_id)
        po_rows = session.exec(
            select(PurchaseOrderItem.product_id, PurchaseOrderItem.unit_price, PurchaseOrderItem.units_per_carton)
            .where(PurchaseOrderItem.id.in_(latest_ids))
        ).all()
        po_price_map = {
            pid: round((unit_price or 0) / max(1, units_per_carton or 1), 4)
            for pid, unit_price, units_per_carton in po_rows
        }

    # Step 4: Total already billed to clients per product
    invoiced_rows = session.exec(
        select(FacturationItem.product_id, func.sum(FacturationItem.quantity))
        .where(FacturationItem.product_id.in_(product_ids))
        .group_by(FacturationItem.product_id)
    ).all()
    invoiced_map = {row[0]: int(row[1] or 0) for row in invoiced_rows}

    # Step 5: Brand names
    brand_ids = list({p.brand_id for p in products if p.brand_id})
    brand_map: dict[int, str] = {}
    if brand_ids:
        brands = session.exec(select(Brand).where(Brand.id.in_(brand_ids))).all()
        brand_map = {b.id: b.name for b in brands}

    return [
        FacturationCatalogItem(
            id=p.id,
            name=p.name,
            price=p.price,
            unit=p.unit,
            packaging_type=p.packaging_type.value if p.packaging_type else None,
            pieces_per_box=p.pieces_per_box,
            tva_rate=p.tva_rate,
            category_id=p.category_id,
            brand_id=p.brand_id,
            brand_name=brand_map.get(p.brand_id) if p.brand_id else None,
            facture_stock=max(0, received_map.get(p.id, 0) - invoiced_map.get(p.id, 0)),
            image_url=p.image_url,
            facture_unit_price=facture_price_map.get(p.id) or po_price_map.get(p.id, 0.0),
        )
        for p in products
    ]


# =============================================================================
# Facturations
# =============================================================================

class ClientTotalResponse(PydanticBaseModel):
    client_id: int
    client_name: str
    total_ht: float
    total_ttc: float
    facture_count: int


@router.get("/client-totals", response_model=List[ClientTotalResponse])
async def get_client_totals(session: Session = Depends(get_session)):
    """Per-client facturation totals, sorted by total TTC descending."""
    rows = session.exec(
        select(
            Facturation.client_id,
            Facturation.client_name,
            func.sum(Facturation.total_ht).label("total_ht"),
            func.sum(Facturation.total_ttc).label("total_ttc"),
            func.count(Facturation.id).label("facture_count"),
        )
        .group_by(Facturation.client_id, Facturation.client_name)
        .order_by(func.sum(Facturation.total_ttc).desc())
    ).all()
    return [
        ClientTotalResponse(
            client_id=row[0],
            client_name=row[1],
            total_ht=round(float(row[2] or 0), 2),
            total_ttc=round(float(row[3] or 0), 2),
            facture_count=int(row[4] or 0),
        )
        for row in rows
    ]


class AccountingStatsResponse(PydanticBaseModel):
    total_ht: float
    total_ttc: float
    total_count: int
    month_ht: float
    month_ttc: float
    month_count: int
    year_ht: float
    year_ttc: float
    year_count: int


@router.get("/accounting-stats", response_model=AccountingStatsResponse)
async def get_accounting_stats(
    client_id: Optional[int] = Query(None),
    session: Session = Depends(get_session)
):
    """Aggregated facturation stats for the accounting page."""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)

    base_filter = [Facturation.client_id == client_id] if client_id else []

    def agg(extra_filters):
        row = session.exec(
            select(
                func.coalesce(func.sum(Facturation.total_ht), 0.0).label("ht"),
                func.coalesce(func.sum(Facturation.total_ttc), 0.0).label("ttc"),
                func.count(Facturation.id).label("cnt"),
            ).where(*base_filter, *extra_filters)
        ).first()
        return float(row.ht), float(row.ttc), int(row.cnt)

    total_ht, total_ttc, total_count = agg([])
    month_ht, month_ttc, month_count = agg([Facturation.created_at >= month_start])
    year_ht, year_ttc, year_count = agg([Facturation.created_at >= year_start])

    return AccountingStatsResponse(
        total_ht=round(total_ht, 2), total_ttc=round(total_ttc, 2), total_count=total_count,
        month_ht=round(month_ht, 2), month_ttc=round(month_ttc, 2), month_count=month_count,
        year_ht=round(year_ht, 2), year_ttc=round(year_ttc, 2), year_count=year_count,
    )


class FacturationDraftItem(BaseModel):
    product_id: Optional[int] = None
    product_name: str
    brand_name: Optional[str] = None
    unit: str
    pieces_per_box: int
    quantity: int               # cartons
    prix_vente_pcs: float       # HT per piece
    original_unit_price: float  # TTC per piece (from original order)
    tva_rate: int
    image_url: Optional[str] = None


class FacturationDraft(BaseModel):
    client: FacturationClientView
    items: List[FacturationDraftItem]


@router.get("/from-order/{order_id}", response_model=FacturationDraft)
async def get_facturation_draft_from_order(order_id: int, session: Session = Depends(get_session)):
    """Build a pre-filled facturation draft from a customer order."""
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    user = session.get(User, order.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    packaging_map = {
        'carton': 'Carton', 'box': 'Boîte', 'crate': 'Caisse',
        'pack': 'Pack', 'bag': 'Sac', 'bundle': 'Fardeau',
        'bottle': 'Bouteille', 'palette': 'Palette',
    }

    # Pre-load all products and brands for this order in bulk
    order_product_ids = [item.product_id for item in order.items if item.product_id]
    product_map: dict[int, Product] = {}
    brand_name_map: dict[int, str] = {}
    if order_product_ids:
        order_products = session.exec(select(Product).where(Product.id.in_(order_product_ids))).all()
        product_map = {p.id: p for p in order_products}
        order_brand_ids = list({p.brand_id for p in order_products if p.brand_id})
        if order_brand_ids:
            order_brands = session.exec(select(Brand).where(Brand.id.in_(order_brand_ids))).all()
            order_brand_map = {b.id: b.name for b in order_brands}
            brand_name_map = {p.id: order_brand_map[p.brand_id] for p in order_products if p.brand_id and p.brand_id in order_brand_map}

    draft_items = []
    for item in order.items:
        product = product_map.get(item.product_id) if item.product_id else None
        tva_rate = product.tva_rate if product else 0
        pieces_per_box = (product.pieces_per_box or 1) if product else 1
        unit = packaging_map.get(
            product.packaging_type.value if product and product.packaging_type else '', 'Carton'
        )
        # Convert pieces qty → cartons; ensure at least 1
        cartons = max(1, round(item.quantity / pieces_per_box))
        # unit_price in order is TTC per piece; back out HT
        prix_vente_pcs = item.unit_price / (1 + tva_rate / 100) if tva_rate else item.unit_price

        draft_items.append(FacturationDraftItem(
            product_id=item.product_id,
            product_name=item.product_name,
            brand_name=brand_name_map.get(item.product_id) if item.product_id else None,
            unit=unit,
            pieces_per_box=pieces_per_box,
            quantity=cartons,
            prix_vente_pcs=round(prix_vente_pcs, 4),
            original_unit_price=item.unit_price,
            tva_rate=tva_rate,
            image_url=product.image_url if product else None,
        ))

    return FacturationDraft(client=user_to_client_view(user), items=draft_items)


# =============================================================================
# My facturations — authenticated client endpoints
# =============================================================================

@router.get("/my/profile", response_model=FacturationClientView)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Return the current user's profile for the client accounting page."""
    user = session.get(User, current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user_to_client_view(user)


@router.get("/my", response_model=FacturationListResponse)
async def list_my_facturations(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Return all facturations for the currently authenticated user."""
    facturations = session.exec(
        select(Facturation)
        .where(Facturation.client_id == current_user.id)
        .order_by(Facturation.created_at.desc())
    ).all()
    total = len(facturations)
    return FacturationListResponse(
        facturations=[facturation_to_response(f, session) for f in facturations],
        total=total,
    )


@router.get("", response_model=FacturationListResponse)
async def list_facturations(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    client_id: Optional[int] = Query(None),
    from_date: Optional[datetime] = Query(None),
    to_date: Optional[datetime] = Query(None),
    session: Session = Depends(get_session)
):
    filters = []
    if client_id is not None:
        filters.append(Facturation.client_id == client_id)
    if from_date is not None:
        filters.append(Facturation.created_at >= from_date)
    if to_date is not None:
        filters.append(Facturation.created_at <= to_date)

    base_query = select(Facturation).where(*filters) if filters else select(Facturation)
    count_query = select(func.count(Facturation.id)).where(*filters) if filters else select(func.count(Facturation.id))

    total = session.exec(count_query).one()
    facturations = session.exec(
        base_query.order_by(Facturation.created_at.desc()).offset(skip).limit(limit)
    ).all()

    converted_ids = [f.converted_to_facture_id for f in facturations if f.converted_to_facture_id]
    converted_ref_map: dict[int, str] = {}
    if converted_ids:
        linked = session.exec(select(Facturation.id, Facturation.reference).where(Facturation.id.in_(converted_ids))).all()
        converted_ref_map = {f_id: ref for f_id, ref in linked}

    return FacturationListResponse(
        facturations=[facturation_to_response(f, converted_ref_map=converted_ref_map) for f in facturations],
        total=total
    )


@router.post("/external", response_model=FacturationResponse)
async def create_external_facturation(data: ExternalFactureCreate, session: Session = Depends(get_session)):
    """Add an external (other-merchant) facture entry for forfait calculations."""
    user = session.get(User, data.client_id)
    if not user:
        raise HTTPException(status_code=404, detail="Client not found")

    # Place at the 1st of the specified month so grouping works correctly
    created_at = datetime(data.year, data.month + 1, 1, tzinfo=timezone.utc)

    total_ht = round((data.ext_impose - data.total_tva) + data.ext_exonere, 2)
    total_ttc = round(data.ext_impose + data.ext_exonere + data.timbre, 2)
    reference = generate_ext_reference(session, data.year)

    f = Facturation(
        reference=reference,
        document_type="facture",
        is_external=True,
        merchant_name=data.merchant_name,
        client_id=user.id,
        client_name=user.store_name or user.full_name,
        client_address=user.address,
        payment_mode=data.payment_mode,
        ext_impose=round(data.ext_impose, 2),
        ext_exonere=round(data.ext_exonere, 2),
        total_ht=total_ht,
        total_tva=round(data.total_tva, 2),
        timbre=data.timbre,
        total_ttc=total_ttc,
        created_at=created_at,
    )
    session.add(f)
    try:
        session.commit()
        session.refresh(f)
        return facturation_to_response(f, session)
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/{facturation_id}", response_model=FacturationResponse)
async def get_facturation(facturation_id: int, session: Session = Depends(get_session)):
    f = session.get(Facturation, facturation_id)
    if not f:
        raise HTTPException(status_code=404, detail="Facturation not found")
    return facturation_to_response(f, session)


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

        # Fetch product images upfront — stored as snapshot on each item
        product_ids = [item.product_id for item in data.items if item.product_id]
        image_map = {}
        if product_ids:
            products = session.exec(select(Product).where(Product.id.in_(product_ids))).all()
            image_map = {p.id: p.image_url for p in products}

        reference = generate_reference(session, data.document_type)
        total_ht = 0.0
        total_tva = 0.0

        f = Facturation(
            reference=reference,
            document_type=data.document_type,
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
            converted_from_bl_reference=data.converted_from_bl_reference,
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
                brand_name=item_data.brand_name,
                unit=item_data.unit,
                pieces_per_box=item_data.pieces_per_box,
                quantity=item_data.quantity,
                unit_price=item_data.unit_price,
                tva_rate=item_data.tva_rate,
                total_ht=ht,
                total_ttc=total_ttc,
                image_url=image_map.get(item_data.product_id) if item_data.product_id else None,
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
        return facturation_to_response(f, session)

    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/{facturation_id}/convert", response_model=FacturationResponse)
async def convert_bl_to_facture(facturation_id: int, session: Session = Depends(get_session)):
    """Convert a bon de livraison into a real facture (new record, separate numbering)."""
    bl = session.get(Facturation, facturation_id)
    if not bl:
        raise HTTPException(status_code=404, detail="Bon de livraison introuvable")
    if bl.document_type != "bon_de_livraison":
        raise HTTPException(status_code=400, detail="Ce document n'est pas un bon de livraison")
    if bl.converted_to_facture_id:
        raise HTTPException(status_code=400, detail="Ce bon de livraison a déjà été converti en facture")

    try:
        f = Facturation(
            reference=generate_reference(session, "facture"),
            document_type="facture",
            converted_from_bl_reference=bl.reference,
            client_id=bl.client_id,
            client_name=bl.client_name,
            client_address=bl.client_address,
            client_rc=bl.client_rc,
            client_na=bl.client_na,
            client_nif=bl.client_nif,
            client_nis=bl.client_nis,
            payment_mode=bl.payment_mode,
            remise=bl.remise,
            timbre=bl.timbre,
            notes=bl.notes,
            total_ht=bl.total_ht,
            total_tva=bl.total_tva,
            total_ttc=bl.total_ttc,
        )
        session.add(f)
        session.flush()

        for bl_item in bl.items:
            session.add(FacturationItem(
                facturation_id=f.id,
                product_id=bl_item.product_id,
                reference=bl_item.reference,
                product_name=bl_item.product_name,
                brand_name=bl_item.brand_name,
                unit=bl_item.unit,
                pieces_per_box=bl_item.pieces_per_box,
                quantity=bl_item.quantity,
                unit_price=bl_item.unit_price,
                tva_rate=bl_item.tva_rate,
                total_ht=bl_item.total_ht,
                total_ttc=bl_item.total_ttc,
                image_url=bl_item.image_url,
            ))

        bl.converted_to_facture_id = f.id
        session.add(bl)
        session.commit()
        session.refresh(f)
        return facturation_to_response(f, session)

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
