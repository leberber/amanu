import { Component, OnInit, inject, signal, computed, DestroyRef, effect } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { ConfirmationService, MessageService } from 'primeng/api';
import { trigger, transition, style, animate } from '@angular/animations';
import * as L from 'leaflet';
import { cellToParent, isValidCell, cellToBoundary } from 'h3-js';

import { ADMIN_LIST_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { BatchingService } from '../../../services/batching.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { Trip, TripWithStops, TripStatus, PendingOrder } from '../../../models/trip.model';
import { RouteHelpers } from '../../../core/constants/routes.constants';
import { MAP_DEFAULTS, LEAFLET_TILES, LEAFLET_ASSETS } from '../../../core/constants/map.constants';

type TabType = 'map' | 'trips';

interface MapCluster {
  h3Index: string;
  orders: PendingOrder[];
  color: string;
  center: [number, number];
  boundary: [number, number][];
}

interface ClusteringParams {
  minOrdersPerBatch: number;
  maxOrdersPerBatch: number;
  maxWeightPerBatch: number; // 0 = no limit
  h3Resolution: number;
}

const DEFAULT_CLUSTERING_PARAMS: ClusteringParams = {
  minOrdersPerBatch: 2,
  maxOrdersPerBatch: 3,
  maxWeightPerBatch: 0,
  h3Resolution: 7
};

// Constants
const CLUSTER_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'];
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
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  // Expose Math for template
  protected Math = Math;

  // Map
  private h3ColorMap = new Map<string, string>();
  private map: L.Map | null = null;
  private markersLayer: L.LayerGroup | null = null;
  private clustersLayer: L.LayerGroup | null = null;
  private connectionsLayer: L.LayerGroup | null = null;

  // State
  loading = signal(true);
  loadingOrders = signal(false);
  organizingBatches = signal(false);
  submittingBatches = signal(false);
  activeTab = signal<TabType>('map');
  mapInitialized = signal(false);
  mapClusteringActive = signal(false);
  mapClusters = signal<MapCluster[]>([]);
  pendingOrders = signal<PendingOrder[]>([]);

  // Clustering parameters
  showClusterSettings = signal(false);
  clusterParams = signal<ClusteringParams>({ ...DEFAULT_CLUSTERING_PARAMS });
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
    effect(() => {
      const tab = this.activeTab();
      if (tab === 'map' && !this.loading() && this.stats() && !this.loadingOrders()) {
        setTimeout(() => this.initMap(), 100);
      } else if (tab !== 'map') {
        this.destroyMap();
      }
    });

    effect(() => {
      this.pendingOrders(); // Track changes
      if (this.map && this.markersLayer && this.mapInitialized()) {
        this.updateMapMarkers();
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
    this.clustersLayer = L.layerGroup().addTo(this.map);
    this.connectionsLayer = L.layerGroup().addTo(this.map);
    this.markersLayer = L.layerGroup().addTo(this.map);
    this.addWarehouseMarker();
    this.mapInitialized.set(true);
    this.updateMapMarkers();
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
    this.map = this.markersLayer = this.clustersLayer = this.connectionsLayer = null;
    this.mapInitialized.set(false);
    this.mapClusteringActive.set(false);
    this.mapClusters.set([]);
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

  private getH3Color(h3Index: string): string {
    if (!this.h3ColorMap.has(h3Index)) {
      this.h3ColorMap.set(h3Index, CLUSTER_COLORS[this.h3ColorMap.size % CLUSTER_COLORS.length]);
    }
    return this.h3ColorMap.get(h3Index)!;
  }

  // ==================== Clustering ====================

  activateMapClustering(): void {
    if (!this.map) return;
    this.organizingBatches.set(true);

    const h3Groups = this.groupOrdersByH3();
    const clusters = this.createClustersFromGroups(h3Groups);
    this.mapClusters.set(clusters);

    setTimeout(() => {
      this.mapClusteringActive.set(true);
      this.drawClusterBoundaries();
      this.drawClusteredMarkers();
      this.organizingBatches.set(false);
      this.toast.showSuccess('admin.batching.h3_cluster_success', { batches: clusters.length, clusters: clusters.length });
    }, 300);
  }

  private groupOrdersByH3(): Map<string, PendingOrder[]> {
    const groups = new Map<string, PendingOrder[]>();
    const resolution = this.clusterParams().h3Resolution;

    this.pendingOrders().forEach(order => {
      if (!order.h3_index || !isValidCell(order.h3_index) || !order.latitude || !order.longitude) return;
      try {
        const parentCell = cellToParent(order.h3_index, resolution);
        if (!groups.has(parentCell)) groups.set(parentCell, []);
        groups.get(parentCell)!.push(order);
      } catch { /* Skip invalid */ }
    });

    return groups;
  }

  private createClustersFromGroups(groups: Map<string, PendingOrder[]>): MapCluster[] {
    this.h3ColorMap.clear();
    const clusters: MapCluster[] = [];

    groups.forEach((orders, h3Index) => {
      const boundary = cellToBoundary(h3Index, true).map(([lat, lng]): [number, number] => [lat, lng]);
      const center: [number, number] = [
        orders.reduce((sum, o) => sum + (o.latitude || 0), 0) / orders.length,
        orders.reduce((sum, o) => sum + (o.longitude || 0), 0) / orders.length
      ];

      clusters.push({ h3Index, orders, color: this.getH3Color(h3Index), center, boundary });
    });

    return clusters;
  }

  deactivateMapClustering(): void {
    this.mapClusteringActive.set(false);
    this.mapClusters.set([]);
    this.h3ColorMap.clear();
    this.clustersLayer?.clearLayers();
    this.connectionsLayer?.clearLayers();
    this.updateMapMarkers();
  }

  private drawClusterBoundaries(): void {
    if (!this.clustersLayer) return;
    this.clustersLayer.clearLayers();

    this.mapClusters().forEach((cluster, i) => {
      setTimeout(() => {
        const polygon = L.polygon(cluster.boundary, {
          color: cluster.color, weight: 3, opacity: 0.8,
          fillColor: cluster.color, fillOpacity: 0.15
        });

        const weight = cluster.orders.reduce((s, o) => s + o.weight_kg, 0).toFixed(1);
        polygon.bindTooltip(`<div style="text-align:center;"><strong>${cluster.orders.length} commandes</strong><br><span style="color:#666;font-size:11px;">${weight} kg</span></div>`, { direction: 'center' });
        polygon.addTo(this.clustersLayer!);
      }, i * 100);
    });
  }

  private drawClusteredMarkers(): void {
    if (!this.markersLayer || !this.connectionsLayer) return;
    this.markersLayer.clearLayers();
    this.connectionsLayer.clearLayers();

    const clusters = this.mapClusters();
    const bounds = L.latLngBounds([]);

    clusters.forEach((cluster, ci) => {
      setTimeout(() => {
        cluster.orders.forEach((order, oi) => {
          if (!order.latitude || !order.longitude) return;

          // Connection line
          L.polyline([cluster.center, [order.latitude, order.longitude]], {
            color: cluster.color, weight: 2, opacity: 0.5, dashArray: '5, 5'
          }).addTo(this.connectionsLayer!);

          // Marker with delay
          setTimeout(() => {
            const marker = this.createOrderMarker(order, cluster.color, MARKER_STYLES.clustered, true);
            marker.addTo(this.markersLayer!);
            bounds.extend([order.latitude!, order.longitude!]);

            // Fit bounds after last marker
            if (ci === clusters.length - 1 && oi === cluster.orders.length - 1 && bounds.isValid()) {
              this.map!.fitBounds(bounds, { padding: [50, 50] });
            }
          }, oi * 50);
        });
      }, ci * 150);
    });
  }

  createBatchesFromMapClusters(): void {
    const clusters = this.mapClusters();
    if (!clusters.length) return;

    const params = this.clusterParams();
    const batches: { order_ids: number[] }[] = [];

    clusters.forEach(cluster => {
      const sorted = [...cluster.orders].sort((a, b) => (b.weight_kg || 0) - (a.weight_kg || 0));

      let currentBatch: PendingOrder[] = [];
      let currentWeight = 0;

      for (const order of sorted) {
        const orderWeight = order.weight_kg || 0;
        const wouldExceedWeight = params.maxWeightPerBatch > 0 &&
          currentWeight + orderWeight > params.maxWeightPerBatch;
        const wouldExceedCount = currentBatch.length >= params.maxOrdersPerBatch;

        // Start new batch if limits exceeded
        if (wouldExceedWeight || wouldExceedCount) {
          if (currentBatch.length >= params.minOrdersPerBatch) {
            batches.push({ order_ids: currentBatch.map(o => o.id) });
          }
          currentBatch = [];
          currentWeight = 0;
        }

        currentBatch.push(order);
        currentWeight += orderWeight;
      }

      // Don't forget the last batch
      if (currentBatch.length >= params.minOrdersPerBatch) {
        batches.push({ order_ids: currentBatch.map(o => o.id) });
      }
    });

    if (!batches.length) {
      this.toast.showWarn('admin.batching.no_batches_to_create');
      return;
    }

    this.submittingBatches.set(true);
    this.batchingService.runCustomBatching(batches).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.submittingBatches.set(false);
        this.toast.showSuccess('admin.batching.run_success', { trips: res.trips_created, orders: res.orders_processed });
        this.deactivateMapClustering();
        this.refreshAllData();
      },
      error: (err) => {
        this.submittingBatches.set(false);
        this.toast.showApiError(err, 'admin.batching.run_error');
      }
    });
  }

  updateClusterParam<K extends keyof ClusteringParams>(key: K, value: ClusteringParams[K]): void {
    this.clusterParams.update(params => ({ ...params, [key]: value }));
    if (this.mapClusteringActive()) {
      this.deactivateMapClustering();
      this.activateMapClustering();
    }
  }

  toggleClusterSettings(): void {
    this.showClusterSettings.update(v => !v);
  }

  resetClusterParams(): void {
    this.clusterParams.set({ ...DEFAULT_CLUSTERING_PARAMS });
    if (this.mapClusteringActive()) {
      this.deactivateMapClustering();
      this.activateMapClustering();
    }
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
  getClusterTotalWeight(cluster: MapCluster) { return cluster.orders.reduce((sum, o) => sum + (o.weight_kg || 0), 0); }

  filterByStatus(status: TripStatus | null): void {
    this.statusFilter.set(status);
    this.batchingService.getTrips(status || undefined).subscribe();
  }

  formatZone(zone?: string): string {
    return zone ? zone.replace('zone_', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Inconnu';
  }
}
