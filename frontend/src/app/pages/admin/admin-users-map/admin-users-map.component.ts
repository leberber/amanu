import { Component, OnInit, OnDestroy, signal, inject, computed, DestroyRef, viewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { trigger, transition, style, animate } from '@angular/animations';
import * as L from 'leaflet';

// PrimeNG
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { BadgeModule } from 'primeng/badge';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { Popover, PopoverModule } from 'primeng/popover';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

// App
import { MAP_DEFAULTS, LEAFLET_TILES, LEAFLET_ASSETS } from '../../../core/constants/map.constants';
import { ROUTES, PAGINATION, USER_ROLES } from '../../../core/constants';
import { AdminService } from '../../../services/admin.service';
import { RoadBuilderService, RouteResult } from '../../../services/road-builder.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { UserManage, CustomerRoute, CustomerRouteWithGeometry } from '../../../models/admin.model';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';

// Marker colors
const CUSTOMER_COLOR = '#22c55e'; // green - has route, no corridor
const NO_ROUTE_COLOR = '#f97316'; // orange - no route
const CORRIDOR_PALETTE = ['#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1', '#d97706', '#ef4444', '#10b981'];

@Component({
  selector: 'app-admin-users-map',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TooltipModule,
    BadgeModule,
    PopoverModule,
    TagModule,
    InputTextModule,
    ConfirmDialogModule,
    TranslateModule,
    PageLayoutComponent
  ],
  providers: [ConfirmationService],
  templateUrl: './admin-users-map.component.html',
  styleUrl: './admin-users-map.component.scss',
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('200ms ease-out', style({ opacity: 1 }))
      ])
    ])
  ]
})
export class AdminUsersMapComponent implements OnInit, OnDestroy {
  private adminService = inject(AdminService);
  private roadBuilderService = inject(RoadBuilderService);
  private router = inject(Router);
  private translateService = inject(TranslateService);
  private toastService = inject(ToastMessageService);
  private confirmationService = inject(ConfirmationService);
  private destroyRef = inject(DestroyRef);

  // Popover reference
  readonly userPopover = viewChild<Popover>('userPopover');
  readonly popoverTarget = viewChild<ElementRef>('popoverTarget');

  // Map
  private map!: L.Map;
  private markersLayer = L.layerGroup();
  private routeLayer = L.layerGroup();
  private depotMarker!: L.Marker;
  private currentTileLayer!: L.TileLayer;

  // State
  readonly loading = signal(true);
  readonly allUsers = signal<UserManage[]>([]);
  readonly customerRouteUserIds = signal<Set<number>>(new Set());
  readonly customerRoutesMap = signal<Map<number, CustomerRoute>>(new Map());
  readonly routeGeometryMap = signal<Map<number, [number, number][]>>(new Map());
  readonly selectedUser = signal<UserManage | null>(null);
  readonly popoverVisible = signal(false);

  // Route management state
  readonly routePreview = signal<RouteResult | null>(null);
  readonly loadingRoute = signal(false);
  readonly savingRoute = signal(false);
  readonly deletingRoute = signal(false);
  readonly editingRoute = signal(false);
  readonly editCorridor = signal('');
  readonly savingCorridor = signal(false);
  readonly savingAllRoutes = signal(false);

  // Filters
  readonly routeFilter = signal<'all' | 'without_route'>('all');
  readonly searchQuery = signal('');

  // Computed - Check if selected user has a route
  readonly selectedUserHasRoute = computed(() => {
    const user = this.selectedUser();
    if (!user) return false;
    return this.customerRouteUserIds().has(user.id);
  });

  // Computed - Get selected user's route
  readonly selectedUserRoute = computed(() => {
    const user = this.selectedUser();
    if (!user) return null;
    return this.customerRoutesMap().get(user.id) || null;
  });

  // Computed - Only customers
  readonly customers = computed(() => {
    return this.allUsers().filter(u => u.role === USER_ROLES.CUSTOMER);
  });

  readonly customersWithLocation = computed(() => {
    return this.customers().filter(u => u.latitude && u.longitude);
  });

