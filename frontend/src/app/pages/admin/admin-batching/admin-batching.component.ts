import { Component, OnInit, inject, signal, computed, DestroyRef, AfterViewInit, effect } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { ConfirmationService, MessageService } from 'primeng/api';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { trigger, transition, style, animate, query, stagger, keyframes } from '@angular/animations';
import * as L from 'leaflet';

import { ADMIN_LIST_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { BatchingService } from '../../../services/batching.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import {
  Trip,
  TripWithStops,
  TripStatus,
  BatchingStats,
  PendingOrder,
  CustomBatch,
} from '../../../models/trip.model';
import { User } from '../../../models/user.model';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { MAP_DEFAULTS, LEAFLET_TILES, LEAFLET_ASSETS } from '../../../core/constants/map.constants';

type TabType = 'overview' | 'trips' | 'map';
type BatchingState = 'orders' | 'batches';

@Component({
  selector: 'app-admin-batching',
  standalone: true,
  imports: [
    ...ADMIN_LIST_IMPORTS,
    AgroclikPageContainerComponent,
    DialogModule,
    SelectModule,
    DragDropModule
  ],
  templateUrl: './admin-batching.component.html',
  styleUrl: './admin-batching.component.scss',
  providers: [ConfirmationService, MessageService],
  animations: [
    trigger('batchAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.8)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'scale(1)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'scale(0.8)' }))
      ])
    ]),
    trigger('orderCardAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('staggerAnimation', [
      transition('* => *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(10px)' }),
          stagger('50ms', [
            animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true })
      ])
    ]),
    trigger('organizeAnimation', [
      transition('orders => batches', [
        query('.order-card', [
          animate('400ms ease-in-out', keyframes([
            style({ transform: 'scale(1)', offset: 0 }),
            style({ transform: 'scale(0.85)', offset: 0.3 }),
            style({ transform: 'scale(0.85) translateY(-10px)', offset: 0.6 }),
            style({ transform: 'scale(1) translateY(0)', offset: 1 })
          ]))
        ], { optional: true })
      ])
    ])
  ]
})
export class AdminBatchingComponent implements OnInit, AfterViewInit {
  private batchingService = inject(BatchingService);
  private toast = inject(ToastMessageService);
  private confirmationService = inject(ConfirmationService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  // Zone colors palette for map markers
  private readonly ZONE_COLORS = [
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
  private zoneColorMap = new Map<string, string>();
  private map: L.Map | null = null;
  private markersLayer: L.LayerGroup | null = null;

  // State
  loading = signal(true);
  loadingOrders = signal(false);
  organizingBatches = signal(false);
  submittingBatches = signal(false);
  activeTab = signal<TabType>('overview');
  batchingState = signal<BatchingState>('orders');
  mapInitialized = signal(false);

  // Data from service
  stats = this.batchingService.stats;
  trips = this.batchingService.trips;
  drivers = this.batchingService.drivers;

  // Pending orders for drag-drop
  pendingOrders = signal<PendingOrder[]>([]);

  // Custom batches after organizing
  customBatches = signal<CustomBatch[]>([]);
  unbatchedOrders = signal<PendingOrder[]>([]);

  // Filters
  statusFilter = signal<TripStatus | null>(null);

  // Trip detail dialog
  showTripDialog = signal(false);
  selectedTrip = signal<TripWithStops | null>(null);
  loadingTripDetail = signal(false);

  // Assign dialog
  showAssignDialog = signal(false);
  tripToAssign = signal<Trip | null>(null);
  selectedDriverId: number | null = null;
  assigning = signal(false);

  // Trip builder sidebar
  tripBuilderOrders = signal<PendingOrder[]>([]);
  tripBuilderDriverId: number | null = null;
  creatingTrip = signal(false);

  // Computed
  filteredTrips = computed(() => {
    const allTrips = this.trips();
    const status = this.statusFilter();
    if (!status) return allTrips;
    return allTrips.filter(t => t.status === status);
  });

  pendingTrips = computed(() => this.trips().filter(t => t.status === 'pending'));
  assignedTrips = computed(() => this.trips().filter(t => t.status === 'assigned'));
  inProgressTrips = computed(() => this.trips().filter(t => t.status === 'in_progress'));

  // Computed for batch summary
  totalOrdersInBatches = computed(() =>
    this.customBatches().reduce((sum, b) => sum + b.orders.length, 0)
  );

  // Generate drop list IDs for CDK
  batchDropListIds = computed(() =>
    this.customBatches().map((_, i) => `batch-${i}`)
  );

  allDropListIds = computed(() =>
    [...this.batchDropListIds(), 'unbatched-list']
  );

  // Trip builder computed values
  tripBuilderTotalWeight = computed(() =>
    this.tripBuilderOrders().reduce((sum, o) => sum + (o.weight_kg || 0), 0)
  );

  tripBuilderTotalEarnings = computed(() =>
    this.tripBuilderOrders().reduce((sum, o) => sum + (o.shipping_cost || 0), 0)
  );

  // Drop list IDs for overview tab (orders grid + trip builder)
  overviewDropListIds = computed(() => ['orders-list', 'trip-builder-list']);

  constructor() {
    // Watch for tab changes to initialize/destroy map
    effect(() => {
      const tab = this.activeTab();
      if (tab === 'map') {
        // Delay to ensure DOM is ready, then initialize
        setTimeout(() => this.initMap(), 100);
      } else {
        // Destroy map when leaving map tab
        this.destroyMap();
      }
    });

    // Watch for orders/batches/tripBuilder changes to update markers
    effect(() => {
      const orders = this.pendingOrders();
      const batches = this.customBatches();
      const state = this.batchingState();
      const tripBuilderOrders = this.tripBuilderOrders();
      if (this.map && this.markersLayer && this.mapInitialized()) {
        this.updateMapMarkers();
      }
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  ngAfterViewInit(): void {
    // Map will be initialized when tab is selected
  }

  private initMap(): void {
    // Already initialized
    if (this.mapInitialized() && this.map) return;

    const mapElement = document.getElementById('batching-map');
    if (!mapElement) return;

    // Fix Leaflet icon paths
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: LEAFLET_ASSETS.MARKER_ICON_RETINA,
      iconUrl: LEAFLET_ASSETS.MARKER_ICON,
      shadowUrl: LEAFLET_ASSETS.MARKER_SHADOW
    });

    // Initialize map
    this.map = L.map('batching-map', {
      center: [MAP_DEFAULTS.LATITUDE, MAP_DEFAULTS.LONGITUDE],
      zoom: MAP_DEFAULTS.OVERVIEW_ZOOM
    });

    // Add tile layer
    L.tileLayer(LEAFLET_TILES.GOOGLE.URL, {
      maxZoom: LEAFLET_TILES.GOOGLE.MAX_ZOOM,
      subdomains: LEAFLET_TILES.GOOGLE.SUBDOMAINS,
      attribution: LEAFLET_TILES.GOOGLE.ATTRIBUTION
    }).addTo(this.map);

    // Create markers layer
    this.markersLayer = L.layerGroup().addTo(this.map);

    // Add warehouse marker
    this.addWarehouseMarker();

    this.mapInitialized.set(true);

    // Add initial markers
    this.updateMapMarkers();
  }

  private addWarehouseMarker(): void {
    if (!this.map) return;

    // Create custom warehouse icon
    const warehouseIcon = L.divIcon({
      className: 'warehouse-marker',
      html: `
        <div style="
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #F59E0B, #D97706);
          border-radius: 50%;
          border: 3px solid #fff;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <i class="pi pi-warehouse" style="color: white; font-size: 18px;"></i>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    const warehouseMarker = L.marker(
      [MAP_DEFAULTS.LATITUDE, MAP_DEFAULTS.LONGITUDE],
      { icon: warehouseIcon, zIndexOffset: 1000 }
    );

    warehouseMarker.bindPopup(`
      <div style="text-align: center; padding: 8px;">
        <strong style="font-size: 14px;">Entrepôt</strong><br>
        <span style="color: #666; font-size: 12px;">Point de départ des livraisons</span>
      </div>
    `);

    warehouseMarker.addTo(this.map);
  }

  private destroyMap(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
      this.markersLayer = null;
      this.mapInitialized.set(false);
    }
  }

  private updateMapMarkers(): void {
    if (!this.map || !this.markersLayer) return;

    // Clear existing markers
    this.markersLayer.clearLayers();

    const state = this.batchingState();
    const orders = state === 'batches'
      ? this.getAllOrdersFromBatches()
      : [...this.pendingOrders(), ...this.tripBuilderOrders()]; // Include trip builder orders

    if (orders.length === 0) return;

    const bounds: L.LatLngBounds = L.latLngBounds([]);

    orders.forEach(order => {
      if (order.latitude && order.longitude) {
        let color: string;

        if (state === 'batches') {
          // Color by batch assignment
          color = this.getBatchColor(order);
        } else {
          // In orders mode: check if order is in trip builder
          const inTripBuilder = this.tripBuilderOrders().some(o => o.id === order.id);
          color = inTripBuilder ? '#10B981' : '#3B82F6'; // Green if in builder, blue otherwise
        }

        const marker = this.createOrderMarker(order, color);
        marker.addTo(this.markersLayer!);
        bounds.extend([order.latitude, order.longitude]);
      }
    });

    // Fit map to bounds if we have valid bounds
    if (bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  private getAllOrdersFromBatches(): PendingOrder[] {
    const orders: PendingOrder[] = [];
    this.customBatches().forEach(batch => {
      orders.push(...batch.orders);
    });
    // Also include unbatched orders
    orders.push(...this.unbatchedOrders());
    return orders;
  }

  private getZoneColor(zone: string): string {
    if (!this.zoneColorMap.has(zone)) {
      const colorIndex = this.zoneColorMap.size % this.ZONE_COLORS.length;
      this.zoneColorMap.set(zone, this.ZONE_COLORS[colorIndex]);
    }
    return this.zoneColorMap.get(zone)!;
  }

  private getBatchColor(order: PendingOrder): string {
    const batches = this.customBatches();
    for (let i = 0; i < batches.length; i++) {
      if (batches[i].order_ids.includes(order.id)) {
        return this.ZONE_COLORS[i % this.ZONE_COLORS.length];
      }
    }
    // Unbatched order - use gray
    return '#6B7280';
  }

  private createOrderMarker(order: PendingOrder, color: string): L.CircleMarker {
    const marker = L.circleMarker([order.latitude!, order.longitude!], {
      radius: 10,
      fillColor: color,
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8
    });

    const popupContent = `
      <div style="min-width: 200px;">
        <strong>#${order.id}</strong> - ${order.customer_name}<br>
        <span style="color: #666; font-size: 12px;">${order.address}</span><br>
        <div style="margin-top: 8px; display: flex; justify-content: space-between;">
          <span><i class="pi pi-box" style="font-size: 11px;"></i> ${order.weight_kg.toFixed(1)} kg</span>
          <span style="color: #10B981; font-weight: 600;">${order.shipping_cost} DA</span>
        </div>
        <div style="margin-top: 4px; padding: 4px 8px; background: ${color}; color: white; border-radius: 4px; text-align: center; font-size: 11px;">
          ${this.formatZone(order.zone)}
        </div>
      </div>
    `;

    marker.bindPopup(popupContent);
    return marker;
  }

  // Animate clustering on map
  animateClusteringOnMap(): void {
    if (!this.map || !this.markersLayer) return;

    this.organizingBatches.set(true);

    // Get all orders
    const allOrders = [...this.pendingOrders(), ...this.tripBuilderOrders()];
    if (allOrders.length < 2) {
      this.organizingBatches.set(false);
      return;
    }

    // Group orders by zone
    const zoneGroups = new Map<string, PendingOrder[]>();
    allOrders.forEach(order => {
      const zone = order.zone || 'unknown';
      if (!zoneGroups.has(zone)) {
        zoneGroups.set(zone, []);
      }
      zoneGroups.get(zone)!.push(order);
    });

    // Calculate zone centers
    const zoneCenters = new Map<string, { lat: number; lng: number }>();
    zoneGroups.forEach((orders, zone) => {
      const validOrders = orders.filter(o => o.latitude && o.longitude);
      if (validOrders.length > 0) {
        const centerLat = validOrders.reduce((sum, o) => sum + o.latitude!, 0) / validOrders.length;
        const centerLng = validOrders.reduce((sum, o) => sum + o.longitude!, 0) / validOrders.length;
        zoneCenters.set(zone, { lat: centerLat, lng: centerLng });
      }
    });

    // Clear existing markers
    this.markersLayer.clearLayers();

    // Create animation layer for effects
    const animationLayer = L.layerGroup().addTo(this.map);

    // Prepare marker data
    interface AnimatedMarker {
      marker: L.CircleMarker;
      order: PendingOrder;
      startLat: number;
      startLng: number;
      targetLat: number;
      targetLng: number;
      color: string;
      zone: string;
      delay: number;
    }

    const animatedMarkers: AnimatedMarker[] = [];
    let markerIndex = 0;

    allOrders.forEach(order => {
      if (order.latitude && order.longitude) {
        const zone = order.zone || 'unknown';
        const color = this.getZoneColor(zone);
        const center = zoneCenters.get(zone);

        // Create marker at original position
        const marker = L.circleMarker([order.latitude, order.longitude], {
          radius: 8,
          fillColor: '#94A3B8', // Start with gray
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.6
        });

        marker.addTo(this.markersLayer!);

        if (center) {
          const targetLat = order.latitude + (center.lat - order.latitude) * 0.35;
          const targetLng = order.longitude + (center.lng - order.longitude) * 0.35;

          animatedMarkers.push({
            marker,
            order,
            startLat: order.latitude,
            startLng: order.longitude,
            targetLat,
            targetLng,
            color,
            zone,
            delay: markerIndex * 50 // Staggered delay
          });
          markerIndex++;
        }
      }
    });

    // Easing function for smooth animation
    const easeOutElastic = (t: number): number => {
      const p = 0.3;
      return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
    };

    const easeOutCubic = (t: number): number => {
      return 1 - Math.pow(1 - t, 3);
    };

    // Phase 1: Initial pulse wave (staggered)
    animatedMarkers.forEach(({ marker, delay }) => {
      setTimeout(() => {
        marker.setRadius(12);
        marker.setStyle({ fillOpacity: 0.9 });
        setTimeout(() => {
          marker.setRadius(8);
          marker.setStyle({ fillOpacity: 0.6 });
        }, 150);
      }, delay);
    });

    // Phase 2: Draw animated circles around clusters
    const totalPulseTime = animatedMarkers.length * 50 + 200;
    setTimeout(() => {
      zoneCenters.forEach((center, zone) => {
        const color = this.getZoneColor(zone);
        const zoneOrders = zoneGroups.get(zone) || [];
        const validOrders = zoneOrders.filter(o => o.latitude && o.longitude);

        if (validOrders.length >= 2) {
          // Calculate radius to encompass all orders in zone + padding
          let maxDist = 0;
          validOrders.forEach(o => {
            const dist = Math.sqrt(
              Math.pow((o.latitude! - center.lat) * 111000, 2) +
              Math.pow((o.longitude! - center.lng) * 111000 * Math.cos(center.lat * Math.PI / 180), 2)
            );
            maxDist = Math.max(maxDist, dist);
          });

          const targetRadius = maxDist + 150; // Add 150m padding

          // Create circle starting from 0 radius
          const circle = L.circle([center.lat, center.lng], {
            radius: 0,
            fillColor: color,
            fillOpacity: 0,
            color: color,
            weight: 3,
            opacity: 0
          });
          circle.addTo(animationLayer);

          // Animate circle expansion with easing
          const duration = 600;
          const startTime = performance.now();

          const animateCircle = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Elastic easing for bouncy effect
            const eased = progress < 1
              ? 1 - Math.pow(2, -10 * progress) * Math.cos((progress * 10 - 0.75) * (2 * Math.PI) / 3)
              : 1;

            const currentRadius = targetRadius * eased;
            circle.setRadius(currentRadius);
            circle.setStyle({
              opacity: 0.6 + progress * 0.2,
              fillOpacity: progress * 0.12
            });

            if (progress < 1) {
              requestAnimationFrame(animateCircle);
            } else {
              // Pulse effect at the end
              circle.setStyle({ weight: 4, opacity: 0.9 });
              setTimeout(() => {
                circle.setStyle({ weight: 2, opacity: 0.5, fillOpacity: 0.08 });
              }, 150);
            }
          };

          requestAnimationFrame(animateCircle);
        }
      });
    }, totalPulseTime);

    // Phase 3: Move markers and change colors (smooth animation)
    const moveStartTime = totalPulseTime + 400;
    setTimeout(() => {
      const duration = 800;
      const startTime = performance.now();

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOutCubic(progress);

        animatedMarkers.forEach(({ marker, startLat, startLng, targetLat, targetLng, color }) => {
          // Interpolate position
          const currentLat = startLat + (targetLat - startLat) * easedProgress;
          const currentLng = startLng + (targetLng - startLng) * easedProgress;
          marker.setLatLng([currentLat, currentLng]);

          // Interpolate color (blue -> zone color)
          if (progress > 0.3) {
            const colorProgress = (progress - 0.3) / 0.7;
            marker.setStyle({
              fillColor: color,
              fillOpacity: 0.6 + colorProgress * 0.2
            });
          }

          // Grow slightly during movement
          const sizeProgress = Math.sin(progress * Math.PI);
          marker.setRadius(8 + sizeProgress * 3);
        });

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    }, moveStartTime);

    // Phase 4: Final bounce and glow
    const finalPhaseTime = moveStartTime + 900;
    setTimeout(() => {
      // Bounce effect
      animatedMarkers.forEach(({ marker, color }, index) => {
        setTimeout(() => {
          marker.setRadius(14);
          marker.setStyle({
            fillOpacity: 1,
            weight: 3,
            color: color
          });

          setTimeout(() => {
            marker.setRadius(11);
            marker.setStyle({ weight: 2, color: '#fff' });
          }, 100);

          setTimeout(() => {
            marker.setRadius(10);
            marker.setStyle({ fillOpacity: 0.85 });
          }, 200);
        }, index * 30);
      });
    }, finalPhaseTime);

    // Phase 5: Draw connecting lines between clustered orders
    const linesPhaseTime = finalPhaseTime + animatedMarkers.length * 30 + 300;
    setTimeout(() => {
      zoneCenters.forEach((center, zone) => {
        const color = this.getZoneColor(zone);
        const zoneMarkers = animatedMarkers.filter(m => m.zone === zone);

        if (zoneMarkers.length >= 2) {
          // Draw lines from each marker to next
          for (let i = 0; i < zoneMarkers.length; i++) {
            const current = zoneMarkers[i];
            const next = zoneMarkers[(i + 1) % zoneMarkers.length];

            setTimeout(() => {
              const line = L.polyline(
                [[current.targetLat, current.targetLng], [next.targetLat, next.targetLng]],
                {
                  color: color,
                  weight: 2,
                  opacity: 0.4,
                  dashArray: '4, 4'
                }
              );
              line.addTo(animationLayer);
            }, i * 100);
          }
        }
      });
    }, linesPhaseTime);

    // Phase 6: Cleanup and transition
    const cleanupTime = linesPhaseTime + 800;
    setTimeout(() => {
      // Fade out animation layer
      animationLayer.remove();

      this.organizingBatches.set(false);

      // Run the actual batching logic
      this.organizeIntoBatches();
    }, cleanupTime);
  }

  // Calculate convex hull using Graham scan algorithm
  private calculateConvexHull(points: [number, number][]): [number, number][] {
    if (points.length < 3) return points;

    // Find the point with lowest y (and leftmost if tie)
    let start = 0;
    for (let i = 1; i < points.length; i++) {
      if (points[i][0] < points[start][0] ||
          (points[i][0] === points[start][0] && points[i][1] < points[start][1])) {
        start = i;
      }
    }

    // Swap start point to beginning
    [points[0], points[start]] = [points[start], points[0]];
    const pivot = points[0];

    // Sort points by polar angle with pivot
    const sorted = points.slice(1).sort((a, b) => {
      const angleA = Math.atan2(a[0] - pivot[0], a[1] - pivot[1]);
      const angleB = Math.atan2(b[0] - pivot[0], b[1] - pivot[1]);
      return angleA - angleB;
    });

    // Cross product to determine turn direction
    const cross = (o: [number, number], a: [number, number], b: [number, number]) => {
      return (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1]);
    };

    // Build hull
    const hull: [number, number][] = [pivot];
    for (const point of sorted) {
      while (hull.length > 1 && cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) {
        hull.pop();
      }
      hull.push(point);
    }

    return hull;
  }

  loadData(): void {
    this.loading.set(true);

    // Load stats
    this.batchingService.getStats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loading.set(false);
          // Load pending orders for the overview tab
          this.loadPendingOrders();
        },
        error: () => {
          this.loading.set(false);
          this.toast.showError('admin.batching.load_error');
        }
      });

    // Load trips
    this.batchingService.getTrips()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();

    // Load drivers
    this.batchingService.getDrivers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  // Tab navigation
  setActiveTab(tab: TabType): void {
    this.activeTab.set(tab);

    if (tab === 'overview' && this.batchingState() === 'orders' && this.pendingOrders().length === 0) {
      this.loadPendingOrders();
    }

    if (tab === 'map' && this.pendingOrders().length === 0 && this.batchingState() === 'orders') {
      this.loadPendingOrders();
    }
  }

  // Load pending orders for drag-drop
  loadPendingOrders(): void {
    this.loadingOrders.set(true);
    this.batchingService.getPendingOrders()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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

  // Organize orders into batches (run algorithm)
  organizeIntoBatches(): void {
    this.organizingBatches.set(true);

    // Simulate algorithm running with a short delay for animation
    setTimeout(() => {
      const orders = this.pendingOrders();

      // Group orders by zone
      const zoneGroups = new Map<string, PendingOrder[]>();
      orders.forEach(order => {
        const zone = order.zone || 'unknown';
        if (!zoneGroups.has(zone)) {
          zoneGroups.set(zone, []);
        }
        zoneGroups.get(zone)!.push(order);
      });

      // Create batches (max 3 orders per batch, min 2 to be a batch)
      const batches: CustomBatch[] = [];
      const unbatched: PendingOrder[] = [];

      zoneGroups.forEach((zoneOrders, zone) => {
        for (let i = 0; i < zoneOrders.length; i += 3) {
          const batchOrders = zoneOrders.slice(i, i + 3);

          if (batchOrders.length >= 2) {
            batches.push({
              order_ids: batchOrders.map(o => o.id),
              orders: batchOrders,
              zone: zone
            });
          } else {
            unbatched.push(...batchOrders);
          }
        }
      });

      this.customBatches.set(batches);
      this.unbatchedOrders.set(unbatched);
      this.batchingState.set('batches');
      this.organizingBatches.set(false);
    }, 600);
  }

  // Reset to orders view
  resetBatching(): void {
    this.batchingState.set('orders');
    this.customBatches.set([]);
    this.unbatchedOrders.set([]);
    this.loadPendingOrders();
  }

  // Trip builder drag-drop handlers
  dropInTripBuilder(event: CdkDragDrop<PendingOrder[]>): void {
    if (event.previousContainer === event.container) {
      // Reorder within trip builder
      const orders = [...this.tripBuilderOrders()];
      moveItemInArray(orders, event.previousIndex, event.currentIndex);
      this.tripBuilderOrders.set(orders);
    } else {
      // Check max 3 orders
      if (this.tripBuilderOrders().length >= 3) {
        this.toast.showWarn('admin.batching.max_orders_batch');
        return;
      }

      // Add from orders list - manually update both signals
      const pendingList = [...this.pendingOrders()];
      const builderList = [...this.tripBuilderOrders()];
      const [movedOrder] = pendingList.splice(event.previousIndex, 1);
      builderList.splice(event.currentIndex, 0, movedOrder);

      this.pendingOrders.set(pendingList);
      this.tripBuilderOrders.set(builderList);
    }
  }

  dropInOrdersList(event: CdkDragDrop<PendingOrder[]>): void {
    if (event.previousContainer === event.container) {
      // Reorder within orders list
      const orders = [...this.pendingOrders()];
      moveItemInArray(orders, event.previousIndex, event.currentIndex);
      this.pendingOrders.set(orders);
    } else {
      // Move back from trip builder to orders list
      const pendingList = [...this.pendingOrders()];
      const builderList = [...this.tripBuilderOrders()];
      const [movedOrder] = builderList.splice(event.previousIndex, 1);
      pendingList.splice(event.currentIndex, 0, movedOrder);

      this.pendingOrders.set(pendingList);
      this.tripBuilderOrders.set(builderList);
    }
  }

  removeFromTripBuilder(order: PendingOrder): void {
    const orders = this.tripBuilderOrders();
    const index = orders.findIndex(o => o.id === order.id);
    if (index > -1) {
      orders.splice(index, 1);
      this.tripBuilderOrders.set([...orders]);
      this.pendingOrders.update(list => [...list, order]);
    }
  }

  clearTripBuilder(): void {
    const orders = this.tripBuilderOrders();
    this.pendingOrders.update(list => [...list, ...orders]);
    this.tripBuilderOrders.set([]);
    this.tripBuilderDriverId = null;
  }

  // Create and assign trip to driver
  assignTripToDriver(): void {
    const orders = this.tripBuilderOrders();
    const driverId = this.tripBuilderDriverId;

    if (orders.length < 2) {
      this.toast.showWarn('admin.batching.need_two_orders');
      return;
    }

    if (!driverId) {
      this.toast.showWarn('admin.batching.select_driver_required');
      return;
    }

    this.creatingTrip.set(true);

    // First create the trip
    const batchData = [{ order_ids: orders.map(o => o.id) }];

    this.batchingService.runCustomBatching(batchData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response.trips && response.trips.length > 0) {
            const tripId = response.trips[0].id;
            // Now assign to driver
            this.batchingService.assignTrip(tripId, driverId)
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({
                next: (assignResponse) => {
                  this.creatingTrip.set(false);
                  this.toast.showSuccess('admin.batching.trip_assigned_success');
                  this.tripBuilderOrders.set([]);
                  this.tripBuilderDriverId = null;
                  this.loadPendingOrders();
                  this.batchingService.getStats().subscribe();
                  this.batchingService.getTrips().subscribe();
                },
                error: (err) => {
                  this.creatingTrip.set(false);
                  this.toast.showApiError(err, 'admin.batching.assign_error');
                }
              });
          }
        },
        error: (err) => {
          this.creatingTrip.set(false);
          this.toast.showApiError(err, 'admin.batching.run_error');
        }
      });
  }

  // Create trip and send to pool (no driver assigned)
  sendTripToPool(): void {
    const orders = this.tripBuilderOrders();

    if (orders.length < 2) {
      this.toast.showWarn('admin.batching.need_two_orders');
      return;
    }

    this.creatingTrip.set(true);

    const batchData = [{ order_ids: orders.map(o => o.id) }];

    this.batchingService.runCustomBatching(batchData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.creatingTrip.set(false);
          this.toast.showSuccess('admin.batching.trip_created_success');
          this.tripBuilderOrders.set([]);
          this.tripBuilderDriverId = null;
          this.loadPendingOrders();
          this.batchingService.getStats().subscribe();
          this.batchingService.getTrips().subscribe();
        },
        error: (err) => {
          this.creatingTrip.set(false);
          this.toast.showApiError(err, 'admin.batching.run_error');
        }
      });
  }

  // Approve and create trips
  approveAndCreateTrips(): void {
    const batches = this.customBatches();

    if (batches.length === 0) {
      this.toast.showWarn('admin.batching.no_batches_to_create');
      return;
    }

    this.confirmationService.confirm({
      message: `Create ${batches.length} trips from ${this.totalOrdersInBatches()} orders?`,
      header: 'Approve Batches',
      icon: 'pi pi-check-circle',
      accept: () => {
        this.submittingBatches.set(true);

        const batchData = batches.map(b => ({ order_ids: b.order_ids }));

        this.batchingService.runCustomBatching(batchData)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (response) => {
              this.submittingBatches.set(false);
              this.toast.showSuccess('admin.batching.run_success', {
                trips: response.trips_created,
                orders: response.orders_processed
              });
              // Reset and switch to trips tab
              this.batchingState.set('orders');
              this.customBatches.set([]);
              this.unbatchedOrders.set([]);
              this.pendingOrders.set([]);
              this.setActiveTab('trips');
              this.batchingService.getStats().subscribe();
            },
            error: (err) => {
              this.submittingBatches.set(false);
              this.toast.showApiError(err, 'admin.batching.run_error');
            }
          });
      }
    });
  }

  // Drag-drop handlers
  dropInBatch(event: CdkDragDrop<PendingOrder[]>, batchIndex: number): void {
    if (event.previousContainer === event.container) {
      // Reorder within same batch
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      // Move from another batch or unbatched
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );

      // Update the batches
      this.updateBatchAfterDrop(batchIndex);
      this.cleanupEmptyBatches();
    }
  }

  dropInUnbatched(event: CdkDragDrop<PendingOrder[]>): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );

      this.cleanupEmptyBatches();
    }
  }

  private updateBatchAfterDrop(batchIndex: number): void {
    const batches = this.customBatches();
    if (batches[batchIndex]) {
      const batch = batches[batchIndex];
      batch.order_ids = batch.orders.map(o => o.id);

      // Check if batch exceeds max (3 orders)
      if (batch.orders.length > 3) {
        // Move excess to unbatched
        const excess = batch.orders.splice(3);
        batch.order_ids = batch.orders.map(o => o.id);
        this.unbatchedOrders.update(orders => [...orders, ...excess]);
        this.toast.showWarn('admin.batching.max_orders_batch');
      }
    }
  }

  private cleanupEmptyBatches(): void {
    // Remove batches with less than 2 orders
    const batches = this.customBatches();
    const toRemove: PendingOrder[] = [];

    const validBatches = batches.filter(b => {
      if (b.orders.length < 2) {
        toRemove.push(...b.orders);
        return false;
      }
      return true;
    });

    if (toRemove.length > 0) {
      this.customBatches.set(validBatches);
      this.unbatchedOrders.update(orders => [...orders, ...toRemove]);
    }
  }

  // Create new batch from unbatched orders
  createNewBatch(): void {
    const unbatched = this.unbatchedOrders();
    if (unbatched.length < 2) {
      this.toast.showWarn('admin.batching.need_two_orders');
      return;
    }

    // Take first 2-3 orders to create new batch
    const newBatchOrders = unbatched.slice(0, Math.min(3, unbatched.length));
    const remaining = unbatched.slice(newBatchOrders.length);

    const newBatch: CustomBatch = {
      order_ids: newBatchOrders.map(o => o.id),
      orders: newBatchOrders,
      zone: newBatchOrders[0]?.zone
    };

    this.customBatches.update(batches => [...batches, newBatch]);
    this.unbatchedOrders.set(remaining);
  }

  // View trip details
  viewTripDetails(trip: Trip): void {
    this.loadingTripDetail.set(true);
    this.showTripDialog.set(true);

    this.batchingService.getTripDetail(trip.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tripWithStops) => {
          this.selectedTrip.set(tripWithStops);
          this.loadingTripDetail.set(false);
        },
        error: () => {
          this.loadingTripDetail.set(false);
          this.toast.showError('admin.batching.trip_detail_error');
          this.showTripDialog.set(false);
        }
      });
  }

  closeTripDialog(): void {
    this.showTripDialog.set(false);
    this.selectedTrip.set(null);
  }

  // Assign trip
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
    const driverId = this.selectedDriverId;

    if (!trip || !driverId) return;

    this.assigning.set(true);
    this.batchingService.assignTrip(trip.id, driverId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.assigning.set(false);
          this.toast.showSuccess('admin.batching.assign_success', {
            driver: response.trip?.driver_name
          });
          this.closeAssignDialog();
          this.batchingService.getStats().subscribe();
        },
        error: (err) => {
          this.assigning.set(false);
          this.toast.showApiError(err, 'admin.batching.assign_error');
        }
      });
  }

  // Unassign trip
  unassignTrip(trip: Trip): void {
    this.confirmationService.confirm({
      message: `Unassign trip #${trip.id} from ${trip.driver_name}?`,
      header: 'Unassign Trip',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.batchingService.unassignTrip(trip.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.toast.showSuccess('admin.batching.unassign_success');
              this.batchingService.getStats().subscribe();
            },
            error: () => this.toast.showError('admin.batching.unassign_error')
          });
      }
    });
  }

