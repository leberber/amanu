import {
  Component,
  input,
  output,
  ElementRef,
  viewChild,
  OnDestroy,
  signal,
  AfterViewInit,
  OnChanges,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';

@Component({
  selector: 'app-animated-route-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './animated-route-map.component.html',
  styleUrl: './animated-route-map.component.scss'
})
export class AnimatedRouteMapComponent implements AfterViewInit, OnDestroy, OnChanges {
  // Route coordinates [[lat, lng], ...]
  routeCoords = input.required<number[][]>();

  // Stop information for markers
  stops = input<{ sequence: number; latitude?: number; longitude?: number }[]>([]);

  // Animation duration in milliseconds (total time for animation)
  animationDuration = input<number>(3000);

  // Whether to start animation automatically
  autoStart = input<boolean>(true);

  // Emits when animation completes
  animationComplete = output<void>();

  mapContainer = viewChild<ElementRef>('mapContainer');
  loading = signal(true);
  animating = signal(false);
  animationDone = signal(false);

  private map: L.Map | null = null;
  private routeLine: L.Polyline | null = null;
  private truckMarker: L.Marker | null = null;
  private stopMarkers: L.Marker[] = [];
  private depotMarker: L.Marker | null = null;
  private animationFrameId: number | null = null;
  private initialized = false;

  // Custom icons
  private createTruckIcon(): L.DivIcon {
    return L.divIcon({
      className: 'truck-marker',
      html: `
        <div class="truck-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="11" fill="#1a1a1a"/>
            <path fill="#ffffff" d="M18 18.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5zm1.5-9l-3-3H6c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h1c0 1.1.9 2 2 2s2-.9 2-2h6c0 1.1.9 2 2 2s2-.9 2-2h1c.55 0 1-.45 1-1v-4.5h-3.5zM9 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm8-7.5h2.5l2.25 2.25H17V11z"/>
          </svg>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
  }

  private createDepotIcon(): L.DivIcon {
    return L.divIcon({
      className: 'depot-marker',
      html: `
        <div class="depot-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="#1a1a1a" stroke="#ffffff" stroke-width="2"/>
            <path fill="#ffffff" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 36]
    });
  }

  private createStopIcon(number: number): L.DivIcon {
    return L.divIcon({
      className: 'stop-marker',
      html: `
        <div class="stop-icon">
          <span>${number}</span>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  }

  ngAfterViewInit(): void {
    this.initialized = true;
    // Delay to ensure container has dimensions
    setTimeout(() => this.tryInitMap(), 200);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['routeCoords'] && this.initialized && !this.map) {
      setTimeout(() => this.tryInitMap(), 100);
    }
  }

  private tryInitMap(): void {
    const coords = this.routeCoords();
    const container = this.mapContainer()?.nativeElement;


    if (!container || this.map || !coords || coords.length < 2) {
      return;
    }

    this.initMap();
  }

  private initMap(): void {
    const container = this.mapContainer()?.nativeElement;
    if (!container) return;

    const coords = this.routeCoords();
    if (!coords || coords.length < 2) return;


    // Create map
    this.map = L.map(container, {
      zoomControl: false,
      attributionControl: false
    });

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(this.map);

    // Calculate bounds
    const bounds = L.latLngBounds(coords.map(([lat, lng]) => [lat, lng] as L.LatLngTuple));
    this.map.fitBounds(bounds, { padding: [60, 60] });

    // Draw route line
    const latLngs = coords.map(([lat, lng]) => [lat, lng] as L.LatLngTuple);
    this.routeLine = L.polyline(latLngs, {
      color: '#3b82f6',
      weight: 5,
      opacity: 0.8
    }).addTo(this.map);

    // Add depot marker (first point)
    const depotCoord = coords[0];
    this.depotMarker = L.marker([depotCoord[0], depotCoord[1]], {
      icon: this.createDepotIcon(),
      zIndexOffset: 100
    }).addTo(this.map);

    // Add stop markers from stops input or fallback to route coords
    const stopsData = this.stops();
    if (stopsData && stopsData.length > 0) {
      stopsData.forEach((stop) => {
        if (stop.latitude && stop.longitude) {
          const marker = L.marker([stop.latitude, stop.longitude], {
            icon: this.createStopIcon(stop.sequence),
            zIndexOffset: 50
          }).addTo(this.map!);
          this.stopMarkers.push(marker);
        }
      });
    } else {
      // Fallback: use route coords as stops (skip first which is depot)
      coords.slice(1).forEach((coord, index) => {
        const marker = L.marker([coord[0], coord[1]], {
          icon: this.createStopIcon(index + 1),
          zIndexOffset: 50
        }).addTo(this.map!);
        this.stopMarkers.push(marker);
      });
    }

    // Create truck marker at depot
    this.truckMarker = L.marker([depotCoord[0], depotCoord[1]], {
      icon: this.createTruckIcon(),
      zIndexOffset: 200
    }).addTo(this.map);

    this.loading.set(false);

    // Start animation if autoStart is true
    if (this.autoStart()) {
      setTimeout(() => {
  this.startAnimation();
      }, 800);
    }
  }

  startAnimation(): void {
    if (this.animating() || this.animationDone() || !this.truckMarker || !this.map) {
return;
    }

    const coords = this.routeCoords();
    if (!coords || coords.length < 2) return;

    this.animating.set(true);

    // Create interpolated path for smooth animation
    const interpolatedPath: L.LatLng[] = [];
    const totalDuration = this.animationDuration();

    // Calculate total route length for proportional timing
    let totalDistance = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      const start = L.latLng(coords[i][0], coords[i][1]);
      const end = L.latLng(coords[i + 1][0], coords[i + 1][1]);
      totalDistance += start.distanceTo(end);
    }

    // Create interpolated points based on distance
    const pointsPerMeter = 0.01; // Adjust for smoothness
    const minPoints = 100;
    const maxPoints = 500;
    const numPoints = Math.min(maxPoints, Math.max(minPoints, Math.floor(totalDistance * pointsPerMeter)));

    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const point = this.getPointAtFraction(coords, t);
      interpolatedPath.push(L.latLng(point[0], point[1]));
    }


    let currentIndex = 0;
    const frameInterval = totalDuration / interpolatedPath.length;

    const animate = () => {
      if (currentIndex >= interpolatedPath.length) {
        this.animating.set(false);
        this.animationDone.set(true);
        this.animationComplete.emit();
        return;
      }

      const pos = interpolatedPath[currentIndex];
      this.truckMarker?.setLatLng(pos);
      currentIndex++;

      this.animationFrameId = window.setTimeout(animate, frameInterval);
    };

    animate();
  }

  // Get a point along the route at a given fraction (0 to 1)
  private getPointAtFraction(coords: number[][], fraction: number): [number, number] {
    if (fraction <= 0) return [coords[0][0], coords[0][1]];
    if (fraction >= 1) return [coords[coords.length - 1][0], coords[coords.length - 1][1]];

    // Calculate total distance
    let totalDistance = 0;
    const distances: number[] = [0];

    for (let i = 0; i < coords.length - 1; i++) {
      const start = L.latLng(coords[i][0], coords[i][1]);
      const end = L.latLng(coords[i + 1][0], coords[i + 1][1]);
      totalDistance += start.distanceTo(end);
      distances.push(totalDistance);
    }

    const targetDistance = fraction * totalDistance;

    // Find the segment containing this distance
    for (let i = 0; i < distances.length - 1; i++) {
      if (targetDistance >= distances[i] && targetDistance <= distances[i + 1]) {
        const segmentFraction = (targetDistance - distances[i]) / (distances[i + 1] - distances[i]);
        const lat = coords[i][0] + (coords[i + 1][0] - coords[i][0]) * segmentFraction;
        const lng = coords[i][1] + (coords[i + 1][1] - coords[i][1]) * segmentFraction;
        return [lat, lng];
      }
    }

    return [coords[coords.length - 1][0], coords[coords.length - 1][1]];
  }

  ngOnDestroy(): void {
    if (this.animationFrameId) {
      clearTimeout(this.animationFrameId);
    }
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}
