import { Component, OnInit, inject, signal, computed, DestroyRef, effect } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { ConfirmationService, MessageService } from 'primeng/api';
import { trigger, transition, style, animate } from '@angular/animations';
import { TranslateService } from '@ngx-translate/core';
import * as L from 'leaflet';

import { ADMIN_LIST_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { BatchingService, SmartBatch, CustomerRoute } from '../../../services/batching.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { Trip, TripWithStops, TripStatus, PendingOrder } from '../../../models/trip.model';
import { RouteHelpers } from '../../../core/constants/routes.constants';
import { MAP_DEFAULTS, LEAFLET_TILES, LEAFLET_ASSETS } from '../../../core/constants/map.constants';

type TabType = 'map' | 'trips';

// Constants
const CORRIDOR_COLORS: Record<string, string> = {
  'TIZI_OUZOU': '#3B82F6',      // Blue - Northwest corridor
  'AGOUNI_GUEGHRANE': '#10B981', // Green - Southeast corridor
  'OTHER': '#9CA3AF'             // Gray - Uncategorized
};
const DEFAULT_MARKER_COLOR = '#6366F1';
const MARKER_STYLES = { default: { radius: 8, weight: 2 }, clustered: { radius: 12, weight: 3 } };

const STATUS_CONFIG: Record<TripStatus, { severity: 'secondary' | 'info' | 'warn' | 'success' | 'danger'; label: string }> = {
  pending: { severity: 'secondary', label: 'En attente' },
  assigned: { severity: 'info', label: 'Assignée' },
  in_progress: { severity: 'warn', label: 'En cours' },
  completed: { severity: 'success', label: 'Terminée' },
  cancelled: { severity: 'danger', label: 'Annulée' }
};

@Component({
  selector: 'app-admin-batching',
  standalone: true,
  imports: [...ADMIN_LIST_IMPORTS, AgroclikPageContainerComponent, DialogModule, SelectModule],
  templateUrl: './admin-batching.component.html',
  styleUrl: './admin-batching.component.scss',
  providers: [ConfirmationService, MessageService],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class AdminBatchingComponent implements OnInit {
  private batchingService = inject(BatchingService);
  private toast = inject(ToastMessageService);
  private confirmationService = inject(ConfirmationService);
  private translate = inject(TranslateService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  // Map
  private map: L.Map | null = null;
  private markersLayer: L.LayerGroup | null = null;
  private connectionsLayer: L.LayerGroup | null = null;
  private routesLayer: L.LayerGroup | null = null;

  // State
  loading = signal(true);
  loadingOrders = signal(false);
  submittingBatches = signal(false);
  activeTab = signal<TabType>('map');
  mapInitialized = signal(false);
  pendingOrders = signal<PendingOrder[]>([]);

  // Smart batching state
  smartBatchingActive = signal(false);
  runningSmartBatch = signal(false);
  smartBatches = signal<SmartBatch[]>([]);
  customerRoutes = signal<CustomerRoute[]>([]);
  showRoutePolylines = signal(false);
  resettingBatches = signal(false);

  // Corridor visibility toggle (for legend)
  corridorVisibility = signal<Record<string, boolean>>({});
  private corridorLayers: Record<string, { markers: L.Layer[], polyline: L.Polyline | null }> = {};

  // Filter
  statusFilter = signal<TripStatus | null>(null);

  // Dialogs
  showTripDialog = signal(false);
  selectedTrip = signal<TripWithStops | null>(null);
  loadingTripDetail = signal(false);
  showAssignDialog = signal(false);
  tripToAssign = signal<Trip | null>(null);
  selectedDriverId: number | null = null;
  assigning = signal(false);

  // Data from service
  stats = this.batchingService.stats;
  trips = this.batchingService.trips;
  drivers = this.batchingService.drivers;

  filteredTrips = computed(() => {
    const status = this.statusFilter();
    return status ? this.trips().filter(t => t.status === status) : this.trips();
  });

  constructor() {
    // Initialize map when on map tab
    effect(() => {
      const tab = this.activeTab();
      if (tab === 'map' && !this.loading() && this.stats()) {
        setTimeout(() => this.initMap(), 100);
      } else if (tab !== 'map') {
        this.destroyMap();
      }
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  // ==================== Map ====================

  private initMap(): void {
    if (this.mapInitialized() && this.map) return;
    if (!document.getElementById('batching-map')) return;

    L.Icon.Default.mergeOptions({
      iconRetinaUrl: LEAFLET_ASSETS.MARKER_ICON_RETINA,
      iconUrl: LEAFLET_ASSETS.MARKER_ICON,
      shadowUrl: LEAFLET_ASSETS.MARKER_SHADOW
    });

    this.map = L.map('batching-map', {
      center: [MAP_DEFAULTS.LATITUDE, MAP_DEFAULTS.LONGITUDE],
      zoom: MAP_DEFAULTS.OVERVIEW_ZOOM
    });

    this.setupTileLayers();
    this.routesLayer = L.layerGroup().addTo(this.map);
    this.connectionsLayer = L.layerGroup().addTo(this.map);
    this.markersLayer = L.layerGroup().addTo(this.map);
    this.addWarehouseMarker();
    this.mapInitialized.set(true);
    setTimeout(() => this.map?.invalidateSize(), 200);
  }

  private setupTileLayers(): void {
    if (!this.map) return;

    const createLayer = (config: typeof LEAFLET_TILES.CARTODB_LIGHT) =>
      L.tileLayer(config.URL, { maxZoom: config.MAX_ZOOM, subdomains: config.SUBDOMAINS, attribution: config.ATTRIBUTION });

    const layers = {
      'Carto Light': createLayer(LEAFLET_TILES.CARTODB_LIGHT),
      'Carto Dark': createLayer(LEAFLET_TILES.CARTODB_DARK),
      'Google Maps': createLayer(LEAFLET_TILES.GOOGLE)
    };

    layers['Carto Light'].addTo(this.map);
    L.control.layers(layers, {}, { position: 'topright', collapsed: true }).addTo(this.map);
  }

  private addWarehouseMarker(): void {
    if (!this.map) return;

    const icon = L.divIcon({
      className: 'warehouse-marker',
      html: `<div style="width:40px;height:40px;background:linear-gradient(135deg,#F59E0B,#D97706);border-radius:50%;border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><i class="pi pi-warehouse" style="color:white;font-size:18px;"></i></div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    L.marker([MAP_DEFAULTS.LATITUDE, MAP_DEFAULTS.LONGITUDE], { icon, zIndexOffset: 1000 })
      .bindPopup('<div style="text-align:center;padding:8px;"><strong>Entrepôt</strong><br><span style="color:#666;font-size:12px;">Point de départ</span></div>')
      .addTo(this.map);
  }

  private destroyMap(): void {
    if (!this.map) return;
    this.map.remove();
    this.map = this.markersLayer = this.connectionsLayer = this.routesLayer = null;
    this.mapInitialized.set(false);
    this.smartBatchingActive.set(false);
    this.smartBatches.set([]);
    this.showRoutePolylines.set(false);
  }

  private updateMapMarkers(): void {
    if (!this.map || !this.markersLayer) return;
    this.markersLayer.clearLayers();

    const orders = this.pendingOrders();
    if (!orders.length) return;

    const bounds = L.latLngBounds([]);

    orders.forEach(order => {
      if (!order.latitude || !order.longitude) return;

      const marker = this.createOrderMarker(order, DEFAULT_MARKER_COLOR, MARKER_STYLES.default);
      marker.addTo(this.markersLayer!);
      bounds.extend([order.latitude, order.longitude]);
    });

    if (bounds.isValid()) this.map.fitBounds(bounds, { padding: [50, 50] });
  }

  private createOrderMarker(order: PendingOrder, color: string, style: typeof MARKER_STYLES.default, showColorDot = false): L.CircleMarker {
    const marker = L.circleMarker([order.latitude!, order.longitude!], {
      radius: style.radius,
      fillColor: color,
      color: '#fff',
      weight: style.weight,
      opacity: 1,
      fillOpacity: 0.9
    });

    marker.bindPopup(this.createOrderPopup(order, showColorDot ? color : undefined));
    return marker;
  }

  private createOrderPopup(order: PendingOrder, color?: string): string {
    const colorDot = color ? `<span style="width:12px;height:12px;border-radius:50%;background:${color};"></span>` : '';
    return `
      <div style="min-width:180px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          ${colorDot}<strong>#${order.id}</strong>${!color ? ` - ${order.customer_name}` : ''}
        </div>
        ${color ? `<span style="font-weight:500;">${order.customer_name}</span><br>` : ''}
        <span style="color:#666;font-size:12px;">${order.address}</span>
        <div style="margin-top:8px;display:flex;justify-content:space-between;">
          <span>${order.weight_kg.toFixed(1)} kg</span>
          <span style="color:#10B981;font-weight:600;">${order.shipping_cost} DA</span>
        </div>
      </div>
    `;
  }

  // ==================== Smart Batching ====================

  previewSmartBatching(): void {
    this.runningSmartBatch.set(true);
    this.batchingService.previewSmartBatching('farthest_first').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.runningSmartBatch.set(false);
        if (response.success && response.batches.length > 0) {
          this.smartBatches.set(response.batches);
          this.smartBatchingActive.set(true);
          this.drawSmartBatchMarkers();
          this.toast.showSuccess('admin.batching.smart_preview_success', {
            batches: response.batches.length,
            orders: response.summary.total_orders
          });
        } else {
          this.toast.showWarn('admin.batching.no_orders_to_batch');
        }
      },
      error: (err) => {
        this.runningSmartBatch.set(false);
        this.toast.showApiError(err, 'admin.batching.smart_preview_error');
      }
    });
  }

  runSmartBatching(): void {
    this.submittingBatches.set(true);
    this.batchingService.runSmartBatching('farthest_first').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.submittingBatches.set(false);
        if (response.success) {
          this.toast.showSuccess('admin.batching.smart_run_success', {
            trips: response.trips_created || 0,
            orders: response.summary.total_orders
          });
          this.deactivateSmartBatching();
          this.refreshAllData();
        }
      },
      error: (err) => {
        this.submittingBatches.set(false);
        this.toast.showApiError(err, 'admin.batching.smart_run_error');
      }
    });
  }

  deactivateSmartBatching(): void {
    this.smartBatchingActive.set(false);
    this.smartBatches.set([]);
    this.corridorLayers = {};
    this.corridorVisibility.set({});
    this.routesLayer?.clearLayers();
    this.connectionsLayer?.clearLayers();
    this.markersLayer?.clearLayers();
  }

  reinitializeSmartBatching(): void {
    this.confirmationService.confirm({
      message: this.translate.instant('admin.batching.reinitialize_confirm'),
      header: this.translate.instant('admin.batching.reinitialize_header'),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.resettingBatches.set(true);
        this.batchingService.resetAllTrips().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: (response) => {
            this.resettingBatches.set(false);
            this.toast.showSuccess('admin.batching.reset_success', { orders: response.orders_reset || 0 });
            this.deactivateSmartBatching();
            this.refreshAllData();
          },
          error: (err) => {
            this.resettingBatches.set(false);
            this.toast.showApiError(err, 'admin.batching.reset_error');
          }
        });
      }
    });
  }

  private drawSmartBatchMarkers(): void {
    if (!this.map || !this.markersLayer || !this.connectionsLayer) return;
    this.markersLayer.clearLayers();
    this.connectionsLayer.clearLayers();

    // Reset corridor tracking
    this.corridorLayers = {};
    const visibility: Record<string, boolean> = {};

    const batches = this.smartBatches();
    const bounds = L.latLngBounds([]);
    const depotLatLng: [number, number] = [MAP_DEFAULTS.LATITUDE, MAP_DEFAULTS.LONGITUDE];

    batches.forEach((batch, batchIndex) => {
      const corridorKey = `${batch.corridor}_${batchIndex}`;
      const color = CORRIDOR_COLORS[batch.corridor] || CORRIDOR_COLORS['OTHER'];

      // Initialize corridor visibility and layers
      visibility[corridorKey] = true;
      this.corridorLayers[corridorKey] = { markers: [], polyline: null };

      // Collect route points for polyline
      const routePoints: [number, number][] = [depotLatLng];

      batch.stops.forEach((stop, stopIndex) => {
        if (!stop.latitude || !stop.longitude) return;

        routePoints.push([stop.latitude, stop.longitude]);
        bounds.extend([stop.latitude, stop.longitude]);

        // Create marker with animation delay
        setTimeout(() => {
          if (!this.markersLayer) return;

          const marker = L.circleMarker([stop.latitude!, stop.longitude!], {
            radius: 12,
            fillColor: color,
            color: '#fff',
            weight: 3,
            opacity: 1,
            fillOpacity: 0.9
          });

          marker.bindPopup(`
            <div style="min-width:200px;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span style="width:24px;height:24px;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;">${stop.sequence}</span>
                <strong>#${stop.order_id}</strong>
              </div>
              <span style="font-weight:500;">${stop.customer_name}</span><br>
              <span style="color:#666;font-size:12px;">${stop.address}</span>
              <div style="margin-top:8px;display:flex;justify-content:space-between;">
                <span>${stop.weight_kg.toFixed(1)} kg</span>
                <span style="color:#10B981;font-weight:600;">${stop.distance_km.toFixed(1)} km</span>
              </div>
              <div style="margin-top:4px;color:#666;font-size:11px;">
                <i class="pi pi-road"></i> ${this.formatCorridor(batch.corridor)}
              </div>
            </div>
          `);

          marker.addTo(this.markersLayer!);
          this.corridorLayers[corridorKey].markers.push(marker);
        }, batchIndex * 150 + stopIndex * 50);
      });

      // Draw animated route line
      setTimeout(() => {
        if (!this.connectionsLayer || routePoints.length <= 1) return;

        const polyline = L.polyline(routePoints, {
          color: color,
          weight: 4,
          opacity: 0.8,
          dashArray: '10, 5'
        });

        polyline.addTo(this.connectionsLayer!);
        this.corridorLayers[corridorKey].polyline = polyline;
      }, batchIndex * 150 + batch.stops.length * 50);
    });

    // Set visibility state
    this.corridorVisibility.set(visibility);

    // Fit bounds after all markers drawn
    setTimeout(() => {
      if (bounds.isValid() && this.map) {
        this.map.fitBounds(bounds, { padding: [50, 50] });
      }
    }, batches.length * 150 + 300);
  }

  // Toggle corridor visibility from legend
  toggleCorridorVisibility(corridorKey: string): void {
    const current = this.corridorVisibility();
    const isVisible = current[corridorKey];
    const layers = this.corridorLayers[corridorKey];

    if (!layers) return;

    if (isVisible) {
      // Hide corridor
      layers.markers.forEach(marker => {
        if (this.markersLayer?.hasLayer(marker)) {
          this.markersLayer.removeLayer(marker);
        }
      });
      if (layers.polyline && this.connectionsLayer?.hasLayer(layers.polyline)) {
        this.connectionsLayer.removeLayer(layers.polyline);
      }
    } else {
      // Show corridor
      layers.markers.forEach(marker => {
        marker.addTo(this.markersLayer!);
      });
      if (layers.polyline) {
        layers.polyline.addTo(this.connectionsLayer!);
      }
    }

    // Update visibility state
    this.corridorVisibility.set({ ...current, [corridorKey]: !isVisible });
  }

  // Get corridor key for a batch
  getCorridorKey(batch: SmartBatch, index: number): string {
    return `${batch.corridor}_${index}`;
  }

  // Check if corridor is visible
  isCorridorVisible(corridorKey: string): boolean {
    return this.corridorVisibility()[corridorKey] ?? true;
  }

  loadCustomerRoutes(): void {
    this.batchingService.getCustomerRoutes().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (routes) => {
        this.customerRoutes.set(routes);
        if (routes.length > 0) {
          this.showRoutePolylines.set(true);
          this.drawRoutePolylines();
        }
      },
      error: () => this.toast.showError('admin.batching.routes_load_error')
    });
  }

  toggleRoutePolylines(): void {
    if (this.showRoutePolylines()) {
      this.showRoutePolylines.set(false);
      this.routesLayer?.clearLayers();
    } else {
      if (this.customerRoutes().length === 0) {
        this.loadCustomerRoutes();
      } else {
        this.showRoutePolylines.set(true);
        this.drawRoutePolylines();
      }
    }
  }

  private drawRoutePolylines(): void {
    if (!this.map || !this.routesLayer) return;
    this.routesLayer.clearLayers();

    const routes = this.customerRoutes();
    routes.forEach(route => {
      if (!route.route_polyline) return;

      try {
        const coordinates = this.decodePolyline(route.route_polyline);
        if (coordinates.length > 0) {
          const color = CORRIDOR_COLORS[route.corridor || 'OTHER'] || CORRIDOR_COLORS['OTHER'];
          L.polyline(coordinates, {
            color: color,
            weight: 2,
            opacity: 0.4
          }).addTo(this.routesLayer!);
        }
      } catch (e) {
        // Skip invalid polylines
      }
    });
  }

  private decodePolyline(encoded: string): [number, number][] {
    // Google polyline decoding algorithm
    const coordinates: [number, number][] = [];
    let index = 0, lat = 0, lng = 0;

    while (index < encoded.length) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
      lng += dlng;

      coordinates.push([lat / 1e5, lng / 1e5]);
    }

    return coordinates;
  }

  formatCorridor(corridor: string): string {
    return corridor.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  getCorridorColor(corridor: string): string {
    return CORRIDOR_COLORS[corridor] || CORRIDOR_COLORS['OTHER'];
  }

  getSmartBatchTotalWeight(): number {
    return this.smartBatches().reduce((sum, b) => sum + b.total_weight_kg, 0);
  }

  // ==================== Data ====================

  loadData(): void {
    this.loading.set(true);
    this.batchingService.getStats().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.loading.set(false);
        this.loadPendingOrders();
      },
      error: () => {
        this.loading.set(false);
        this.toast.showError('admin.batching.load_error');
      }
    });
    this.batchingService.getTrips().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    this.batchingService.getDrivers().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  loadPendingOrders(): void {
    this.loadingOrders.set(true);
    this.batchingService.getPendingOrders().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (orders) => {
        this.pendingOrders.set(orders);
        this.loadingOrders.set(false);
      },
      error: () => {
        this.loadingOrders.set(false);
        this.toast.showError('admin.batching.load_error');
      }
    });
  }

  private refreshAllData(): void {
    this.loadPendingOrders();
    this.batchingService.getStats().subscribe();
    this.batchingService.getTrips().subscribe();
  }

  // ==================== Tabs ====================

  setActiveTab(tab: TabType): void {
    this.activeTab.set(tab);
    if (tab === 'map' && !this.pendingOrders().length) this.loadPendingOrders();
    if (tab === 'trips') this.batchingService.getTrips().subscribe();
  }

  // ==================== Trip Dialog ====================

  viewTripDetails(trip: Trip): void {
    this.loadingTripDetail.set(true);
    this.showTripDialog.set(true);
    this.batchingService.getTripDetail(trip.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (t) => { this.selectedTrip.set(t); this.loadingTripDetail.set(false); },
      error: () => { this.loadingTripDetail.set(false); this.toast.showError('admin.batching.trip_detail_error'); this.showTripDialog.set(false); }
    });
  }

  closeTripDialog(): void {
    this.showTripDialog.set(false);
    this.selectedTrip.set(null);
  }

  // ==================== Assign Dialog ====================

  openAssignDialog(trip: Trip): void {
    this.tripToAssign.set(trip);
    this.selectedDriverId = null;
    this.showAssignDialog.set(true);
  }

  closeAssignDialog(): void {
    this.showAssignDialog.set(false);
    this.tripToAssign.set(null);
    this.selectedDriverId = null;
  }

  confirmAssign(): void {
    const trip = this.tripToAssign();
    if (!trip || !this.selectedDriverId) return;

    this.assigning.set(true);
    this.batchingService.assignTrip(trip.id, this.selectedDriverId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.assigning.set(false);
        this.toast.showSuccess('admin.batching.assign_success', { driver: res.trip?.driver_name });
        this.closeAssignDialog();
        this.batchingService.getStats().subscribe();
        this.batchingService.getTrips().subscribe();
      },
      error: (err) => { this.assigning.set(false); this.toast.showApiError(err, 'admin.batching.assign_error'); }
    });
  }

  // ==================== Trip Actions ====================

  unassignTrip(trip: Trip): void {
    this.confirmationService.confirm({
      message: `Désassigner la tournée #${trip.id} de ${trip.driver_name}?`,
      header: 'Désassigner',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.batchingService.unassignTrip(trip.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: () => { this.toast.showSuccess('admin.batching.unassign_success'); this.batchingService.getStats().subscribe(); this.batchingService.getTrips().subscribe(); },
          error: () => this.toast.showError('admin.batching.unassign_error')
        });
      }
    });
  }

  cancelTrip(trip: Trip): void {
    this.confirmationService.confirm({
      message: `Annuler la tournée #${trip.id}? Les commandes seront remises en attente.`,
      header: 'Annuler la tournée',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.batchingService.cancelTrip(trip.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: () => { this.toast.showSuccess('admin.batching.cancel_success'); this.refreshAllData(); },
          error: () => this.toast.showError('admin.batching.cancel_error')
        });
      }
    });
  }

  goToOrder(orderId: number): void {
    this.router.navigate([RouteHelpers.adminOrderDetail(orderId)]);
  }

  // ==================== Helpers ====================

  getStatusSeverity(status: TripStatus) { return STATUS_CONFIG[status]?.severity || 'secondary'; }
  getStatusLabel(status: TripStatus) { return STATUS_CONFIG[status]?.label || status; }

  filterByStatus(status: TripStatus | null): void {
    this.statusFilter.set(status);
    this.batchingService.getTrips(status || undefined).subscribe();
  }

  formatZone(zone?: string): string {
    return zone ? zone.replace('zone_', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Inconnu';
  }
}
