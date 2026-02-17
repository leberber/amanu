// src/app/shared/components/map-picker/map-picker.component.ts
import { Component, Input, Output, EventEmitter, AfterViewInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import * as L from 'leaflet';

export interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
}

@Component({
  selector: 'app-map-picker',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule
  ],
  template: `
    <div class="map-picker" [class.fullscreen]="fullscreen">
      <div class="map-container" [id]="mapId"></div>

      <!-- Use My Location Card (shown when no location selected in fullscreen) -->
      <div class="use-location-card" *ngIf="fullscreen && !selectedLocation && !isLocating && !cardDismissed">
        <button class="use-location-btn" (click)="locateUser()">
          <i class="pi pi-map-marker"></i>
          <span>{{ 'register.use_my_location' | translate }}</span>
        </button>
        <button class="dismiss-btn" (click)="dismissCard()">
          {{ 'register.or_tap_map' | translate }}
        </button>
      </div>

      <!-- Locate Me Button (fullscreen mode, shown after location selected) -->
      <button *ngIf="fullscreen && (selectedLocation || locationRequested)" class="locate-btn" (click)="locateUser()" [disabled]="isLocating">
        <i class="pi" [class.pi-spin]="isLocating" [class.pi-spinner]="isLocating" [class.pi-compass]="!isLocating"></i>
      </button>

      <div class="address-display" *ngIf="selectedLocation && !fullscreen">
        <div class="address-card">
          <i class="pi pi-map-marker"></i>
          <div class="address-text">
            <small>{{ 'register.selected_location' | translate }}</small>
            <span>{{ selectedLocation.address || ('register.location_selected' | translate) }}</span>
          </div>
        </div>
      </div>

      <div class="instructions" *ngIf="!selectedLocation && !fullscreen">
        <p>
          <i class="pi pi-info-circle"></i>
          {{ 'register.tap_map_instruction' | translate }}
        </p>
      </div>

      <div class="loading-overlay" *ngIf="isLoadingAddress || isLocating">
        <div class="loading-card">
          <i class="pi pi-spin pi-spinner"></i>
          <span *ngIf="isLocating">{{ 'register.locating' | translate }}</span>
          <span *ngIf="isLoadingAddress && !isLocating">{{ 'register.fetching_address' | translate }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .map-picker {
      position: relative;
      height: 300px;
    }

    .map-picker.fullscreen {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      height: 100%;
      width: 100%;
    }

    .map-container {
      height: 100%;
      width: 100%;
      border-radius: 8px;
      border: 1px solid var(--surface-border);
      z-index: 0;
    }

    .fullscreen .map-container {
      border-radius: 0;
      border: none;
    }

    .locate-btn {
      position: absolute;
      bottom: 140px;
      right: 1rem;
      width: 48px;
      height: 48px;
      border-radius: 14px;
      border: none;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      color: var(--primary-color);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999;
      transition: all 0.3s ease;

      &:hover:not(:disabled) {
        transform: scale(1.05);
        background: white;
      }

      &:active:not(:disabled) {
        transform: scale(0.95);
      }

      &:disabled {
        opacity: 0.7;
        cursor: wait;
      }

      i {
        font-size: 1.25rem;
      }
    }

    .use-location-card {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 999;
      text-align: center;
    }

    .use-location-btn {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 16px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 8px 32px rgba(102, 126, 234, 0.4);
      transition: all 0.3s ease;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 40px rgba(102, 126, 234, 0.5);
      }

      &:active {
        transform: translateY(0);
      }

      i {
        font-size: 1.25rem;
      }
    }

    .dismiss-btn {
      margin-top: 1rem;
      color: #333;
      font-size: 0.875rem;
      background: rgba(255, 255, 255, 0.95);
      padding: 0.75rem 1.25rem;
      border-radius: 12px;
      border: none;
      cursor: pointer;
      backdrop-filter: blur(10px);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
      transition: all 0.3s ease;

      &:hover {
        background: white;
        transform: translateY(-1px);
      }
    }

    .address-display {
      margin-top: 0.75rem;
    }

    .address-card {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.875rem 1rem;
      background: var(--surface-100);
      border-radius: 10px;

      i {
        color: var(--primary-color);
        font-size: 1.25rem;
      }

      .address-text {
        flex: 1;

        small {
          display: block;
          color: var(--text-color-secondary);
          font-size: 0.75rem;
          margin-bottom: 0.125rem;
        }

        span {
          font-weight: 500;
          font-size: 0.9rem;
          color: var(--text-color);
        }
      }
    }

    .instructions {
      margin-top: 0.75rem;
      text-align: center;

      p {
        margin: 0;
        color: var(--text-color-secondary);
        font-size: 0.875rem;

        i {
          margin-right: 0.5rem;
        }
      }
    }

    .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      z-index: 1000;
    }

    .fullscreen .loading-overlay {
      border-radius: 0;
    }

    .loading-card {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);

      i {
        font-size: 1.25rem;
        color: var(--primary-color);
      }

      span {
        font-weight: 500;
        color: var(--text-color);
      }
    }

    :host ::ng-deep .leaflet-control-attribution {
      font-size: 10px;
    }

    :host ::ng-deep .current-location-icon {
      background: transparent !important;
      border: none !important;
    }
  `]
})
export class MapPickerComponent implements AfterViewInit, OnDestroy {
  @Input() initialLatitude?: number;
  @Input() initialLongitude?: number;
  @Input() fullscreen = false;
  @Input() mapId = 'map-' + Math.random().toString(36).substr(2, 9);

