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
import { LEAFLET_TILES } from '../../../core/constants/map.constants';

@Component({
  selector: 'app-animated-route-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './animated-route-map.component.html',
  styleUrl: './animated-route-map.component.scss'
})
export class AnimatedRouteMapComponent implements AfterViewInit, OnDestroy, OnChanges {

  // Public method to resize map (call after container size changes)
  public resizeMap(): void {
    if (this.map) {
      // Invalidate size first
      this.map.invalidateSize({ animate: true });

      // Smoothly fly to bounds
      const coords = this.routeCoords();
      if (coords && coords.length >= 2) {
        const bounds = L.latLngBounds(coords.map(([lat, lng]) => [lat, lng] as L.LatLngTuple));
        this.map.flyToBounds(bounds, {
          padding: [100, 100],
          duration: 0.5 // 500ms smooth animation
        });
      }
    }
  }
  // Route coordinates [[lat, lng], ...]
  routeCoords = input.required<number[][]>();

  // Stop information for markers
  stops = input<{ sequence: number; latitude?: number; longitude?: number }[]>([]);

  // Animation duration in milliseconds (total time for animation)
  animationDuration = input<number>(4000);

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
  private trailLine: L.Polyline | null = null;
  private truckMarker: L.Marker | null = null;
  private stopMarkers: L.Marker[] = [];
  private depotMarker: L.Marker | null = null;
  private finalMarker: L.Marker | null = null;
  private animationFrameId: number | null = null;
  private animationStartTime: number = 0;
  private initialized = false;

  // Custom icons
  private createTruckIcon(): L.DivIcon {
    return L.divIcon({
      className: 'truck-marker',
      html: `
        <div class="truck-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="11" fill="#3B82F6"/>
            <path fill="#ffffff" d="M18 18.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5zm1.5-9l-3-3H6c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h1c0 1.1.9 2 2 2s2-.9 2-2h6c0 1.1.9 2 2 2s2-.9 2-2h1c.55 0 1-.45 1-1v-4.5h-3.5zM9 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm8-7.5h2.5l2.25 2.25H17V11z"/>
          </svg>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  }

  private createDepotIcon(): L.DivIcon {
    return L.divIcon({
      className: 'depot-marker',
      html: `<div style="width:40px;height:40px;background:linear-gradient(135deg,#F59E0B,#D97706);border-radius:50%;border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><i class="pi pi-warehouse" style="color:white;font-size:18px;"></i></div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
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

  private createFinalIcon(): L.DivIcon {
    return L.divIcon({
      className: 'final-marker',
      html: `<div style="width:40px;height:40px;background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:50%;border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><i class="pi pi-check" style="color:white;font-size:18px;"></i></div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
  }

  ngAfterViewInit(): void {
    this.initialized = true;
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

    // Add Google Maps tiles (using Leaflet)
    L.tileLayer(LEAFLET_TILES.GOOGLE.URL, {
      maxZoom: LEAFLET_TILES.GOOGLE.MAX_ZOOM,
      subdomains: LEAFLET_TILES.GOOGLE.SUBDOMAINS,
      attribution: LEAFLET_TILES.GOOGLE.ATTRIBUTION
    }).addTo(this.map);

    // Calculate bounds
    const bounds = L.latLngBounds(coords.map(([lat, lng]) => [lat, lng] as L.LatLngTuple));
    this.map.fitBounds(bounds, { padding: [100, 100] });

    // Draw route line (light gray, will be colored by trail)
    const latLngs = coords.map(([lat, lng]) => [lat, lng] as L.LatLngTuple);
    this.routeLine = L.polyline(latLngs, {
      color: '#E5E7EB',
      weight: 6,
      opacity: 0.8
    }).addTo(this.map);

    // Create trail line (will show the path traveled)
    this.trailLine = L.polyline([], {
      color: '#3B82F6',
      weight: 6,
      opacity: 1
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
      setTimeout(() => this.startAnimation(), 800);
    }
  }

  startAnimation(): void {
    if (this.animating() || this.animationDone() || !this.truckMarker || !this.map) {
      return;
    }

    const coords = this.routeCoords();
    if (!coords || coords.length < 2) return;

    this.animating.set(true);
    this.animationStartTime = performance.now();

    // Use requestAnimationFrame for smooth animation
    this.animateFrame();
  }

  private animateFrame(): void {
    if (!this.animating() || !this.truckMarker || !this.map) return;

    const coords = this.routeCoords();
    const elapsed = performance.now() - this.animationStartTime;
    const duration = this.animationDuration();
    const progress = Math.min(elapsed / duration, 1);

    // Get current position along route
    const position = this.getPointAtFraction(coords, progress);
    this.truckMarker.setLatLng([position[0], position[1]]);

    // Update trail line to show path traveled
    if (this.trailLine) {
      const trailCoords = this.getTrailCoords(coords, progress);
      this.trailLine.setLatLngs(trailCoords);
    }

    if (progress < 1) {
      this.animationFrameId = requestAnimationFrame(() => this.animateFrame());
    } else {
      // Animation complete - remove truck and add final marker
      const coords = this.routeCoords();
      const lastCoord = coords[coords.length - 1];

      if (this.truckMarker && this.map) {
        this.map.removeLayer(this.truckMarker);
        this.truckMarker = null;
      }

      // Add final destination marker
      if (this.map && lastCoord) {
        this.finalMarker = L.marker([lastCoord[0], lastCoord[1]], {
          icon: this.createFinalIcon(),
          zIndexOffset: 200
        }).addTo(this.map);
      }

      this.animating.set(false);
      this.animationDone.set(true);
      this.animationComplete.emit();
    }
  }

  // Get trail coordinates up to current progress
  private getTrailCoords(coords: number[][], progress: number): L.LatLngTuple[] {
    if (progress <= 0) return [];

    const result: L.LatLngTuple[] = [];

    // Calculate total distance
    let totalDistance = 0;
    const distances: number[] = [0];

    for (let i = 0; i < coords.length - 1; i++) {
      const start = L.latLng(coords[i][0], coords[i][1]);
      const end = L.latLng(coords[i + 1][0], coords[i + 1][1]);
      totalDistance += start.distanceTo(end);
      distances.push(totalDistance);
    }

    const targetDistance = progress * totalDistance;

    // Add all points up to current position
    for (let i = 0; i < coords.length; i++) {
      if (distances[i] <= targetDistance) {
        result.push([coords[i][0], coords[i][1]]);
      } else {
        break;
      }
    }

    // Add interpolated current position
    const currentPos = this.getPointAtFraction(coords, progress);
    result.push([currentPos[0], currentPos[1]]);

    return result;
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
        const segmentLength = distances[i + 1] - distances[i];
        if (segmentLength === 0) continue;
        const segmentFraction = (targetDistance - distances[i]) / segmentLength;
        const lat = coords[i][0] + (coords[i + 1][0] - coords[i][0]) * segmentFraction;
        const lng = coords[i][1] + (coords[i + 1][1] - coords[i][1]) * segmentFraction;
        return [lat, lng];
      }
    }

    return [coords[coords.length - 1][0], coords[coords.length - 1][1]];
  }

  ngOnDestroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}
