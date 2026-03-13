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
import { TooltipModule } from 'primeng/tooltip';
import { BadgeModule } from 'primeng/badge';
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';

// App
import { MAP_DEFAULTS, LEAFLET_TILES, LEAFLET_ASSETS, LEAFLET_ICON } from '../../core/constants/map.constants';
import {
  RoadBuilderService,
  RouteResult,
  SavedRoad,
  SavedRoadDetail,
  SaveRoadRequest,
  RefShort
} from '../../services/road-builder.service';

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
    TooltipModule,
    BadgeModule,
    SelectModule,
    DialogModule,
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
    ]),
    trigger('slideIn', [
      transition(':enter', [
        style({ transform: 'translateX(-100%)', opacity: 0 }),
        animate('200ms ease-out', style({ transform: 'translateX(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ transform: 'translateX(-100%)', opacity: 0 }))
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
  loading = signal(false);
  saving = signal(false);

  // Dialog state
  showDialog = signal(false);
  editingRoad = signal<SavedRoadDetail | null>(null);

  // Form fields
  formRefShort = signal<RefShort>('CW');
  formRef = signal('');
  formPlaceStart = signal('');
  formPlaceEnd = signal('');
  formName = signal('');

  // Road type options
  refShortOptions = [
    { label: 'A (Autoroute)', value: 'A' },
    { label: 'RN (Route Nationale)', value: 'RN' },
    { label: 'CW (Chemin Wilaya)', value: 'CW' },
    { label: 'CC (Chemin Communal)', value: 'CC' }
  ];

  // Roads panel state
  showRoadsPanel = signal(false);
  savedRoads = signal<SavedRoad[]>([]);
  loadingRoads = signal(false);

  // Map layer options
  layerOptions = [
    { label: 'Google', value: 'google' },
    { label: 'CartoDB', value: 'cartodb' }
  ];
  selectedLayer = signal('google');

  ngOnInit(): void {
    this.initMap();
    this.loadSavedRoads();
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
    this.setTileLayer('google');

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
    this.rebuildMarkers();
    this.clearRoute();
  }

  private createMarker(latlng: L.LatLng, index: number): L.Marker {
    const marker = L.marker(latlng, {
      draggable: true,
      icon: L.divIcon({
        className: 'point-marker',
        html: `<div class="point-marker-inner">${index}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      })
    });

    // Drag end - update point position
    marker.on('dragend', () => {
      const newLatLng = marker.getLatLng();
      const points = this.points();
      points[index - 1] = newLatLng;
      this.points.set([...points]);
      this.clearRoute();
      this.messageService.add({
        severity: 'info',
        summary: 'Point moved',
        detail: 'Generate route again to update',
        life: 2000
      });
    });

    // Right-click to delete
    marker.on('contextmenu', (e: L.LeafletMouseEvent) => {
      if (e.originalEvent) {
        e.originalEvent.preventDefault();
      }
      this.deletePoint(index - 1);
    });

    // Popup with delete option
    marker.bindPopup(`
      <div style="text-align: center;">
        <b>Point ${index}</b><br>
        ${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}<br>
        <small style="color: #666;">Drag to move · Right-click to delete</small>
      </div>
    `);

    return marker;
  }

  private rebuildMarkers(): void {
    this.markersLayer.clearLayers();
    this.points().forEach((p, i) => {
      const marker = this.createMarker(p, i + 1);
      marker.addTo(this.markersLayer);
    });
  }

  deletePoint(index: number): void {
    const points = this.points();
    if (points.length > 0) {
      points.splice(index, 1);
      this.points.set([...points]);
      this.rebuildMarkers();
      this.clearRoute();
    }
  }

  clearPoints(): void {
    this.points.set([]);
    this.markersLayer.clearLayers();
    this.clearRoute();
    this.resetForm();
    this.editingRoad.set(null);
  }

  private resetForm(): void {
    this.formRefShort.set('CW');
    this.formRef.set('');
    this.formPlaceStart.set('');
    this.formPlaceEnd.set('');
    this.formName.set('');
  }

  removeLastPoint(): void {
    const points = this.points();
    if (points.length > 0) {
      this.points.set(points.slice(0, -1));
      this.rebuildMarkers();
      this.clearRoute();
    }
  }

  private clearRoute(): void {
    this.routeLayer.clearLayers();
    this.currentRoute.set(null);
  }

  // Roads panel methods
  toggleRoadsPanel(): void {
    this.showRoadsPanel.set(!this.showRoadsPanel());
    if (this.showRoadsPanel()) {
      this.loadSavedRoads();
      setTimeout(() => this.map.invalidateSize(), 250);
    } else {
      setTimeout(() => this.map.invalidateSize(), 200);
    }
  }

  async loadSavedRoads(): Promise<void> {
    this.loadingRoads.set(true);
    try {
      const roads = await this.roadBuilderService.getSavedRoads();
      this.savedRoads.set(roads);
    } catch (error: unknown) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load saved roads'
      });
    } finally {
      this.loadingRoads.set(false);
    }
  }

  async loadRoadForEdit(id: number): Promise<void> {
    try {
      const road = await this.roadBuilderService.getRoad(id);

      // Clear current state
      this.points.set([]);
      this.markersLayer.clearLayers();
      this.routeLayer.clearLayers();
      this.currentRoute.set(null);

      // Set editing state
      this.editingRoad.set(road);

      // Populate form
      this.formRefShort.set(road.ref_short);
      this.formRef.set(road.ref);
      this.formPlaceStart.set(road.place_start || '');
      this.formPlaceEnd.set(road.place_end || '');
      this.formName.set(road.name || '');

      // Draw the road on map
      if (road.coordinates.length > 0) {
        const routeCoords = road.coordinates.map(c => L.latLng(c.lat, c.lng));
        const polyline = L.polyline(routeCoords, {
          color: road.color || '#3B82F6',
          weight: 5,
          opacity: 0.8
        });
        polyline.addTo(this.routeLayer);

        // Fit map to road
        this.map.fitBounds(polyline.getBounds(), { padding: [50, 50] });

        // Set current route for editing
        this.currentRoute.set({
          coordinates: road.coordinates,
          distance_km: road.length_km,
          duration_min: road.time_minutes,
          provider: 'osrm'
        });

        // Set start and end points (draggable)
        const startPoint = routeCoords[0];
        const endPoint = routeCoords[routeCoords.length - 1];
        this.points.set([startPoint, endPoint]);
        this.rebuildMarkers();
      }

      // Open dialog for editing
      this.showDialog.set(true);

    } catch (error: unknown) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load road'
      });
    }
  }

  async deleteRoad(id: number, event: Event): Promise<void> {
    event.stopPropagation();

    try {
      await this.roadBuilderService.deleteRoad(id);
      this.savedRoads.set(this.savedRoads().filter(r => r.id !== id));

      // Clear if we were editing this road
      if (this.editingRoad()?.id === id) {
        this.clearPoints();
        this.showDialog.set(false);
      }

      this.messageService.add({
        severity: 'success',
        summary: 'Road deleted',
        detail: 'Road has been removed'
      });
    } catch (error: unknown) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to delete road'
      });
    }
  }

  cancelEdit(): void {
    this.showDialog.set(false);
    this.editingRoad.set(null);
    this.clearPoints();
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

      // Open dialog to fill in details
      this.showDialog.set(true);

    } catch (error: unknown) {
      const err = error as Error;
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: err.message || 'Failed to generate route'
      });
    } finally {
      this.loading.set(false);
    }
  }

  openSaveDialog(): void {
    if (!this.currentRoute()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'No route',
        detail: 'Generate a route first'
      });
      return;
    }
    this.showDialog.set(true);
  }

  closeDialog(): void {
    this.showDialog.set(false);
  }

  async saveRoad(): Promise<void> {
    const route = this.currentRoute();
    const ref = this.formRef().trim();

    if (!route) {
      this.messageService.add({
        severity: 'warn',
        summary: 'No route',
        detail: 'Generate a route first'
      });
      return;
    }

    if (!ref) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Ref required',
        detail: 'Enter a reference for this road (e.g., CW 11)'
      });
      return;
    }

    this.saving.set(true);

    try {
      const request: SaveRoadRequest = {
        ref_short: this.formRefShort(),
        ref,
        coordinates: route.coordinates,
        length_km: route.distance_km,
        time_minutes: route.duration_min,
        place_start: this.formPlaceStart().trim() || undefined,
        place_end: this.formPlaceEnd().trim() || undefined,
        name: this.formName().trim() || undefined,
      };

      const isEditing = this.editingRoad() !== null;

      if (isEditing) {
        await this.roadBuilderService.updateRoad(this.editingRoad()!.id, request);
      } else {
        await this.roadBuilderService.saveRoad(request);
      }

      this.messageService.add({
        severity: 'success',
        summary: isEditing ? 'Road updated' : 'Road saved',
        detail: `"${ref}" has been ${isEditing ? 'updated' : 'added to the database'}`
      });

      // Reload roads list
      await this.loadSavedRoads();

      // Close dialog and clear
      this.showDialog.set(false);
      this.clearPoints();

    } catch (error: unknown) {
      const err = error as Error;
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: err.message || 'Failed to save road'
      });
    } finally {
      this.saving.set(false);
    }
  }

  // Helper to get color preview
  getRefShortColor(refShort: RefShort): string {
    const colors: Record<RefShort, string> = {
      'A': '#E74C3C',
      'RN': '#E67E22',
      'CW': '#F1C40F',
      'CC': '#3498DB'
    };
    return colors[refShort];
  }

  // Format ref as user types: "cw12" → "CW 12"
  onRefInput(value: string): void {
    const formatted = this.formatRef(value);
    this.formRef.set(formatted);
  }

  private formatRef(value: string): string {
    if (!value) return '';

    // Remove extra spaces and trim
    let cleaned = value.replace(/\s+/g, '').toUpperCase();

    // Find where letters end and numbers begin
    const match = cleaned.match(/^([A-Z]+)(\d+)$/);

    if (match) {
      // Format as "XX DDD" (letters + space + numbers)
      return `${match[1]} ${match[2]}`;
    }

    // If it's just letters or just numbers, return uppercase
    return value.toUpperCase();
  }
}
