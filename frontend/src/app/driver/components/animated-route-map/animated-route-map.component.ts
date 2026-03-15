import {
  Component,
  input,
  output,
  effect,
  ElementRef,
  viewChild,
  OnDestroy,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../environments/environment';

declare const google: any;

@Component({
  selector: 'app-animated-route-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './animated-route-map.component.html',
  styleUrl: './animated-route-map.component.scss'
})
export class AnimatedRouteMapComponent implements OnDestroy {
  // Feature flag
  readonly enabled = environment.enableTripMap;

  // Route coordinates [[lat, lng], ...]
  routeCoords = input.required<number[][]>();

  // Animation speed (ms per segment)
  animationSpeed = input<number>(100);

  // Whether to start animation automatically
  autoStart = input<boolean>(true);

  // Emits when animation completes
  animationComplete = output<void>();

  mapElement = viewChild<ElementRef>('mapElement');
  loading = signal(true);
  animating = signal(false);
  animationDone = signal(false);

  private map: any;
  private routeLine: any;
  private truckMarker: any;
  private stopMarkers: any[] = [];
  private animationInterval: any;

  constructor() {
    if (!this.enabled) return;

    effect(() => {
      const coords = this.routeCoords();
      const mapEl = this.mapElement();
      if (coords && coords.length >= 2 && mapEl) {
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

    const coords = this.routeCoords();
    if (!coords || coords.length < 2) return;

    // Calculate bounds to fit all points
    const bounds = new google.maps.LatLngBounds();
    coords.forEach(([lat, lng]) => {
      bounds.extend(new google.maps.LatLng(lat, lng));
    });

    this.map = new google.maps.Map(mapEl, {
      zoom: 12,
      center: bounds.getCenter(),
      disableDefaultUI: true,
      gestureHandling: 'greedy',
      styles: [
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] }
      ]
    });

    // Fit map to bounds with padding
    this.map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });

    // Draw the route line
    const path = coords.map(([lat, lng]) => ({ lat, lng }));
    this.routeLine = new google.maps.Polyline({
      path: path,
      geodesic: true,
      strokeColor: '#1a1a1a',
      strokeOpacity: 1.0,
      strokeWeight: 4,
      map: this.map
    });

    // Add stop markers
    coords.forEach(([lat, lng], index) => {
      const isDepot = index === 0;
      const isLast = index === coords.length - 1;

      const marker = new google.maps.Marker({
        position: { lat, lng },
        map: this.map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isDepot ? 10 : 8,
          fillColor: isDepot ? '#1a1a1a' : '#22c55e',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2
        },
        label: isDepot ? undefined : {
          text: index.toString(),
          color: '#ffffff',
          fontSize: '10px',
          fontWeight: 'bold'
        },
        zIndex: isDepot ? 100 : 50
      });

      this.stopMarkers.push(marker);
    });

    // Create truck marker at start position
    this.truckMarker = new google.maps.Marker({
      position: { lat: coords[0][0], lng: coords[0][1] },
      map: this.map,
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="11" fill="#1a1a1a"/>
            <path fill="#ffffff" d="M18 18.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5zm1.5-9l-3-3H6c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h1c0 1.1.9 2 2 2s2-.9 2-2h6c0 1.1.9 2 2 2s2-.9 2-2h1c.55 0 1-.45 1-1v-4.5h-3.5zM9 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm8-7.5h2.5l2.25 2.25H17V11z"/>
          </svg>
        `),
        scaledSize: new google.maps.Size(40, 40),
        anchor: new google.maps.Point(20, 20)
      },
      zIndex: 200
    });

    this.loading.set(false);

    // Start animation if autoStart is true
    if (this.autoStart()) {
      setTimeout(() => this.startAnimation(), 500);
    }
  }

  startAnimation() {
    if (this.animating() || this.animationDone()) return;

    const coords = this.routeCoords();
    if (!coords || coords.length < 2) return;

    this.animating.set(true);
    let currentIndex = 0;
    const totalSteps = coords.length - 1;
    const speed = this.animationSpeed();

    // Interpolate between points for smoother animation
    const interpolatedPath: any[] = [];
    for (let i = 0; i < coords.length - 1; i++) {
      const start = coords[i];
      const end = coords[i + 1];
      const steps = 10; // 10 interpolation steps between each point

      for (let j = 0; j < steps; j++) {
        const t = j / steps;
        const lat = start[0] + (end[0] - start[0]) * t;
        const lng = start[1] + (end[1] - start[1]) * t;
        interpolatedPath.push(new google.maps.LatLng(lat, lng));
      }
    }
    // Add final point
    const last = coords[coords.length - 1];
    interpolatedPath.push(new google.maps.LatLng(last[0], last[1]));

    let pathIndex = 0;
    const animationStepTime = speed / 10; // Faster for interpolated path

    this.animationInterval = setInterval(() => {
      if (pathIndex >= interpolatedPath.length) {
        clearInterval(this.animationInterval);
        this.animating.set(false);
        this.animationDone.set(true);
        this.animationComplete.emit();
        return;
      }

      const pos = interpolatedPath[pathIndex];
      this.truckMarker.setPosition(pos);
      pathIndex++;
    }, animationStepTime);
  }

  ngOnDestroy() {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
    }
    this.routeLine?.setMap(null);
    this.truckMarker?.setMap(null);
    this.stopMarkers.forEach(m => m.setMap(null));
  }
}
