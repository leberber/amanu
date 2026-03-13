import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import * as L from 'leaflet';

// PrimeNG
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { SelectButtonModule } from 'primeng/selectbutton';
import { MessageService } from 'primeng/api';

// App
import { MAP_DEFAULTS, LEAFLET_TILES, LEAFLET_ASSETS, LEAFLET_ICON } from '../../core/constants/map.constants';
import { RoadBuilderService, RouteResult } from '../../services/road-builder.service';

@Component({
  selector: 'app-graph-builder',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    ToastModule,
    SelectButtonModule,
  ],
  providers: [MessageService],
  templateUrl: './graph-builder.component.html',
  styleUrl: './graph-builder.component.scss',
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('200ms ease-out', style({ opacity: 1 }))
      ])
    ])
  ]
})
export class GraphBuilderComponent implements OnInit, OnDestroy {
  private roadBuilderService = inject(RoadBuilderService);
  private messageService = inject(MessageService);

  // Map
  private map!: L.Map;
  private markersLayer = L.layerGroup();
  private routeLayer = L.layerGroup();
  private currentTileLayer!: L.TileLayer;

  // State
  points = signal<L.LatLng[]>([]);
  currentRoute = signal<RouteResult | null>(null);
  roadName = signal('');
  loading = signal(false);
  saving = signal(false);

  // Map layer options
  layerOptions = [
    { label: 'Google', value: 'google' },
    { label: 'CartoDB', value: 'cartodb' }
  ];
  selectedLayer = signal('cartodb');

  ngOnInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  private initMap(): void {
    // Fix Leaflet marker icons
    const iconDefault = L.icon({
      iconUrl: LEAFLET_ASSETS.MARKER_ICON,
      iconRetinaUrl: LEAFLET_ASSETS.MARKER_ICON_RETINA,
      shadowUrl: LEAFLET_ASSETS.MARKER_SHADOW,
      iconSize: LEAFLET_ICON.SIZE,
      iconAnchor: LEAFLET_ICON.ANCHOR,
      popupAnchor: LEAFLET_ICON.POPUP_ANCHOR,
      shadowSize: LEAFLET_ICON.SHADOW_SIZE
    });
    L.Marker.prototype.options.icon = iconDefault;

    // Create map - zoom 12 shows ~20km area well
    this.map = L.map('graph-builder-map', {
      center: [MAP_DEFAULTS.LATITUDE, MAP_DEFAULTS.LONGITUDE],
      zoom: 12,
      zoomControl: true
    });

    // Add default tile layer
    this.setTileLayer('cartodb');

    // Add layer groups
    this.markersLayer.addTo(this.map);
    this.routeLayer.addTo(this.map);

    // Click handler to add points
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.addPoint(e.latlng);
    });

    // Invalidate size after render
    setTimeout(() => this.map.invalidateSize(), 200);
  }

  private setTileLayer(type: 'google' | 'cartodb'): void {
    if (this.currentTileLayer) {
      this.map.removeLayer(this.currentTileLayer);
    }

    const config = type === 'google' ? LEAFLET_TILES.GOOGLE : LEAFLET_TILES.CARTODB_LIGHT;

    this.currentTileLayer = L.tileLayer(config.URL, {
      maxZoom: config.MAX_ZOOM,
      subdomains: config.SUBDOMAINS,
      attribution: config.ATTRIBUTION
    });

    this.currentTileLayer.addTo(this.map);
  }

  onLayerChange(layer: string): void {
    this.selectedLayer.set(layer);
    this.setTileLayer(layer as 'google' | 'cartodb');
  }

  private addPoint(latlng: L.LatLng): void {
    const points = [...this.points(), latlng];
    this.points.set(points);

    // Add numbered marker
    const index = points.length;
    const marker = L.marker(latlng, {
      icon: L.divIcon({
        className: 'point-marker',
        html: `<div class="point-marker-inner">${index}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      })
    });

    marker.bindPopup(`Point ${index}<br>${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`);
    marker.addTo(this.markersLayer);

    // Clear current route when points change
    this.clearRoute();
  }

  clearPoints(): void {
    this.points.set([]);
    this.markersLayer.clearLayers();
    this.clearRoute();
    this.roadName.set('');
  }

  removeLastPoint(): void {
    const points = this.points();
    if (points.length > 0) {
      this.points.set(points.slice(0, -1));
      // Rebuild markers
      this.markersLayer.clearLayers();
      this.points().forEach((p, i) => {
        const marker = L.marker(p, {
          icon: L.divIcon({
            className: 'point-marker',
            html: `<div class="point-marker-inner">${i + 1}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          })
        });
        marker.addTo(this.markersLayer);
      });
      this.clearRoute();
    }
  }

  private clearRoute(): void {
    this.routeLayer.clearLayers();
    this.currentRoute.set(null);
  }

  async generateRoute(provider: 'osrm' | 'google'): Promise<void> {
    const points = this.points();
    if (points.length < 2) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Not enough points',
        detail: 'Click on the map to add at least 2 points'
      });
      return;
    }

    this.loading.set(true);
    this.clearRoute();

    try {
      const coordinates = points.map(p => ({ lat: p.lat, lng: p.lng }));
      const result = await this.roadBuilderService.getRoute(coordinates, provider);

      this.currentRoute.set(result);

      // Draw route on map
      const routeCoords = result.coordinates.map(c => L.latLng(c.lat, c.lng));
      const polyline = L.polyline(routeCoords, {
        color: '#3B82F6',
        weight: 5,
        opacity: 0.8
      });
      polyline.addTo(this.routeLayer);

      // Fit map to route
      this.map.fitBounds(polyline.getBounds(), { padding: [50, 50] });

      this.messageService.add({
        severity: 'success',
        summary: 'Route generated',
        detail: `${result.distance_km.toFixed(2)} km via ${provider.toUpperCase()}`
      });
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: error.message || 'Failed to generate route'
      });
    } finally {
      this.loading.set(false);
    }
  }

  async saveRoad(): Promise<void> {
    const route = this.currentRoute();
    const name = this.roadName().trim();

    if (!route) {
      this.messageService.add({
        severity: 'warn',
        summary: 'No route',
        detail: 'Generate a route first'
      });
      return;
    }

    if (!name) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Name required',
        detail: 'Enter a name for this road'
      });
      return;
    }

    this.saving.set(true);

    try {
      await this.roadBuilderService.saveRoad(name, route);

      this.messageService.add({
        severity: 'success',
        summary: 'Road saved',
        detail: `"${name}" has been added to the database`
      });

      // Clear everything for next road
      this.clearPoints();
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: error.message || 'Failed to save road'
      });
    } finally {
      this.saving.set(false);
    }
  }
}
