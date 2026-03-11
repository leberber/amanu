import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export enum VehicleType {
  TRUCK = 'truck',
  VAN = 'van',
  MINI_VAN = 'mini_van'
}

export enum DriverStatus {
  AVAILABLE = 'available',
  BUSY = 'busy',
  OFFLINE = 'offline',
  SUSPENDED = 'suspended'
}

export interface DriverRegisterRequest {
  email: string;
  full_name: string;
  phone: string;
  password: string;
  vehicle_type: VehicleType;
  capacity_kg?: number;
  capacity_volume?: number;
}

export interface ConvertToDriverRequest {
  full_name: string;
  phone: string;
  vehicle_type: VehicleType;
  capacity_kg?: number;
  capacity_volume?: number;
}

export interface DriverRead {
  id: number;
  user_id: number;
  status: DriverStatus;
  is_available: boolean;
  max_active_orders: number;
  created_at: string;
  updated_at: string | null;
  // Primary vehicle info (from endpoint)
  vehicle_type: VehicleType | null;
  capacity_kg: number | null;
  capacity_volume: number | null;
  // Computed stats
  active_orders_count: number;
  total_deliveries: number;
  total_earnings: number;
  average_rating: number | null;
  total_ratings: number;
}

/** @deprecated Use DriverRead instead */
export type DriverProfile = DriverRead;

export interface DriverWithProfile {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  driver: DriverRead | null;
  /** @deprecated Use driver instead */
  driver_profile?: DriverRead | null;
}

@Injectable({
  providedIn: 'root'
})
export class DriverService {
  private http = inject(HttpClient);
  private readonly API_URL = '/api/v1/drivers';

  register(data: DriverRegisterRequest): Observable<DriverWithProfile> {
    return this.http.post<DriverWithProfile>(`${this.API_URL}/register`, data);
  }

  convertToDriver(data: ConvertToDriverRequest): Observable<DriverWithProfile> {
    return this.http.post<DriverWithProfile>(`${this.API_URL}/convert`, data);
  }

  getProfile(): Observable<DriverWithProfile> {
    return this.http.get<DriverWithProfile>(`${this.API_URL}/me`);
  }

  updateProfile(data: Partial<DriverProfile>): Observable<DriverProfile> {
    return this.http.patch<DriverProfile>(`${this.API_URL}/me`, data);
  }

  // Admin methods
  listDrivers(skip = 0, limit = 100): Observable<DriverWithProfile[]> {
    return this.http.get<DriverWithProfile[]>(`${this.API_URL}?skip=${skip}&limit=${limit}`);
  }

  getDriver(id: number): Observable<DriverWithProfile> {
    return this.http.get<DriverWithProfile>(`${this.API_URL}/${id}`);
  }

  activateDriver(id: number): Observable<DriverWithProfile> {
    return this.http.patch<DriverWithProfile>(`${this.API_URL}/${id}/activate`, {});
  }

  deactivateDriver(id: number): Observable<DriverWithProfile> {
    return this.http.patch<DriverWithProfile>(`${this.API_URL}/${id}/deactivate`, {});
  }

  deleteDriver(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.API_URL}/${id}`);
  }
}
