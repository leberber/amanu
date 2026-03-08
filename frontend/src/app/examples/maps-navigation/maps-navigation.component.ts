import { Component, signal, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';

/**
 * EXAMPLE COMPONENT - Google Maps Navigation
 *
 * Opens Google Maps with multiple stops for delivery navigation.
 * Copy and adapt this for the driver trip view.
 */

interface DeliveryStop {
  name: string;
  address: string;
  lat: number;
  lng: number;
  sequence: number;
}

@Component({
  selector: 'app-maps-navigation-example',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  template: `
    <div class="surface-card p-4 border-round shadow-2">
      <h3 class="mt-0 mb-3">Trip Navigation Example</h3>

      <!-- Warehouse origin -->
      <div class="mb-3">
        <span class="font-semibold">Origin:</span>
        <span class="text-secondary">{{ warehouseAddress }}</span>
      </div>

      <!-- Delivery stops -->
      <div class="mb-3">
        <span class="font-semibold">Stops:</span>
        <ul class="mt-2 pl-4">
          @for (stop of stops(); track stop.sequence) {
            <li class="mb-2">
              <span class="font-medium">{{ stop.sequence }}.</span>
              {{ stop.name }} - {{ stop.address }}
            </li>
          }
        </ul>
      </div>

      <!-- Open in Maps button -->
      <p-button
        label="Open in Google Maps"
        icon="pi pi-map"
        (onClick)="openGoogleMaps()"
        styleClass="w-full"
      />

      <!-- Generated URL for debugging -->
      <div class="mt-3 p-2 surface-ground border-round text-sm">
        <span class="font-semibold">URL:</span>
        <code class="block mt-1 text-xs" style="word-break: break-all;">
          {{ generatedUrl() }}
        </code>
      </div>
    </div>
  `
})
export class MapsNavigationExampleComponent {
  // Warehouse location (origin)
  warehouseAddress = 'Warehouse, Bab Ezzouar, Algiers';
  warehouseLat = 36.7194;
  warehouseLng = 3.1795;

  // Example delivery stops
  stops = signal<DeliveryStop[]>([
    {
      name: 'Client A',
      address: 'Hussein Dey, Algiers',
      lat: 36.7312,
      lng: 3.0982,
      sequence: 1
    },
    {
      name: 'Client B',
      address: 'Kouba, Algiers',
      lat: 36.7264,
      lng: 3.0544,
      sequence: 2
    },
    {
      name: 'Client C',
      address: 'El Harrach, Algiers',
      lat: 36.7175,
      lng: 3.1383,
      sequence: 3
    }
  ]);

  generatedUrl = signal('');

  /**
   * Opens Google Maps with all stops
   * Works on desktop (browser) and mobile (opens Maps app)
   */
  openGoogleMaps(): void {
    const url = this.buildGoogleMapsUrl();
    this.generatedUrl.set(url);
    window.open(url, '_blank');
  }

  /**
   * Builds Google Maps directions URL with multiple waypoints
   */
  private buildGoogleMapsUrl(): string {
    // Origin (warehouse)
    const origin = `${this.warehouseLat},${this.warehouseLng}`;

    // Sort stops by sequence and build path
    const sortedStops = [...this.stops()].sort((a, b) => a.sequence - b.sequence);

    // All stops as lat,lng
    const waypoints = sortedStops
      .map(stop => `${stop.lat},${stop.lng}`)
      .join('/');

    // Format: /origin/stop1/stop2/stop3
    return `https://www.google.com/maps/dir/${origin}/${waypoints}`;
  }

  /**
   * Alternative: Build URL with addresses instead of coordinates
   * Google will geocode the addresses automatically
   */
  private buildGoogleMapsUrlWithAddresses(): string {
    const origin = encodeURIComponent(this.warehouseAddress);

    const sortedStops = [...this.stops()].sort((a, b) => a.sequence - b.sequence);
    const waypoints = sortedStops
      .map(stop => encodeURIComponent(stop.address))
      .join('/');

    return `https://www.google.com/maps/dir/${origin}/${waypoints}`;
  }

  /**
   * Alternative: Use Google Maps Directions API format
   * More control over navigation mode, avoid tolls, etc.
   */
  private buildGoogleMapsUrlAdvanced(): string {
    const origin = `${this.warehouseLat},${this.warehouseLng}`;
    const sortedStops = [...this.stops()].sort((a, b) => a.sequence - b.sequence);

    // Last stop is the final destination
    const finalStop = sortedStops[sortedStops.length - 1];
    const destination = `${finalStop.lat},${finalStop.lng}`;

    // All stops except the last are waypoints
    const intermediateStops = sortedStops.slice(0, -1);
    const waypoints = intermediateStops
      .map(stop => `${stop.lat},${stop.lng}`)
      .join('|');

    // Build URL with more options
    let url = `https://www.google.com/maps/dir/?api=1`;
    url += `&origin=${origin}`;
    url += `&destination=${destination}`;
    if (waypoints) {
      url += `&waypoints=${waypoints}`;
    }
    url += `&travelmode=driving`;
    // url += `&avoid=tolls`;  // Optional: avoid tolls

    return url;
  }
}
