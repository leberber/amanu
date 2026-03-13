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

interface GoogleDirectionsResponse {
  status: string;
  routes: Array<{
    overview_polyline: {
      points: string;
    };
    legs: Array<{
      distance: { value: number };
      duration: { value: number };
    }>;
  }>;
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
   * Save road to database
   */
  async saveRoad(name: string, route: RouteResult): Promise<void> {
    await firstValueFrom(
      this.http.post(`${environment.apiUrl}/roads/save`, {
        name,
        coordinates: route.coordinates,
        distance_km: route.distance_km,
        highway_type: 'tertiary'
      })
    );
  }

  /**
   * Get all saved roads
   */
  async getSavedRoads(): Promise<any[]> {
    return firstValueFrom(
      this.http.get<any[]>(`${environment.apiUrl}/roads`)
    );
  }

  /**
   * Delete a road
   */
  async deleteRoad(ref: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${environment.apiUrl}/roads/${ref}`)
    );
  }
}
