import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface RouteResult {
  coordinates: Coordinate[];
  distance_km: number;
  duration_min: number;
  provider: 'osrm' | 'google';
}

interface OSRMResponse {
  code: string;
  routes: Array<{
    geometry: {
      coordinates: Array<[number, number]>;
    };
    distance: number;
    duration: number;
  }>;
}

// Road type options
export type RefShort = 'A' | 'RN' | 'CW' | 'CC';

export interface SavedRoad {
  id: number;
  ref_short: RefShort;
  ref: string;
  length_km: number;
  time_minutes: number;
  color: string;
  place_start: string | null;
  place_end: string | null;
  name: string | null;
}

export interface SavedRoadDetail extends SavedRoad {
  coordinates: Coordinate[];
}

export interface SaveRoadRequest {
  ref_short: RefShort;
  ref: string;
  coordinates: Coordinate[];
  length_km: number;
  time_minutes: number;
  place_start?: string;
  place_end?: string;
  name?: string;
}

export interface RoadColors {
  A: string;
  RN: string;
  CW: string;
  CC: string;
}

@Injectable({
  providedIn: 'root'
})
export class RoadBuilderService {
  private http = inject(HttpClient);

  /**
   * Get route between points using OSRM or Google
   */
  async getRoute(points: Coordinate[], provider: 'osrm' | 'google'): Promise<RouteResult> {
    if (provider === 'osrm') {
      return this.getRouteOSRM(points);
    } else {
      return this.getRouteGoogle(points);
    }
  }

  /**
   * Get route using OSRM (free)
   */
  private async getRouteOSRM(points: Coordinate[]): Promise<RouteResult> {
    // OSRM expects lng,lat order
    const coordsStr = points.map(p => `${p.lng},${p.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;

    const response = await firstValueFrom(
      this.http.get<OSRMResponse>(url)
    );

    if (response.code !== 'Ok') {
      throw new Error('OSRM routing failed');
    }

    const route = response.routes[0];

    // Convert coordinates from [lng, lat] to {lat, lng}
    const coordinates = route.geometry.coordinates.map(c => ({
      lat: c[1],
      lng: c[0]
    }));

    return {
      coordinates,
      distance_km: route.distance / 1000,
      duration_min: route.duration / 60,
      provider: 'osrm'
    };
  }

  /**
   * Get route using Google Directions API (via backend proxy)
   */
  private async getRouteGoogle(points: Coordinate[]): Promise<RouteResult> {
    const response = await firstValueFrom(
      this.http.post<RouteResult>(`${environment.apiUrl}/roads/route/google`, { points })
    );

    return {
      ...response,
      provider: 'google'
    };
  }

  /**
   * Get road colors by type
   */
  async getColors(): Promise<RoadColors> {
    return firstValueFrom(
      this.http.get<RoadColors>(`${environment.apiUrl}/roads/colors`)
    );
  }

  /**
   * Save road to database
   */
  async saveRoad(request: SaveRoadRequest): Promise<{ id: number; ref: string }> {
    return firstValueFrom(
      this.http.post<{ message: string; id: number; ref: string }>(`${environment.apiUrl}/roads/save`, request)
    );
  }

  /**
   * Update road by ID
   */
  async updateRoad(id: number, request: SaveRoadRequest): Promise<void> {
    await firstValueFrom(
      this.http.put(`${environment.apiUrl}/roads/${id}`, request)
    );
  }

  /**
   * Get all saved roads
   */
  async getSavedRoads(): Promise<SavedRoad[]> {
    return firstValueFrom(
      this.http.get<SavedRoad[]>(`${environment.apiUrl}/roads`)
    );
  }

  /**
   * Get a single road with coordinates
   */
  async getRoad(id: number): Promise<SavedRoadDetail> {
    return firstValueFrom(
      this.http.get<SavedRoadDetail>(`${environment.apiUrl}/roads/${id}`)
    );
  }

  /**
   * Delete a road
   */
  async deleteRoad(id: number): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${environment.apiUrl}/roads/${id}`)
    );
  }
}