  @Output() locationSelected = new EventEmitter<LocationData>();
  @Output() locationError = new EventEmitter<string>();

  private map!: L.Map;
  private marker?: L.Marker;
  private userLocationMarker?: L.Marker;
  private userLocationAccuracy?: L.Circle;
  private translateService = inject(TranslateService);

  selectedLocation?: LocationData;
  isLoadingAddress = false;
  isLocating = false;
  locationRequested = false;
  cardDismissed = false;

  // Default center (Algeria - Algiers)
  private defaultLat = 36.7538;
  private defaultLng = 3.0588;
  private defaultZoom = 12;

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initMap();
    }, 100);
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  private initMap(): void {
    const lat = this.initialLatitude || this.defaultLat;
    const lng = this.initialLongitude || this.defaultLng;

    const iconRetinaUrl = 'assets/leaflet/marker-icon-2x.png';
    const iconUrl = 'assets/leaflet/marker-icon.png';
    const shadowUrl = 'assets/leaflet/marker-shadow.png';

    const defaultIcon = L.icon({
      iconRetinaUrl,
      iconUrl,
      shadowUrl,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      tooltipAnchor: [16, -28],
      shadowSize: [41, 41]
    });
    L.Marker.prototype.options.icon = defaultIcon;

    this.map = L.map(this.mapId).setView([lat, lng], this.defaultZoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(this.map);

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.onMapClick(e.latlng);
    });

    if (this.initialLatitude && this.initialLongitude) {
      this.placeMarker(lat, lng);
      this.reverseGeocode(lat, lng);
    }

    // Invalidate size after a short delay for fullscreen mode
    if (this.fullscreen) {
      setTimeout(() => {
        this.map.invalidateSize();
      }, 300);
    }
  }

  private tryGetUserLocation(): void {
    if (!('geolocation' in navigator)) {
      console.error('Geolocation not supported by browser');
      this.locationError.emit('geolocation_not_supported');
      return;
    }

    this.isLocating = true;
    this.locationRequested = true;
    console.log('Requesting location...');

    // Try fast location first (network-based), then fall back to high accuracy
    navigator.geolocation.getCurrentPosition(
      (position) => this.handleLocationSuccess(position),
      (error) => {
        // If fast location fails, try high accuracy
        if (error.code === error.TIMEOUT) {
          console.log('Fast location timed out, trying high accuracy...');
          navigator.geolocation.getCurrentPosition(
            (position) => this.handleLocationSuccess(position),
            (err) => this.handleLocationError(err),
            { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
          );
        } else {
          this.handleLocationError(error);
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }

  private handleLocationSuccess(position: GeolocationPosition): void {
    console.log('Location received:', position.coords.latitude, position.coords.longitude);
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const accuracy = position.coords.accuracy;

    // Show current location indicator (blue dot)
    this.showCurrentLocationMarker(lat, lng, accuracy);

    this.map.setView([lat, lng], 17);
    // Auto-place delivery marker at user's location
    this.placeMarker(lat, lng);
    this.reverseGeocode(lat, lng);
    this.isLocating = false;
  }

  private handleLocationError(error: GeolocationPositionError): void {
    console.error('Geolocation error:', error.code, error.message);

    // Try IP-based geolocation as fallback
    if (error.code === error.TIMEOUT || error.code === error.POSITION_UNAVAILABLE) {
      console.log('Trying IP-based location fallback...');
      this.tryIPBasedLocation();
      return;
    }

    this.isLocating = false;

    // Emit specific error type
    switch (error.code) {
      case error.PERMISSION_DENIED:
        this.locationError.emit('permission_denied');
        break;
      default:
        this.locationError.emit('unknown_error');
    }
  }

  private tryIPBasedLocation(): void {
    // Use free IP geolocation API
    fetch('https://ipapi.co/json/')
      .then(response => response.json())
      .then(data => {
        if (data.latitude && data.longitude) {
          console.log('IP location received:', data.latitude, data.longitude, data.city);
          const lat = data.latitude;
          const lng = data.longitude;

          this.map.setView([lat, lng], 14);
          this.placeMarker(lat, lng);
          this.reverseGeocode(lat, lng);
          this.isLocating = false;
        } else {
          throw new Error('No coordinates in response');
        }
      })
      .catch(err => {
        console.error('IP geolocation failed:', err);
        this.isLocating = false;
        this.locationError.emit('position_unavailable');
      });
  }

  private showCurrentLocationMarker(lat: number, lng: number, accuracy: number): void {
    // Remove existing user location markers
    if (this.userLocationMarker) {
      this.map.removeLayer(this.userLocationMarker);
    }
    if (this.userLocationAccuracy) {
      this.map.removeLayer(this.userLocationAccuracy);
    }

    // Add accuracy circle (light blue area)
    this.userLocationAccuracy = L.circle([lat, lng], {
      radius: Math.min(accuracy, 100), // Cap at 100m for visual clarity
      color: '#4285F4',
      fillColor: '#4285F4',
      fillOpacity: 0.15,
      weight: 1
    }).addTo(this.map);

    // Create custom pulsing icon for current location with inline styles
    const pulsingIcon = L.divIcon({
      className: 'current-location-icon',
      html: `
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 40px;
          height: 40px;
          background: rgba(66, 133, 244, 0.3);
          border-radius: 50%;
          animation: currentLocationPulse 2s ease-out infinite;
        "></div>
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 18px;
          height: 18px;
          background: #4285F4;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        "></div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    // Add the pulsing location marker
    this.userLocationMarker = L.marker([lat, lng], {
      icon: pulsingIcon,
      interactive: false,
      zIndexOffset: -1000 // Place below the delivery marker
    }).addTo(this.map);

    // Add global animation keyframes if not already added
    if (!document.getElementById('current-location-pulse-style')) {
      const style = document.createElement('style');
      style.id = 'current-location-pulse-style';
      style.textContent = `
        @keyframes currentLocationPulse {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  // Public method to re-center on user location
  public locateUser(): void {
    this.tryGetUserLocation();
  }

  // Dismiss the location card to allow manual map selection
  public dismissCard(): void {
    this.cardDismissed = true;
  }

  private onMapClick(latlng: L.LatLng): void {
    this.placeMarker(latlng.lat, latlng.lng);
    this.reverseGeocode(latlng.lat, latlng.lng);
  }

  private placeMarker(lat: number, lng: number): void {
    if (this.marker) {
      this.marker.setLatLng([lat, lng]);
    } else {
      this.marker = L.marker([lat, lng], { draggable: true }).addTo(this.map);

      this.marker.on('dragend', () => {
        const position = this.marker!.getLatLng();
        this.reverseGeocode(position.lat, position.lng);
      });
    }
  }

  private reverseGeocode(lat: number, lng: number): void {
    this.isLoadingAddress = true;

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

    fetch(url, {
      headers: {
        'Accept-Language': this.translateService.currentLang || 'en'
      }
    })
      .then(response => response.json())
      .then(data => {
        const address = data.display_name || '';
        this.selectedLocation = {
          latitude: lat,
          longitude: lng,
          address: address
        };
        this.locationSelected.emit(this.selectedLocation);
        this.isLoadingAddress = false;
      })
      .catch(error => {
        console.error('Reverse geocoding error:', error);
        this.selectedLocation = {
          latitude: lat,
          longitude: lng,
          address: ''
        };
        this.locationSelected.emit(this.selectedLocation);
        this.isLoadingAddress = false;
      });
  }

  public reset(): void {
    if (this.marker) {
      this.map.removeLayer(this.marker);
      this.marker = undefined;
    }
    this.selectedLocation = undefined;
    this.map.setView([this.defaultLat, this.defaultLng], this.defaultZoom);
  }
}
