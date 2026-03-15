import { Component, OnInit, inject, signal, computed, DestroyRef, effect } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { DrawerModule } from 'primeng/drawer';
import { AccordionModule } from 'primeng/accordion';
import { BadgeModule } from 'primeng/badge';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';
import { trigger, transition, style, animate } from '@angular/animations';
import { TranslateService } from '@ngx-translate/core';
import * as L from 'leaflet';

import { ADMIN_LIST_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { BatchingService, SmartBatch, SmartBatchStop, CustomerRoute, LeftoverOrder, SmartBatchingResponse } from '../../../services/batching.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { Trip, TripWithStops, TripStatus, PendingOrder } from '../../../models/trip.model';
import { RouteHelpers } from '../../../core/constants/routes.constants';
import { MAP_DEFAULTS, LEAFLET_TILES, LEAFLET_ASSETS } from '../../../core/constants/map.constants';

type TabType = 'map' | 'trips';

// Distinct colors for batches (10 colors)
const BATCH_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
  '#6366F1'  // Indigo
];

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
  imports: [...ADMIN_LIST_IMPORTS, AgroclikPageContainerComponent, DialogModule, SelectModule, DrawerModule, AccordionModule, BadgeModule, TooltipModule],
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
  leftoverOrders = signal<LeftoverOrder[]>([]);
  customerRoutes = signal<CustomerRoute[]>([]);
  resettingBatches = signal(false);

  // Corridor visibility toggle (for legend)
  corridorVisibility = signal<Record<string, boolean>>({});
  private corridorLayers: Record<string, { markers: L.Layer[], polyline: L.Polyline | null, polylines?: L.Polyline[] }> = {};

  // Corridor filter for map and batching (multi-select)
  selectedCorridorFilters = signal<string[]>([]);
  corridorFilterExpanded = signal(false);


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

  // Edit Route Dialog
  showEditRouteDialog = signal(false);
  editingRoute = signal<{ userId: number; customerName: string } | null>(null);
  savingRoute = signal(false);
  editRouteForm = { corridor: '', distance_km: 0, duration_min: 0 };

  // Data from service
  stats = this.batchingService.stats;
  trips = this.batchingService.trips;
  drivers = this.batchingService.drivers;
  smartDrivers = signal<{ id: number; name: string; capacity_kg: number; vehicle_type: string; status?: string; active_trips?: number }[]>([]);
  unusableTruckIds = signal<Set<number>>(new Set());
  smallestOrderKg = signal<number>(0);

  // Manual batching with drag and drop
  vehicleBatches = signal<Record<number, PendingOrder[]>>({}); // driverId -> orders
  draggingOrder = signal<PendingOrder | null>(null);
  dragOverVehicle = signal<number | null>(null); // driverId being hovered

  filteredTrips = computed(() => {
    const status = this.statusFilter();
    return status ? this.trips().filter(t => t.status === status) : this.trips();
  });

  // Total weight of all pending orders
  totalOrdersWeight = computed(() => {
    return this.pendingOrders().reduce((sum, order) => sum + order.weight_kg, 0);
  });

  // Total capacity of all available trucks
  totalTruckCapacity = computed(() => {
    return this.smartDrivers().reduce((sum, driver) => sum + driver.capacity_kg, 0);
  });

  // Get weight assigned to a specific vehicle
  getVehicleWeight(driverId: number): number {
    const orders = this.vehicleBatches()[driverId] || [];
    return orders.reduce((sum, order) => sum + order.weight_kg, 0);
  }

  // Get order count for a specific vehicle
  getVehicleOrderCount(driverId: number): number {
    return (this.vehicleBatches()[driverId] || []).length;
  }

  // Get corridor assigned to a specific driver (from smart batching)
  getVehicleCorridor(driverId: number): string | null {
    const batch = this.smartBatches().find(b => b.assigned_driver?.id === driverId);
    return batch?.corridor || null;
  }

  // Get count of pending trips suggested to a specific driver
  getPendingSuggestedCount(driverId: number): number {
    return this.trips().filter(t =>
      t.suggested_driver_id === driverId &&
      t.status === 'pending'
    ).length;
  }

  // Check if driver has any pending suggested trips
  hasDriverPendingSuggestions(driverId: number): boolean {
    return this.getPendingSuggestedCount(driverId) > 0;
  }

  // Check if driver is busy (has active trips)
  isDriverBusy(driverId: number): boolean {
    const driver = this.smartDrivers().find(d => d.id === driverId);
    return driver?.status === 'busy' || (driver?.active_trips ?? 0) > 0;
  }

  // Get active trips count for a driver
  getDriverActiveTrips(driverId: number): number {
    const driver = this.smartDrivers().find(d => d.id === driverId);
    return driver?.active_trips ?? 0;
  }

  // Unassigned orders (not in any vehicle batch)
  unassignedOrders = computed(() => {
    const batches = this.vehicleBatches();
    const assignedIds = new Set(
      Object.values(batches).flat().map(o => o.id)
    );
    return this.filteredPendingOrders().filter(o => !assignedIds.has(o.id));
  });

  // Unique corridors for dropdown
  corridorOptions = computed(() => {
    const corridors = this.customerRoutes()
      .map(r => r.corridor)
      .filter((c): c is string => !!c);
    const unique = [...new Set(corridors)].sort();
    return unique.map(c => ({ label: c, value: c }));
  });

  // Filtered pending orders based on corridor selection (multi-select)
  filteredPendingOrders = computed(() => {
    const filters = this.selectedCorridorFilters();
    const orders = this.pendingOrders();
    if (filters.length === 0) return orders;

    // Get user IDs that belong to any of the selected corridors
    const userIdsInCorridors = new Set(
      this.customerRoutes()
        .filter(r => r.corridor && filters.includes(r.corridor))
        .map(r => r.user_id)
    );

    return orders.filter(o => userIdsInCorridors.has(o.user_id));
  });

  // Filtered orders weight
  filteredOrdersWeight = computed(() => {
    return this.filteredPendingOrders().reduce((sum, order) => sum + order.weight_kg, 0);
  });

  // ==================== Algorithm Settings ====================
  showSettingsDrawer = true; // Open by default

  // Simulation limit for testing
  simulationLimit = signal<number | null>(null);

  // Algorithm parameters with defaults
  algorithmSettings = signal({
    strategy: 'nearest_first' as 'farthest_first' | 'nearest_first',
    maxOrders: null as number | null,
    maxWeight: null as number | null,
    maxCapacityPercent: 90 as number // Max % of vehicle capacity to use (default 90%)
  });

  // Options for simulation limit dropdown
  simulationLimitOptions = [
    { label: 'All Orders', value: null },
    { label: '5 Random Orders', value: 5 },
    { label: '10 Random Orders', value: 10 },
    { label: '15 Random Orders', value: 15 },
    { label: '20 Random Orders', value: 20 },
    { label: '30 Random Orders', value: 30 },
    { label: '50 Random Orders', value: 50 }
  ];

  // Options for dropdowns
  strategyOptions = [
    { label: 'Nearest First (Recommended)', value: 'nearest_first' },
    { label: 'Farthest First', value: 'farthest_first' }
  ];

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

    // Show initial order dots (only when not in smart batching mode)
    // Also react to corridor filter changes
    effect(() => {
      this.filteredPendingOrders(); // Track changes (includes pendingOrders and filter)
      if (this.map && this.markersLayer && this.mapInitialized() && !this.smartBatchingActive()) {
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
    this.connectionsLayer = L.layerGroup().addTo(this.map);
    this.markersLayer = L.layerGroup().addTo(this.map);
    this.addWarehouseMarker();
    this.mapInitialized.set(true);
    this.updateMapMarkers(); // Show initial order dots
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
    this.map = this.markersLayer = this.connectionsLayer = null;
    this.mapInitialized.set(false);
    this.smartBatchingActive.set(false);
    this.smartBatches.set([]);
  }

  private updateMapMarkers(): void {
    if (!this.map || !this.markersLayer) return;
    this.markersLayer.clearLayers();

    // Use filtered orders based on corridor selection
    const orders = this.filteredPendingOrders();
    if (!orders.length) return;

    const bounds = L.latLngBounds([]);

    // Clear existing order markers
    this.orderMarkers.clear();

    // Only show unassigned orders on the map
    const assignedIds = new Set(
      Object.values(this.vehicleBatches()).flat().map(o => o.id)
    );

    orders.forEach(order => {
      if (!order.latitude || !order.longitude) return;
      if (assignedIds.has(order.id)) return; // Skip assigned orders

      const marker = this.createOrderMarker(order, DEFAULT_MARKER_COLOR, MARKER_STYLES.default);
      marker.addTo(this.markersLayer!);
      bounds.extend([order.latitude, order.longitude]);

      // Store marker reference and attach drag events
      this.orderMarkers.set(order.id, marker);
      setTimeout(() => this.attachDragToMarker(marker, order), 100);
    });

    if (bounds.isValid()) this.map.fitBounds(bounds, { padding: [50, 50] });
  }

  private createOrderMarker(order: PendingOrder, color: string, _style: typeof MARKER_STYLES.default, showColorDot = false): L.Marker {
    // Format weight for display
    const weightDisplay = order.weight_kg >= 10
      ? Math.round(order.weight_kg).toString()
      : order.weight_kg.toFixed(1);

    // Use same size as smart batch markers (36px)
    const icon = L.divIcon({
      className: 'weight-marker',
      html: `
        <div style="
          width: 36px;
          height: 36px;
          background: ${color};
          border: 3px solid #fff;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 10px;
          font-weight: 700;
        ">${weightDisplay}</div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    const marker = L.marker([order.latitude!, order.longitude!], { icon });
    marker.bindPopup(this.createOrderPopup(order, showColorDot ? color : undefined));
    return marker;
  }

  /**
   * Create popup for smart batch stop with edit button
   */
  private createStopPopup(stop: SmartBatchStop, color: string): L.Popup {
    const corridor = stop.corridor || 'Unknown';

    const container = document.createElement('div');
    container.style.minWidth = '180px';
    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="width:20px;height:20px;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:11px;">${stop.sequence}</span>
        <strong>#${stop.order_id}</strong>
      </div>
      <span style="font-weight:500;">${stop.customer_name}</span><br>
      <span style="color:#666;font-size:12px;">${stop.address}</span>
      <div style="margin-top:6px;padding:4px 8px;background:#f0f9ff;border-radius:4px;font-size:11px;color:#0369a1;">
        <i class="pi pi-directions" style="font-size:10px;margin-right:4px;"></i>${corridor}
      </div>
      <div style="margin-top:8px;display:flex;justify-content:space-between;">
        <span>${stop.weight_kg.toFixed(1)} kg</span>
        <span style="color:#10B981;font-weight:600;">${stop.distance_km.toFixed(1)} km</span>
      </div>
    `;

    // Add edit button
    const editBtn = document.createElement('button');
    editBtn.innerHTML = '<i class="pi pi-pencil"></i> Edit Route';
    editBtn.style.cssText = 'margin-top:10px;width:100%;padding:6px 10px;background:#3B82F6;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;gap:6px;';
    editBtn.onclick = () => this.openEditRouteDialogFromStop(stop);
    container.appendChild(editBtn);

    return L.popup().setContent(container);
  }

  private createOrderPopup(order: PendingOrder, color?: string): L.Popup {
    const colorDot = color ? `<span style="width:12px;height:12px;border-radius:50%;background:${color};display:inline-block;"></span>` : '';

    // Look up corridor from customer routes
    const route = this.customerRoutes().find(r => r.user_id === order.user_id);
    const corridor = route?.corridor || 'Unknown';

    const container = document.createElement('div');
    container.style.minWidth = '180px';
    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        ${colorDot}<strong>#${order.id}</strong>${!color ? ` - ${order.customer_name}` : ''}
      </div>
      ${color ? `<span style="font-weight:500;">${order.customer_name}</span><br>` : ''}
      <span style="color:#666;font-size:12px;">${order.address}</span>
      <div style="margin-top:6px;padding:4px 8px;background:#f0f9ff;border-radius:4px;font-size:11px;color:#0369a1;">
        <i class="pi pi-directions" style="font-size:10px;margin-right:4px;"></i>${corridor}
      </div>
      <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;">
        <span>${order.weight_kg.toFixed(1)} kg</span>
        <span style="color:#10B981;font-weight:600;">${order.shipping_cost} DA</span>
      </div>
    `;

    // Add edit button
    const editBtn = document.createElement('button');
    editBtn.innerHTML = '<i class="pi pi-pencil"></i> Edit Route';
    editBtn.style.cssText = 'margin-top:10px;width:100%;padding:6px 10px;background:#3B82F6;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;gap:6px;';
    editBtn.onclick = () => this.openEditRouteDialog(order);
    container.appendChild(editBtn);

    return L.popup().setContent(container);
  }

  // ==================== Smart Batching ====================

  toggleSettings(): void {
    this.showSettingsDrawer = !this.showSettingsDrawer;
  }

  updateSetting(key: string, value: unknown): void {
    this.algorithmSettings.update(settings => ({ ...settings, [key]: value }));
  }

  onSimulationLimitChange(limit: number | null): void {
    this.simulationLimit.set(limit);
    // Reload orders with new limit
    this.loadPendingOrders();
  }

  private getSmartBatchingParams() {
    const settings = this.algorithmSettings();
    const simLimit = this.simulationLimit();
    const corridorFilters = this.selectedCorridorFilters();
    return {
      strategy: settings.strategy,
      maxOrders: settings.maxOrders || undefined,
      maxWeight: settings.maxWeight || undefined,
      maxCapacityPercent: settings.maxCapacityPercent || undefined,
      simulationLimit: simLimit || undefined,
      // Pass multiple corridors as comma-separated string
      corridorFilter: corridorFilters.length > 0 ? corridorFilters.join(',') : undefined
    };
  }

  toggleCorridorFilter(corridor: string): void {
    const current = this.selectedCorridorFilters();
    if (current.includes(corridor)) {
      this.selectedCorridorFilters.set(current.filter(c => c !== corridor));
    } else {
      this.selectedCorridorFilters.set([...current, corridor]);
    }
  }

  clearCorridorFilters(): void {
    this.selectedCorridorFilters.set([]);
  }

  toggleCorridorFilterPanel(): void {
    this.corridorFilterExpanded.update(v => !v);
  }

  isCorridorFilterSelected(corridor: string): boolean {
    return this.selectedCorridorFilters().includes(corridor);
  }

  previewSmartBatching(): void {
    // Prevent multiple clicks
    if (this.runningSmartBatch()) return;

    this.runningSmartBatch.set(true);

    this.batchingService.previewSmartBatching(this.getSmartBatchingParams()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        if (response.success && response.batches.length > 0) {
          this.smartBatches.set(response.batches);
          this.leftoverOrders.set(response.leftover_orders || []);
          this.smartBatchingActive.set(true);

          // Populate vehicle cards with assigned orders
          this.populateVehicleBatchesFromSmartBatches(response.batches);

          // Update unusable trucks info for driver card warnings
          this.updateUnusableTrucks(response);

          // Load customer routes to get real polylines
          this.batchingService.getCustomerRoutes().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: (routes) => {
              this.customerRoutes.set(routes);
              this.runningSmartBatch.set(false);
              this.drawCorridorRoutes();
            },
            error: () => {
              this.runningSmartBatch.set(false);
              this.drawCorridorRoutes();
            }
          });
        } else {
          this.runningSmartBatch.set(false);
          this.leftoverOrders.set([]);

          // Still update unusable trucks to show warnings on driver cards
          this.updateUnusableTrucks(response);

          // Show warning if all trucks have insufficient capacity (sticky - user must dismiss)
          const unusableTrucks = response.summary?.unusable_trucks || [];
          if (unusableTrucks.length > 0 && response.batches.length === 0) {
            this.toast.showWarnSticky('admin.batching.all_trucks_insufficient');
          }
        }
      },
      error: (err) => {
        this.runningSmartBatch.set(false);
        this.toast.showApiError(err, 'admin.batching.smart_preview_error');
      }
    });
  }

  /**
   * Store unusable truck info for display on driver cards
   */
  private updateUnusableTrucks(response: SmartBatchingResponse): void {
    const summary = response.summary;
    const unusableTrucks = summary.unusable_trucks || [];

    // Store IDs of trucks that can't handle the smallest order
    const ids = new Set(unusableTrucks.map(t => t.id));
    this.unusableTruckIds.set(ids);
    this.smallestOrderKg.set(summary.smallest_order_kg || 0);
  }

  /**
   * Check if a driver's truck is unusable (capacity too small)
   */
  isDriverUnusable(driverId: number): boolean {
    return this.unusableTruckIds().has(driverId);
  }

  /**
   * Populate vehicle cards with orders from smart batching results
   */
  private populateVehicleBatchesFromSmartBatches(batches: SmartBatch[]): void {
    const pendingOrdersMap = new Map(
      this.pendingOrders().map(o => [o.id, o])
    );

    const newVehicleBatches: Record<number, PendingOrder[]> = {};

    for (const batch of batches) {
      if (!batch.assigned_driver) continue;

      const driverId = batch.assigned_driver.id;
      const orders: PendingOrder[] = [];

      for (const stop of batch.stops) {
        const pendingOrder = pendingOrdersMap.get(stop.order_id);
        if (pendingOrder) {
          orders.push(pendingOrder);
        }
      }

      if (orders.length > 0) {
        newVehicleBatches[driverId] = orders;
      }
    }

    this.vehicleBatches.set(newVehicleBatches);
  }

  runSmartBatching(): void {
    this.submittingBatches.set(true);
    this.batchingService.runSmartBatching(this.getSmartBatchingParams()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
    this.runningSmartBatch.set(false);  // Reset loading state
    this.smartBatchingActive.set(false);
    this.smartBatches.set([]);
    this.leftoverOrders.set([]);
    this.vehicleBatches.set({});  // Clear vehicle cards
    this.unusableTruckIds.set(new Set());  // Clear warnings
    this.smallestOrderKg.set(0);
    this.corridorLayers = {};
    this.corridorVisibility.set({});
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

  /**
   * Draw real road routes for each corridor/batch
   * Uses actual polylines from customer routes, not straight lines
   * Also colors markers by corridor
   */
  private drawCorridorRoutes(): void {
    if (!this.map || !this.connectionsLayer || !this.markersLayer) return;
    this.connectionsLayer.clearLayers();
    this.markersLayer.clearLayers();

    // Reset corridor tracking
    this.corridorLayers = {};
    const visibility: Record<string, boolean> = {};

    // Build lookups: user_id -> route coordinates, order_id -> user_id
    const routeLookup = this.buildRouteLookup();
    const orderToUserLookup = this.buildOrderToUserLookup();

    const batches = this.smartBatches();

    batches.forEach((batch, batchIndex) => {
      const corridorKey = `${batch.corridor}_${batchIndex}`;
      const color = BATCH_COLORS[batchIndex % BATCH_COLORS.length];

      // Initialize corridor visibility and polylines array
      visibility[corridorKey] = true;
      this.corridorLayers[corridorKey] = { markers: [], polyline: null, polylines: [] };

      // Draw colored markers and real routes for each stop
      batch.stops.forEach((stop, stopIndex) => {
        if (!stop.latitude || !stop.longitude) return;

        // Create colored marker for this stop with weight displayed
        setTimeout(() => {
          if (!this.markersLayer) return;

          // Format weight for display (round to nearest integer if >= 10, else 1 decimal)
          const weightDisplay = stop.weight_kg >= 10
            ? Math.round(stop.weight_kg).toString()
            : stop.weight_kg.toFixed(1);

          const icon = L.divIcon({
            className: 'weight-marker',
            html: `
              <div style="
                width: 36px;
                height: 36px;
                background: ${color};
                border: 3px solid #fff;
                border-radius: 50%;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                color: #fff;
                font-size: 10px;
                font-weight: 700;
              ">${weightDisplay}</div>
            `,
            iconSize: [36, 36],
            iconAnchor: [18, 18]
          });

          const marker = L.marker([stop.latitude!, stop.longitude!], { icon });
          marker.bindPopup(this.createStopPopup(stop, color));
          marker.addTo(this.markersLayer!);
          this.corridorLayers[corridorKey].markers.push(marker);
        }, batchIndex * 200 + stopIndex * 80);

        // Find matching route coordinates using order_id -> user_id -> route
        const userId = orderToUserLookup.get(stop.order_id);
        const routeCoords = userId ? routeLookup.get(userId) : undefined;

        if (routeCoords && routeCoords.length > 0) {
          setTimeout(() => {
            if (!this.connectionsLayer) return;

            const polyline = L.polyline(routeCoords, {
              color: color,
              weight: 4,
              opacity: 0.7
            });
            polyline.addTo(this.connectionsLayer!);
            this.corridorLayers[corridorKey].polylines?.push(polyline);
          }, batchIndex * 200 + stopIndex * 80 + 50);
        }
      });
    });

    // Set visibility state
    this.corridorVisibility.set(visibility);

    // Draw ghost markers for leftover orders (orders in selected corridors that weren't assigned)
    this.drawLeftoverOrderMarkers();
  }

  /**
   * Draw ghost markers for leftover orders that weren't assigned to any batch
   */
  private drawLeftoverOrderMarkers(): void {
    const leftoverOrders = this.leftoverOrders();
    if (!leftoverOrders.length || !this.markersLayer) return;

    // Get coordinates from pending orders
    const pendingOrdersMap = new Map(
      this.pendingOrders().map(o => [o.id, o])
    );

    // Only show leftover orders that are in selected corridors
    const selectedCorridors = this.selectedCorridorFilters();

    leftoverOrders.forEach((leftover, index) => {
      // Skip if not in selected corridors (when filter is active)
      if (selectedCorridors.length > 0 && !selectedCorridors.includes(leftover.corridor)) {
        return;
      }

      const pendingOrder = pendingOrdersMap.get(leftover.order_id);
      if (!pendingOrder || !pendingOrder.latitude || !pendingOrder.longitude) return;

      // Create ghost marker (dashed gray style)
      setTimeout(() => {
        if (!this.markersLayer) return;

        const weightDisplay = leftover.weight_kg >= 10
          ? Math.round(leftover.weight_kg).toString()
          : leftover.weight_kg.toFixed(1);

        const icon = L.divIcon({
          className: 'ghost-marker',
          html: `
            <div style="
              width: 36px;
              height: 36px;
              background: rgba(100, 100, 100, 0.4);
              border: 2px dashed #999;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #666;
              font-size: 10px;
              font-weight: 700;
            ">${weightDisplay}</div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });

        const marker = L.marker([pendingOrder.latitude!, pendingOrder.longitude!], { icon });
        marker.bindPopup(`
          <div style="text-align:center;padding:8px;">
            <strong style="color:#666;">${leftover.customer_name}</strong><br>
            <span style="color:#999;font-size:12px;">Non assigné - ${weightDisplay} kg</span><br>
            <span style="color:#999;font-size:11px;">${leftover.corridor}</span>
          </div>
        `);
        marker.addTo(this.markersLayer!);
      }, index * 50);
    });
  }

  /**
   * Build a lookup map from user_id to route coordinates array
   */
  private buildRouteLookup(): Map<number, [number, number][]> {
    const lookup = new Map<number, [number, number][]>();
    const routes = this.customerRoutes();

    routes.forEach(route => {
      if (!route.coordinates || route.coordinates.length < 2) return;

      // Convert all coordinates to [lat, lng] for Leaflet
      const latLngs: [number, number][] = route.coordinates.map(
        coord => [coord[1], coord[0]] as [number, number]
      );

      // Use user_id as the key for reliable matching
      lookup.set(route.user_id, latLngs);
    });

    return lookup;
  }

  /**
   * Build a lookup map from order_id to user_id
   * Uses all pending orders (not filtered) since batches may contain any order
   */
  private buildOrderToUserLookup(): Map<number, number> {
    const lookup = new Map<number, number>();
    this.pendingOrders().forEach(order => {
      lookup.set(order.id, order.user_id);
    });
    return lookup;
  }

  // Toggle corridor visibility from legend
  toggleCorridorVisibility(corridorKey: string): void {
    const current = this.corridorVisibility();
    const isVisible = current[corridorKey];
    const layers = this.corridorLayers[corridorKey];

    if (!layers) return;

    if (isVisible) {
      // Hide corridor markers and polylines
      layers.markers.forEach(marker => {
        if (this.markersLayer?.hasLayer(marker)) {
          this.markersLayer.removeLayer(marker);
        }
      });
      layers.polylines?.forEach(polyline => {
        if (this.connectionsLayer?.hasLayer(polyline)) {
          this.connectionsLayer.removeLayer(polyline);
        }
      });
    } else {
      // Show corridor markers and polylines
      layers.markers.forEach(marker => {
        marker.addTo(this.markersLayer!);
      });
      layers.polylines?.forEach(polyline => {
        polyline.addTo(this.connectionsLayer!);
      });
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

  getBatchColor(index: number): string {
    return BATCH_COLORS[index % BATCH_COLORS.length];
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
    // Load smart drivers with capacity info
    this.batchingService.getSmartDrivers().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.smartDrivers.set(response.drivers);
      }
    });
    // Load customer routes for edit dialog
    this.batchingService.getCustomerRoutes().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (routes) => {
        this.customerRoutes.set(routes);
      }
    });
  }

  loadPendingOrders(): void {
    this.loadingOrders.set(true);
    const limit = this.simulationLimit();
    this.batchingService.getPendingOrders(limit ?? undefined).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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

  // ==================== Edit Route Dialog ====================

  openEditRouteDialog(order: PendingOrder): void {
    this.editingRoute.set({
      userId: order.user_id,
      customerName: order.customer_name
    });
    // Pre-fill form with current values (if available from routes)
    const route = this.customerRoutes().find(r => r.user_id === order.user_id);
    this.editRouteForm = {
      corridor: route?.corridor || '',
      distance_km: route?.distance_km || 0,
      duration_min: route?.duration_min || 0
    };
    this.showEditRouteDialog.set(true);
  }

  openEditRouteDialogFromStop(stop: SmartBatchStop): void {
    // Get user_id from stop, or look it up from pending orders
    let userId = stop.user_id;
    if (!userId) {
      const order = this.pendingOrders().find(o => o.id === stop.order_id);
      userId = order?.user_id || 0;
    }

    this.editingRoute.set({
      userId: userId,
      customerName: stop.customer_name
    });

    // Try to get data from customerRoutes (most accurate)
    const route = this.customerRoutes().find(r => r.user_id === userId);

    // Pre-fill form - prefer customerRoutes data, fallback to stop data
    this.editRouteForm = {
      corridor: route?.corridor || stop.corridor || '',
      distance_km: route?.distance_km || stop.distance_km || 0,
      duration_min: route?.duration_min || stop.duration_min || 0
    };
    this.showEditRouteDialog.set(true);
  }

  closeEditRouteDialog(): void {
    this.showEditRouteDialog.set(false);
    this.editingRoute.set(null);
  }

  saveRouteChanges(): void {
    const route = this.editingRoute();
    if (!route) return;

    this.savingRoute.set(true);
    this.batchingService.updateCustomerRoute(route.userId, {
      corridor: this.editRouteForm.corridor,
      distance_km: this.editRouteForm.distance_km,
      duration_min: this.editRouteForm.duration_min
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.savingRoute.set(false);
          this.toast.showSuccess('admin.batching.route_updated');
          this.closeEditRouteDialog();
          // Reload routes and orders to reflect changes
          this.batchingService.getCustomerRoutes().subscribe(routes => this.customerRoutes.set(routes));
          this.loadPendingOrders();
        },
        error: (err) => {
          this.savingRoute.set(false);
          this.toast.showApiError(err, 'admin.batching.route_update_error');
        }
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
    return zone ? zone.replace('zone_', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Personnalisé';
  }

  // ==================== Drag and Drop for Manual Batching ====================

  private dragClone: HTMLElement | null = null;
  private dragStartPos = { x: 0, y: 0 };

  /**
   * Start dragging an order from the map
   */
  startDragOrder(order: PendingOrder, event: MouseEvent): void {
    event.preventDefault();
    this.draggingOrder.set(order);

    // Create a visual clone to follow the cursor
    this.dragClone = document.createElement('div');
    this.dragClone.className = 'drag-order-clone';
    this.dragClone.innerHTML = `
      <i class="pi pi-box"></i>
      <span>#${order.id}</span>
    `;
    this.dragClone.style.cssText = `
      position: fixed;
      left: ${event.clientX - 25}px;
      top: ${event.clientY - 25}px;
      width: 50px;
      height: 50px;
      background: var(--primary-color);
      color: white;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      pointer-events: none;
      z-index: 10000;
      cursor: grabbing;
    `;
    document.body.appendChild(this.dragClone);

    // Track mouse movement
    const moveHandler = (e: MouseEvent) => this.onDragMove(e);
    const upHandler = (e: MouseEvent) => {
      this.onDragEnd(e);
      document.removeEventListener('mousemove', moveHandler);
      document.removeEventListener('mouseup', upHandler);
    };

    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('mouseup', upHandler);
  }

  private onDragMove(event: MouseEvent): void {
    if (!this.dragClone) return;
    this.dragClone.style.left = `${event.clientX - 25}px`;
    this.dragClone.style.top = `${event.clientY - 25}px`;

    // Check if over a vehicle card
    const vehicleCard = document.elementFromPoint(event.clientX, event.clientY)?.closest('.map-vehicles__card');
    if (vehicleCard) {
      const driverId = parseInt(vehicleCard.getAttribute('data-driver-id') || '0', 10);
      this.dragOverVehicle.set(driverId);
    } else {
      this.dragOverVehicle.set(null);
    }
  }

  private onDragEnd(event: MouseEvent): void {
    const order = this.draggingOrder();
    const targetDriverId = this.dragOverVehicle();

    // Clean up drag clone
    if (this.dragClone) {
      this.dragClone.remove();
      this.dragClone = null;
    }

    // If dropped on a vehicle, assign the order
    if (order && targetDriverId) {
      this.assignOrderToVehicle(order, targetDriverId);
    }

    this.draggingOrder.set(null);
    this.dragOverVehicle.set(null);
  }

  /**
   * Assign an order to a vehicle batch
   */
  assignOrderToVehicle(order: PendingOrder, driverId: number): void {
    const batches = { ...this.vehicleBatches() };
    const driver = this.smartDrivers().find(d => d.id === driverId);

    if (!driver) return;

    // Check capacity
    const currentWeight = this.getVehicleWeight(driverId);
    if (currentWeight + order.weight_kg > driver.capacity_kg) {
      this.toast.showError('admin.batching.capacity_exceeded');
      return;
    }

    // Add order to vehicle batch
    if (!batches[driverId]) {
      batches[driverId] = [];
    }
    batches[driverId] = [...batches[driverId], order];
    this.vehicleBatches.set(batches);

    // Remove marker from map
    this.removeOrderMarkerFromMap(order);

    this.toast.showSuccess('admin.batching.order_assigned');
  }

  /**
   * Remove an order from a vehicle batch (put back on map)
   */
  removeOrderFromVehicle(order: PendingOrder, driverId: number): void {
    const batches = { ...this.vehicleBatches() };
    if (batches[driverId]) {
      batches[driverId] = batches[driverId].filter(o => o.id !== order.id);
      if (batches[driverId].length === 0) {
        delete batches[driverId];
      }
      this.vehicleBatches.set(batches);

      // Re-add marker to map
      this.addOrderMarkerToMap(order);
    }
  }

  private orderMarkers = new Map<number, L.Marker>();
  private ghostMarkers = new Map<number, L.Marker>();

  private removeOrderMarkerFromMap(order: PendingOrder): void {
    const marker = this.orderMarkers.get(order.id);
    if (marker && this.markersLayer) {
      this.markersLayer.removeLayer(marker);
      this.orderMarkers.delete(order.id);

      // Create ghost marker to show order is assigned
      this.createGhostMarker(order);
    }
  }

  private createGhostMarker(order: PendingOrder): void {
    if (!this.map || !this.markersLayer || !order.latitude || !order.longitude) return;

    const weightDisplay = order.weight_kg >= 10
      ? Math.round(order.weight_kg).toString()
      : order.weight_kg.toFixed(1);

    const icon = L.divIcon({
      className: 'ghost-marker',
      html: `
        <div style="
          width: 36px;
          height: 36px;
          background: rgba(100, 100, 100, 0.4);
          border: 2px dashed #999;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #666;
          font-size: 10px;
          font-weight: 700;
        ">${weightDisplay}</div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    const ghostMarker = L.marker([order.latitude, order.longitude], { icon, interactive: false });
    ghostMarker.addTo(this.markersLayer);
    this.ghostMarkers.set(order.id, ghostMarker);
  }

  private removeGhostMarker(orderId: number): void {
    const ghost = this.ghostMarkers.get(orderId);
    if (ghost && this.markersLayer) {
      this.markersLayer.removeLayer(ghost);
      this.ghostMarkers.delete(orderId);
    }
  }

  private addOrderMarkerToMap(order: PendingOrder): void {
    if (!this.map || !this.markersLayer || !order.latitude || !order.longitude) return;

    // Remove ghost marker first
    this.removeGhostMarker(order.id);

    const marker = this.createOrderMarker(order, DEFAULT_MARKER_COLOR, MARKER_STYLES.default);
    marker.addTo(this.markersLayer);
    this.orderMarkers.set(order.id, marker);

    // Add drag event to the new marker
    setTimeout(() => this.attachDragToMarker(marker, order), 100);
  }

  /**
   * Attach drag events to a marker
   */
  attachDragToMarker(marker: L.Marker, order: PendingOrder): void {
    const el = marker.getElement();
    if (el) {
      el.style.cursor = 'grab';
      el.addEventListener('mousedown', (e: MouseEvent) => {
        e.stopPropagation();
        this.startDragOrder(order, e);
      });
    }
  }

  /**
   * Create batch/trip for a vehicle with its assigned orders
   */
  createBatchForVehicle(driverId: number): void {
    const orders = this.vehicleBatches()[driverId];
    const driver = this.smartDrivers().find(d => d.id === driverId);

    if (!orders || orders.length === 0 || !driver) {
      this.toast.showError('admin.batching.no_orders_selected');
      return;
    }

    // Create batch with order IDs
    const orderIds = orders.map(o => o.id);

    this.batchingService.runCustomBatching([{ order_ids: orderIds }])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response.trips_created > 0) {
            this.toast.showSuccess('admin.batching.batch_created');

            // Clear the vehicle batch and ghost markers
            orders.forEach(order => this.removeGhostMarker(order.id));

            const batches = { ...this.vehicleBatches() };
            delete batches[driverId];
            this.vehicleBatches.set(batches);

            // Refresh all data
            this.refreshAllData();
          } else {
            this.toast.showError('admin.batching.batch_create_error');
          }
        },
        error: (err) => {
          this.toast.showApiError(err, 'admin.batching.batch_create_error');
        }
      });
  }
}