  readonly filteredCustomers = computed(() => {
    let users = this.customersWithLocation();

    if (this.routeFilter() === 'without_route') {
      const routeUserIds = this.customerRouteUserIds();
      users = users.filter(u => !routeUserIds.has(u.id));
    }

    const query = this.searchQuery().trim().toLowerCase();
    if (query) {
      users = users.filter(u =>
        (u.full_name || '').toLowerCase().includes(query) ||
        (u.phone || '').includes(query) ||
        (u.commune || '').toLowerCase().includes(query)
      );
    }

    return users;
  });

  readonly totalCustomersCount = computed(() => this.customers().length);
  readonly customersWithLocationCount = computed(() => this.customersWithLocation().length);
  readonly filteredCustomersCount = computed(() => this.filteredCustomers().length);

  readonly customersWithRouteCount = computed(() => {
    const routeUserIds = this.customerRouteUserIds();
    return this.customersWithLocation().filter(u => routeUserIds.has(u.id)).length;
  });

  readonly customersWithoutRouteCount = computed(() => {
    const routeUserIds = this.customerRouteUserIds();
    return this.customersWithLocation().filter(u => !routeUserIds.has(u.id)).length;
  });

  readonly routeCoveragePercent = computed(() => {
    const total = this.customersWithLocationCount();
    if (total === 0) return 0;
    return Math.round((this.customersWithRouteCount() / total) * 100);
  });

