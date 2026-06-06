from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel


# =============================================================================
# Company Settings (single row)
# =============================================================================

class CompanySettings(SQLModel, table=True):
    __tablename__ = "company_settings"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(default="")
    activity: Optional[str] = Field(default=None)
    address: Optional[str] = Field(default=None)
    phone: Optional[str] = Field(default=None)
    rc: Optional[str] = Field(default=None)
    na: Optional[str] = Field(default=None)
    nif: Optional[str] = Field(default=None)
    nis: Optional[str] = Field(default=None)
    email: Optional[str] = Field(default=None)


class CompanySettingsUpdate(BaseModel):
    name: Optional[str] = None
    activity: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    rc: Optional[str] = None
    na: Optional[str] = None
    nif: Optional[str] = None
    nis: Optional[str] = None
    email: Optional[str] = None


class CompanySettingsResponse(BaseModel):
    id: int
    name: str
    activity: Optional[str]
    address: Optional[str]
    phone: Optional[str]
    rc: Optional[str]
    na: Optional[str]
    nif: Optional[str]
    nis: Optional[str]
    email: Optional[str]


# =============================================================================
# Facturation
# =============================================================================

class FacturationItem(SQLModel, table=True):
    __tablename__ = "facturation_items"

    id: Optional[int] = Field(default=None, primary_key=True)
    facturation_id: int = Field(foreign_key="facturations.id", index=True)

    product_id: Optional[int] = Field(default=None, foreign_key="products.id")
    reference: str = Field(default="")
    product_name: str
    brand_name: Optional[str] = Field(default=None)
    unit: str = Field(default="U")
    pieces_per_box: int = Field(default=1)
    quantity: int = Field(default=1)
    unit_price: float = Field(default=0)   # TTC
    tva_rate: int = Field(default=19)      # 0, 9, or 19
    total_ht: float = Field(default=0)
    total_ttc: float = Field(default=0)
    image_url: Optional[str] = Field(default=None)

    facturation: "Facturation" = Relationship(back_populates="items")


class Facturation(SQLModel, table=True):
    __tablename__ = "facturations"

    id: Optional[int] = Field(default=None, primary_key=True)
    reference: str = Field(index=True, unique=True)  # F-2026-001 or BL-2026-001

    # Document type: 'facture' or 'bon_de_livraison'
    document_type: str = Field(default="facture")

    # When a BL is converted to a facture, this points to the resulting facture
    converted_to_facture_id: Optional[int] = Field(default=None, foreign_key="facturations.id")

    # Client reference (linked to users table)
    client_id: Optional[int] = Field(default=None, foreign_key="users.id")

    # Client info snapshot at time of invoice creation
    client_name: str
    client_address: Optional[str] = None
    client_rc: Optional[str] = None
    client_na: Optional[str] = None
    client_nif: Optional[str] = None
    client_nis: Optional[str] = None

    # Payment
    payment_mode: str = Field(default="espece")  # espece, cheque, virement

    # Totals
    total_ht: float = Field(default=0)
    total_tva: float = Field(default=0)
    remise: float = Field(default=0)
    timbre: float = Field(default=0)
    total_ttc: float = Field(default=0)

    notes: Optional[str] = None

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    items: List[FacturationItem] = Relationship(
        back_populates="facturation",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


# =============================================================================
# Request / Response models
# =============================================================================

class FacturationItemCreate(BaseModel):
    product_id: Optional[int] = None
    reference: str = ""
    product_name: str
    brand_name: Optional[str] = None
    unit: str = "U"
    pieces_per_box: int = 1
    quantity: int = 1
    unit_price: float = 0
    tva_rate: int = 0
    image_url: Optional[str] = None


class FacturationCreate(BaseModel):
    client_id: int          # user.id
    document_type: str = "facture"  # 'facture' or 'bon_de_livraison'
    fiscal_info: Optional[Dict[str, Any]] = None  # overrides user's fiscal_info for this invoice
    payment_mode: str = "espece"
    remise: float = 0
    timbre: float = 0
    notes: Optional[str] = None
    items: List[FacturationItemCreate]


class FacturationItemResponse(BaseModel):
    id: int
    product_id: Optional[int]
    reference: str
    product_name: str
    brand_name: Optional[str]
    unit: str
    pieces_per_box: int
    quantity: int
    unit_price: float
    tva_rate: int
    total_ht: float
    total_ttc: float
    image_url: Optional[str]


class FacturationResponse(BaseModel):
    id: int
    reference: str
    document_type: str
    converted_to_facture_id: Optional[int]
    client_id: Optional[int]
    client_name: str
    client_address: Optional[str]
    client_rc: Optional[str]
    client_na: Optional[str]
    client_nif: Optional[str]
    client_nis: Optional[str]
    payment_mode: str
    total_ht: float
    total_tva: float
    remise: float
    timbre: float
    total_ttc: float
    notes: Optional[str]
    created_at: datetime
    items: List[FacturationItemResponse] = []


class FacturationListResponse(BaseModel):
    facturations: List[FacturationResponse]
    total: int


# Client selection response (lightweight user view for invoice creation)
class FacturationClientView(BaseModel):
    id: int
    display_name: str           # store_name or full_name
    full_name: str
    store_name: Optional[str]
    address: Optional[str]
    fiscal_info: Optional[Dict[str, Any]] = None  # {rc, na, nif, nis}
