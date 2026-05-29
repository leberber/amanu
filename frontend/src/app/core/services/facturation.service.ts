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
  };
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
}

export interface FacturationItemCreate {
  product_id?: number;
  reference: string;
  product_name: string;
  unit: string;
  pieces_per_box: number;
  quantity: number;
  unit_price: number;
  tva_rate: number;
}

export interface FacturationCreate {
  client_id: number;
  fiscal_info?: { rc?: string; na?: string; nif?: string; nis?: string };
  payment_mode: string;
  remise: number;
  timbre: number;
  notes?: string;
  items: FacturationItemCreate[];
}

export interface FacturationItem {
  id: number;
  product_id?: number;
  reference: string;
  product_name: string;
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

export interface FacturationListResponse {
  facturations: Facturation[];
  total: number;
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

  // ── Company settings ─────────────────────────────────────────────────────────
  getCompanySettings(): Observable<CompanySettings> {
    return this.http.get<CompanySettings>(`${this.apiUrl}/company-settings`);
  }

  updateCompanySettings(data: CompanySettingsUpdate): Observable<CompanySettings> {
    return this.http.put<CompanySettings>(`${this.apiUrl}/company-settings`, data);
  }

  // ── Facturations ─────────────────────────────────────────────────────────────
  getFacturations(skip = 0, limit = 50): Observable<FacturationListResponse> {
    const params = new HttpParams().set('skip', skip).set('limit', limit);
    return this.http.get<FacturationListResponse>(this.apiUrl, { params });
  }

  getFacturation(id: number): Observable<Facturation> {
    return this.http.get<Facturation>(`${this.apiUrl}/${id}`);
  }

  createFacturation(data: FacturationCreate): Observable<Facturation> {
    return this.http.post<Facturation>(this.apiUrl, data);
  }

  deleteFacturation(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