  readonly ROUTES = ROUTES;

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  private loadData(): void {
    this.loading.set(true);

    forkJoin({
      users: this.adminService.getAllUsers(1, PAGINATION.FETCH_ALL_LIMIT),
      routes: this.adminService.getCustomerRoutes().pipe(catchError(() => of([]))),
      geometry: this.adminService.getCustomerRoutesWithGeometry().pipe(catchError(() => of([])))
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ users, routes, geometry }) => {
          this.allUsers.set(users.users || []);

          const routeUserIds = new Set(routes.map(r => r.user_id));
          this.customerRouteUserIds.set(routeUserIds);

          const routesMap = new Map<number, CustomerRoute>();
          routes.forEach(r => routesMap.set(r.user_id, r));
          this.customerRoutesMap.set(routesMap);

          // Build geometry map: user_id -> [[lng, lat], ...]
          const geoMap = new Map<number, [number, number][]>();
          (geometry as CustomerRouteWithGeometry[]).forEach(r => {
            if (r.coordinates?.length) {
              geoMap.set(r.user_id, r.coordinates as [number, number][]);
            }
          });
          this.routeGeometryMap.set(geoMap);

          this.loading.set(false);
          setTimeout(() => this.initMap(), 100);
        },
        error: () => {
          this.loading.set(false);
          setTimeout(() => this.initMap(), 100);
        }
      });
  }

  private initMap(): void {
    L.Icon.Default.mergeOptions({
      iconUrl: LEAFLET_ASSETS.MARKER_ICON,
      iconRetinaUrl: LEAFLET_ASSETS.MARKER_ICON_RETINA,
      shadowUrl: LEAFLET_ASSETS.MARKER_SHADOW,
    });

    this.map = L.map('users-map', {
      center: [MAP_DEFAULTS.LATITUDE, MAP_DEFAULTS.LONGITUDE],
      zoom: MAP_DEFAULTS.OVERVIEW_ZOOM,
      zoomControl: false
    });

    this.currentTileLayer = L.tileLayer(LEAFLET_TILES.GOOGLE.URL, {
      maxZoom: LEAFLET_TILES.GOOGLE.MAX_ZOOM,
      subdomains: LEAFLET_TILES.GOOGLE.SUBDOMAINS,
      attribution: LEAFLET_TILES.GOOGLE.ATTRIBUTION
    }).addTo(this.map);

    this.routeLayer.addTo(this.map);
    this.markersLayer.addTo(this.map);
    this.addDepotMarker();
    this.renderMarkers();
    this.fitBoundsToMarkers();
  }

  private addDepotMarker(): void {
    const depotIcon = L.divIcon({
      className: 'warehouse-marker',
      html: `<div style="width:40px;height:40px;background:linear-gradient(135deg,#F59E0B,#D97706);border-radius:50%;border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><i class="pi pi-warehouse" style="color:white;font-size:18px;"></i></div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    this.depotMarker = L.marker([MAP_DEFAULTS.LATITUDE, MAP_DEFAULTS.LONGITUDE], { icon: depotIcon });
    this.depotMarker.bindTooltip('Depot - Ouadhia', { permanent: false, direction: 'top', offset: [0, -15] });
    this.depotMarker.addTo(this.map);
  }

  private renderMarkers(): void {
    this.markersLayer.clearLayers();
    const customers = this.filteredCustomers();
    customers.forEach(user => {
      if (user.latitude && user.longitude) {
        const marker = this.createUserMarker(user);
        marker.addTo(this.markersLayer);
      }
    });
  }

  private createUserMarker(user: UserManage): L.Marker {
    const hasRoute = this.customerRouteUserIds().has(user.id);
    const route = this.customerRoutesMap().get(user.id);
    const initials = this.getInitials(user.full_name);

    let color: string;
    if (!hasRoute) {
      color = NO_ROUTE_COLOR;
    } else if (route?.corridor) {
      color = this.getCorridorColor(route.corridor);
    } else {
      color = CUSTOMER_COLOR;
    }

    const icon = L.divIcon({
      className: 'user-marker',
      html: `
        <div class="marker-pin" style="background-color: ${color}; border-color: ${color}">
          <span class="marker-initial">${initials}</span>
        </div>
      `,
      iconSize: [30, 42],
      iconAnchor: [15, 42],
      popupAnchor: [0, -42]
    });

    const marker = L.marker([user.latitude!, user.longitude!], { icon });

    marker.on('click', (e: L.LeafletMouseEvent) => {
      this.selectUser(user, e.originalEvent);
    });

    marker.bindTooltip(user.full_name || user.email, {
      permanent: false,
      direction: 'top',
      offset: [0, -35]
    });

    return marker;
  }

  private fitBoundsToMarkers(): void {
    const customers = this.filteredCustomers();
    const points: L.LatLngTuple[] = [[MAP_DEFAULTS.LATITUDE, MAP_DEFAULTS.LONGITUDE]];
    customers
      .filter(u => u.latitude && u.longitude)
      .forEach(u => points.push([u.latitude!, u.longitude!]));

    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      if (bounds.isValid()) {
        this.map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }

  // Filter methods
  setRouteFilter(filter: 'all' | 'without_route'): void {
    this.routeFilter.set(filter);
    this.renderMarkers();
    this.fitBoundsToMarkers();
  }

  toggleMobileFilter(): void {
    const newFilter = this.routeFilter() === 'all' ? 'without_route' : 'all';
    this.setRouteFilter(newFilter);
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
    this.renderMarkers();
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.renderMarkers();
  }

  // User selection - zooms to bounding box and auto-draws saved route
  selectUser(user: UserManage, event?: Event): void {
    const popover = this.userPopover();
    if (popover) {
      popover.hide();
    }

    this.selectedUser.set(user);
    this.routePreview.set(null);
    this.clearRouteFromMap();

    if (user.latitude && user.longitude) {
      // Zoom to bounding box: depot <-> customer
      const bounds = L.latLngBounds([
        [MAP_DEFAULTS.LATITUDE, MAP_DEFAULTS.LONGITUDE],
        [user.latitude, user.longitude]
      ]);
      this.map.fitBounds(bounds, { padding: [80, 80] });
    }

    // Auto-draw saved route if geometry available
    if (this.customerRouteUserIds().has(user.id)) {
      this.drawSavedRouteOnMap(user.id);
    }

    setTimeout(() => {
      const target = this.popoverTarget();
      if (popover && target) {
        popover.show(event || new Event('click'), target.nativeElement);
        this.popoverVisible.set(true);
      }
    }, 100);
  }

  closePopover(): void {
    const popover = this.userPopover();
    if (popover) {
      popover.hide();
    }
    this.popoverVisible.set(false);
    this.selectedUser.set(null);
    this.routePreview.set(null);
    this.editingRoute.set(false);
    this.editCorridor.set('');
    this.clearRouteFromMap();
  }

  onPopoverHide(): void {
    this.popoverVisible.set(false);
    this.selectedUser.set(null);
    this.routePreview.set(null);
    this.editingRoute.set(false);
    this.editCorridor.set('');
    this.clearRouteFromMap();
  }

  // Route management
  async fetchRoutePreview(): Promise<void> {
    const user = this.selectedUser();
    if (!user?.latitude || !user?.longitude) return;

    this.loadingRoute.set(true);
    this.routePreview.set(null);
    this.clearRouteFromMap();

    try {
      const route = await this.roadBuilderService.getRoute(
        [
          { lat: MAP_DEFAULTS.LATITUDE, lng: MAP_DEFAULTS.LONGITUDE },
          { lat: user.latitude, lng: user.longitude }
        ],
        'google'
      );

      this.routePreview.set(route);
      this.drawRouteOnMap(route.coordinates);

      const bounds = L.latLngBounds([
        [MAP_DEFAULTS.LATITUDE, MAP_DEFAULTS.LONGITUDE],
        [user.latitude, user.longitude]
      ]);
      this.map.fitBounds(bounds, { padding: [80, 80] });
    } catch {
      this.toastService.showError(
        this.translateService.instant('admin.users.map.route_fetch_error')
      );
    } finally {
      this.loadingRoute.set(false);
    }
  }

  async saveRoute(): Promise<void> {
    const user = this.selectedUser();
    if (!user) return;

    this.savingRoute.set(true);

    this.adminService.fetchAndSaveCustomerRoute(user.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (savedRoute) => {
          const routeUserIds = new Set(this.customerRouteUserIds());
          routeUserIds.add(user.id);
          this.customerRouteUserIds.set(routeUserIds);

          const routesMap = new Map(this.customerRoutesMap());
          routesMap.set(user.id, savedRoute);
          this.customerRoutesMap.set(routesMap);

          // Cache the preview coordinates as geometry
          const preview = this.routePreview();
          if (preview?.coordinates?.length) {
            const geoMap = new Map(this.routeGeometryMap());
            geoMap.set(user.id, preview.coordinates.map(c => [c.lng, c.lat] as [number, number]));
            this.routeGeometryMap.set(geoMap);
          }

          this.routePreview.set(null);
          this.savingRoute.set(false);

          this.toastService.showSuccess(
            this.translateService.instant('admin.users.map.route_saved')
          );

          this.renderMarkers();
          this.drawSavedRouteOnMap(user.id);
        },
        error: () => {
          this.savingRoute.set(false);
          this.toastService.showError(
            this.translateService.instant('admin.users.map.route_save_error')
          );
        }
      });
  }

  cancelRoutePreview(): void {
    this.routePreview.set(null);
    this.clearRouteFromMap();

    const user = this.selectedUser();
    if (user?.latitude && user?.longitude) {
      const bounds = L.latLngBounds([
        [MAP_DEFAULTS.LATITUDE, MAP_DEFAULTS.LONGITUDE],
        [user.latitude, user.longitude]
      ]);
      this.map.fitBounds(bounds, { padding: [80, 80] });
    }
  }

  confirmDeleteRoute(): void {
    this.confirmationService.confirm({
      message: this.translateService.instant('admin.users.map.delete_route_confirm'),
      header: this.translateService.instant('common.confirm'),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deleteRoute()
    });
  }

  private deleteRoute(): void {
    const user = this.selectedUser();
    if (!user) return;

    this.deletingRoute.set(true);

    this.adminService.deleteCustomerRoute(user.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const routeUserIds = new Set(this.customerRouteUserIds());
          routeUserIds.delete(user.id);
          this.customerRouteUserIds.set(routeUserIds);

          const routesMap = new Map(this.customerRoutesMap());
          routesMap.delete(user.id);
          this.customerRoutesMap.set(routesMap);

          const geoMap = new Map(this.routeGeometryMap());
          geoMap.delete(user.id);
          this.routeGeometryMap.set(geoMap);

          this.clearRouteFromMap();
          this.deletingRoute.set(false);

          this.toastService.showSuccess(
            this.translateService.instant('admin.users.map.route_deleted')
          );

          this.renderMarkers();
        },
        error: () => {
          this.deletingRoute.set(false);
          this.toastService.showError(
            this.translateService.instant('admin.users.map.route_delete_error')
          );
        }
      });
  }

  saveAllMissingRoutes(): void {
    this.savingAllRoutes.set(true);

    this.adminService.fetchAndSaveAllCustomerRoutes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.savingAllRoutes.set(false);
          this.toastService.showSuccess(
            `${result.fetched} routes enregistrés, ${result.skipped} ignorés, ${result.failed} échoués`
          );
          this.loadData();
        },
        error: () => {
          this.savingAllRoutes.set(false);
          this.toastService.showError(
            this.translateService.instant('admin.users.map.route_save_error')
          );
        }
      });
  }

  private drawSavedRouteOnMap(userId: number): void {
    const coordinates = this.routeGeometryMap().get(userId);
    if (!coordinates?.length) return;

    this.routeLayer.clearLayers();
    // Backend GeoJSON is [lng, lat], Leaflet needs [lat, lng]
    const latLngs = coordinates.map(([lng, lat]) => L.latLng(lat, lng));
    const polyline = L.polyline(latLngs, { color: '#3b82f6', weight: 5, opacity: 0.8 });
    polyline.addTo(this.routeLayer);
  }

  private drawRouteOnMap(coordinates: { lat: number; lng: number }[]): void {
    this.routeLayer.clearLayers();
    const latLngs = coordinates.map(c => L.latLng(c.lat, c.lng));
    const polyline = L.polyline(latLngs, { color: '#3b82f6', weight: 5, opacity: 0.8 });
    polyline.addTo(this.routeLayer);
  }

  private clearRouteFromMap(): void {
    this.routeLayer.clearLayers();
  }

  // Route editing
  startEditRoute(): void {
    const route = this.selectedUserRoute();
    this.editCorridor.set(route?.corridor || '');
    this.editingRoute.set(true);
  }

  cancelEditRoute(): void {
    this.editingRoute.set(false);
    this.editCorridor.set('');
  }

  saveRouteCorridor(): void {
    const user = this.selectedUser();
    if (!user) return;

    this.savingCorridor.set(true);

    this.adminService.updateCustomerRoute(user.id, { corridor: this.editCorridor() || undefined })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updatedRoute) => {
          const routesMap = new Map(this.customerRoutesMap());
          routesMap.set(user.id, updatedRoute);
          this.customerRoutesMap.set(routesMap);

          this.editingRoute.set(false);
          this.savingCorridor.set(false);

          this.toastService.showSuccess(
            this.translateService.instant('admin.users.map.route_updated')
          );

          this.renderMarkers();
        },
        error: () => {
          this.savingCorridor.set(false);
          this.toastService.showError(
            this.translateService.instant('admin.users.map.route_update_error')
          );
        }
      });
  }

  onCorridorInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.editCorridor.set(input.value);
  }

  // Navigation
  goToUsersList(): void {
    this.router.navigate([ROUTES.ADMIN.USERS]);
  }

  // Helpers
  getStatusSeverity(isActive: boolean): 'success' | 'danger' {
    return isActive ? 'success' : 'danger';
  }

  private getCorridorColor(corridor: string): string {
    let hash = 0;
    const lower = corridor.toLowerCase();
    for (let i = 0; i < lower.length; i++) {
      hash = (hash * 31 + lower.charCodeAt(i)) % CORRIDOR_PALETTE.length;
    }
    return CORRIDOR_PALETTE[Math.abs(hash) % CORRIDOR_PALETTE.length];
  }

  private getInitials(fullName: string | undefined): string {
    if (!fullName) return '?';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return parts[0].charAt(0).toUpperCase() + parts[parts.length - 1].charAt(0).toUpperCase();
  }
}
