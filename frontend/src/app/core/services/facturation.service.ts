import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface FacturationCatalogItem {
  id: number;
  name: string;
  price: number;
  unit: string;
  packaging_type?: string;
  pieces_per_box?: number;
  tva_rate: number;
  category_id?: number;
  brand_id?: number;
  brand_name?: string;
  facture_stock: number;
  image_url?: string;
  facture_unit_price: number;
}

// Lightweight user view for client selection in invoice creation
export interface FacturationClient {
  id: number;
  display_name: string;   // store_name or full_name
  full_name: string;
  store_name?: string;
  address?: string;
  fiscal_info?: {
    rc?: string;
    na?: string;
    nif?: string;
    nis?: string;
    montant_declare?: number;
  };
}

export interface TimbreTier {
  max: number | null;  // null = unbounded (last tier)
  rate: number;        // percentage, e.g. 1 = 1%, 1.5 = 1.5%
}

export interface CompanySettings {
  id: number;
  name: string;
  activity?: string;
  address?: string;
  phone?: string;
  rc?: string;
  na?: string;
  nif?: string;
  nis?: string;
  email?: string;
  timbre_tiers?: TimbreTier[];
}

export interface CompanySettingsUpdate {
  name?: string;
  activity?: string;
  address?: string;
  phone?: string;
  rc?: string;
  na?: string;
  nif?: string;
  nis?: string;
  email?: string;
  timbre_tiers?: TimbreTier[];
}

export interface FacturationItemCreate {
  product_id?: number;
  reference: string;
  product_name: string;
  brand_name?: string;
  unit: string;
  pieces_per_box: number;
  quantity: number;
  unit_price: number;
  tva_rate: number;
  image_url?: string;
}

export interface FacturationCreate {
  client_id: number;
  document_type: 'facture' | 'bon_de_livraison';
  fiscal_info?: { rc?: string; na?: string; nif?: string; nis?: string; montant_declare?: number };
  payment_mode: string;
  remise: number;
  timbre: number;
  notes?: string;
  converted_from_bl_reference?: string;
  items: FacturationItemCreate[];
}

export interface FacturationItem {
  id: number;
  product_id?: number;
  reference: string;
  product_name: string;
  brand_name?: string;
  unit: string;
  pieces_per_box: number;
  quantity: number;
  unit_price: number;
  tva_rate: number;
  total_ht: number;
  total_ttc: number;
  image_url?: string;
}

export interface Facturation {
  id: number;
  reference: string;
  document_type: 'facture' | 'bon_de_livraison';
  converted_to_facture_id?: number;
  converted_to_facture_reference?: string;
  converted_from_bl_reference?: string;
  client_id?: number;
  client_name: string;
  client_address?: string;
  client_rc?: string;
  client_na?: string;
  client_nif?: string;
  client_nis?: string;
  payment_mode: string;
  total_ht: number;
  total_tva: number;
  remise: number;
  timbre: number;
  total_ttc: number;
  notes?: string;
  created_at: string;
  items: FacturationItem[];
}

export interface FacturationDraftItem {
  product_id?: number;
  product_name: string;
  brand_name?: string;
  unit: string;
  pieces_per_box: number;
  quantity: number;
  prix_vente_pcs: number;
  original_unit_price: number;
  tva_rate: number;
  image_url?: string;
}

export interface FacturationDraft {
  client: FacturationClient;
  items: FacturationDraftItem[];
}

export interface FacturationListResponse {
  facturations: Facturation[];
  total: number;
}

export interface ClientTotal {
  client_id: number;
  client_name: string;
  total_ht: number;
  total_ttc: number;
  facture_count: number;
}

export interface AccountingStats {
  total_ht: number;
  total_ttc: number;
  total_count: number;
  month_ht: number;
  month_ttc: number;
  month_count: number;
  year_ht: number;
  year_ttc: number;
  year_count: number;
}

@Injectable({
  providedIn: 'root'
})
export class FacturationService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/facturation`;

  // ── Catalog ──────────────────────────────────────────────────────────────────
  getCatalogProducts(): Observable<FacturationCatalogItem[]> {
    return this.http.get<FacturationCatalogItem[]>(`${this.apiUrl}/catalog`);
  }

  // ── Clients (users) ──────────────────────────────────────────────────────────
  getClients(search = ''): Observable<FacturationClient[]> {
    const params = search ? new HttpParams().set('search', search) : new HttpParams();
    return this.http.get<FacturationClient[]>(`${this.apiUrl}/clients`, { params });
  }

  updateClientFiscalInfo(clientId: number, fiscalInfo: FacturationClient['fiscal_info']): Observable<FacturationClient> {
    return this.http.patch<FacturationClient>(`${this.apiUrl}/clients/${clientId}/fiscal-info`, fiscalInfo);
  }

  // ── Company settings ─────────────────────────────────────────────────────────
  getCompanySettings(): Observable<CompanySettings> {
    return this.http.get<CompanySettings>(`${this.apiUrl}/company-settings`);
  }

  updateCompanySettings(data: CompanySettingsUpdate): Observable<CompanySettings> {
    return this.http.put<CompanySettings>(`${this.apiUrl}/company-settings`, data);
  }

  // ── Facturations ─────────────────────────────────────────────────────────────
  getFacturations(skip = 0, limit = 50, clientId?: number, fromDate?: string, toDate?: string): Observable<FacturationListResponse> {
    let params = new HttpParams().set('skip', skip).set('limit', limit);
    if (clientId != null) params = params.set('client_id', clientId);
    if (fromDate) params = params.set('from_date', fromDate);
    if (toDate) params = params.set('to_date', toDate);
    return this.http.get<FacturationListResponse>(this.apiUrl, { params });
  }

  getClientTotals(): Observable<ClientTotal[]> {
    return this.http.get<ClientTotal[]>(`${this.apiUrl}/client-totals`);
  }

  getAccountingStats(clientId?: number): Observable<AccountingStats> {
    let params = new HttpParams();
    if (clientId != null) params = params.set('client_id', clientId);
    return this.http.get<AccountingStats>(`${this.apiUrl}/accounting-stats`, { params });
  }

  getFacturation(id: number): Observable<Facturation> {
    return this.http.get<Facturation>(`${this.apiUrl}/${id}`);
  }

  getFacturationDraftFromOrder(orderId: number): Observable<FacturationDraft> {
    return this.http.get<FacturationDraft>(`${this.apiUrl}/from-order/${orderId}`);
  }

  createFacturation(data: FacturationCreate): Observable<Facturation> {
    return this.http.post<Facturation>(this.apiUrl, data);
  }

  convertToFacture(id: number): Observable<Facturation> {
    return this.http.post<Facturation>(`${this.apiUrl}/${id}/convert`, {});
  }

  deleteFacturation(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