  // Cancel trip
  cancelTrip(trip: Trip): void {
    this.confirmationService.confirm({
      message: `Cancel trip #${trip.id}? Orders will be returned to the pool.`,
      header: 'Cancel Trip',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.batchingService.cancelTrip(trip.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => this.toast.showSuccess('admin.batching.cancel_success'),
            error: () => this.toast.showError('admin.batching.cancel_error')
          });
      }
    });
  }

  // Navigate to order detail
  goToOrder(orderId: number): void {
    this.router.navigate([RouteHelpers.adminOrderDetail(orderId)]);
  }

  // Status helpers
  getStatusSeverity(status: TripStatus): 'secondary' | 'info' | 'warn' | 'success' | 'danger' {
    const severities: Record<TripStatus, 'secondary' | 'info' | 'warn' | 'success' | 'danger'> = {
      'pending': 'secondary',
      'assigned': 'info',
      'in_progress': 'warn',
      'completed': 'success',
      'cancelled': 'danger'
    };
    return severities[status] || 'secondary';
  }

  getStatusLabel(status: TripStatus): string {
    const labels: Record<TripStatus, string> = {
      'pending': 'Pending',
      'assigned': 'Assigned',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'cancelled': 'Cancelled'
    };
    return labels[status] || status;
  }

  // Filter by status
  filterByStatus(status: TripStatus | null): void {
    this.statusFilter.set(status);
    if (status) {
      this.batchingService.getTrips(status).subscribe();
    } else {
      this.batchingService.getTrips().subscribe();
    }
  }

  // Format zone name
  formatZone(zone: string | undefined): string {
    if (!zone) return 'Unknown';
    return zone.replace('zone_', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // Calculate batch total earnings
  getBatchTotalEarnings(batch: CustomBatch): number {
    return batch.orders.reduce((sum, o) => sum + (o.shipping_cost || 0), 0);
  }

  // Calculate batch total weight
  getBatchTotalWeight(batch: CustomBatch): number {
    return batch.orders.reduce((sum, o) => sum + (o.weight_kg || 0), 0);
  }
}
