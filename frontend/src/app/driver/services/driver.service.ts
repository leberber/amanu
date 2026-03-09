import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export enum VehicleType {
  TRUCK = 'truck',
  VAN = 'van',
  MINI_VAN = 'mini_van'
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

export interface DriverProfile {
  id: number;
  user_id: number;
  vehicle_type: VehicleType;
  capacity_kg: number | null;
  capacity_volume: number | null;
  is_available: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface DriverWithProfile {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  driver_profile: DriverProfile | null;
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
