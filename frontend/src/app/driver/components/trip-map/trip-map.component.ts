import { Component, input, effect, ElementRef, viewChild, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../environments/environment';

declare const google: any;

@Component({
  selector: 'app-trip-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (enabled) {
      <div class="map-container">
        @if (loading()) {
          <div class="map-skeleton"></div>
        }
        <div #mapElement class="map"></div>
      </div>
    }
  `,
  styles: [`
    .map-container {
      width: 100%;
      height: 250px;
      border-radius: var(--radius-lg);
      overflow: hidden;
      background: var(--surface-ground);
      position: relative;
      margin-bottom: var(--space-4);
    }

    .map {
      width: 100%;
      height: 100%;
    }

    .map-skeleton {
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `]
})
export class TripMapComponent implements OnDestroy {
  // Feature flag - set in environment.ts
  readonly enabled = environment.enableTripMap;

  // Warehouse location (origin)
  origin = input<string>('36.7538,3.0588');
  // Customer address (destination)
  destination = input.required<string>();

  mapElement = viewChild<ElementRef>('mapElement');
  loading = signal(true);

  private map: any;
  private directionsRenderer: any;

  // Cache: stores directions results by destination to avoid duplicate API calls
  private static directionsCache = new Map<string, any>();

  constructor() {
    if (!this.enabled) return;

    effect(() => {
      const dest = this.destination();
      const mapEl = this.mapElement();
      if (dest && mapEl) {
        this.loadMap();
      }
    });
  }

  private async loadMap() {
    try {
      if (!this.isGoogleMapsLoaded()) {
        await this.loadGoogleMapsScript();
      }
      this.initMap();
    } catch (e) {
      console.warn('Failed to load map:', e);
      this.loading.set(false);
    }
  }

  private isGoogleMapsLoaded(): boolean {
    return typeof google !== 'undefined' && typeof google.maps !== 'undefined';
  }

  private loadGoogleMapsScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isGoogleMapsLoaded()) {
        resolve();
        return;
      }

      const existingScript = document.getElementById('google-maps-script');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve());
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.googleMapsApiKey}`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Maps'));
      document.head.appendChild(script);
    });
  }

  private initMap() {
    const mapEl = this.mapElement()?.nativeElement;
    if (!mapEl) return;

    this.map = new google.maps.Map(mapEl, {
      zoom: 12,
      center: { lat: 36.7538, lng: 3.0588 },
      disableDefaultUI: true,
      gestureHandling: 'none',
      styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }]
    });

    this.directionsRenderer = new google.maps.DirectionsRenderer({
      map: this.map,
      suppressMarkers: false,
      polylineOptions: { strokeColor: '#1a1a1a', strokeWeight: 4 }
    });

    this.loading.set(false);
    this.drawRoute();
  }

  private drawRoute() {
    const destination = this.destination();
    const cacheKey = `${this.origin()}_${destination}`;

    // Check cache first
    const cached = TripMapComponent.directionsCache.get(cacheKey);
    if (cached) {
      this.directionsRenderer.setDirections(cached);
      return;
    }

    // Not cached - make API call
    const directionsService = new google.maps.DirectionsService();
    const [lat, lng] = this.origin().split(',').map(Number);

    directionsService.route(
      {
        origin: new google.maps.LatLng(lat, lng),
        destination: destination,
        travelMode: google.maps.TravelMode.DRIVING
      },
      (response: any, status: string) => {
        if (status === 'OK') {
          // Cache the result
          TripMapComponent.directionsCache.set(cacheKey, response);
          this.directionsRenderer.setDirections(response);
        }
      }
    );
  }

  ngOnDestroy() {
    this.directionsRenderer?.setMap(null);
  }
}
