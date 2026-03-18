import { Component, OnInit, OnDestroy, signal, inject, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { trigger, transition, style, animate } from '@angular/animations';
import * as L from 'leaflet';

// PrimeNG
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { BadgeModule } from 'primeng/badge';
import { DrawerModule } from 'primeng/drawer';
import { TagModule } from 'primeng/tag';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

// App
import { MAP_DEFAULTS, LEAFLET_TILES, LEAFLET_ASSETS } from '../../../core/constants/map.constants';
import { ROUTES, PAGINATION, USER_ROLES } from '../../../core/constants';
import { AdminService } from '../../../services/admin.service';
import { UserManage, UsersResponse } from '../../../models/admin.model';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';

// Marker colors
const CUSTOMER_COLOR = '#22c55e'; // green
const DEPOT_COLOR = '#3b82f6'; // blue

@Component({
  selector: 'app-admin-users-map',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TooltipModule,
    BadgeModule,
    DrawerModule,
    TagModule,
    TranslateModule,
    PageLayoutComponent
  ],
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
  private router = inject(Router);
  private translateService = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  // Map
  private map!: L.Map;
  private markersLayer = L.layerGroup();
  private depotMarker!: L.Marker;
  private currentTileLayer!: L.TileLayer;

  // State
  readonly loading = signal(true);
  readonly allUsers = signal<UserManage[]>([]);
  readonly selectedUser = signal<UserManage | null>(null);
  readonly drawerVisible = signal(false);

  // Filters
  readonly statusFilter = signal<'all' | 'active' | 'inactive'>('all');

  // Computed - Only customers
  readonly customers = computed(() => {
    return this.allUsers().filter(u => u.role === USER_ROLES.CUSTOMER);
  });

  readonly customersWithLocation = computed(() => {
    return this.customers().filter(u => u.latitude && u.longitude);
  });

  readonly filteredCustomers = computed(() => {
    let users = this.customersWithLocation();

    // Status filter
    if (this.statusFilter() !== 'all') {
      const isActive = this.statusFilter() === 'active';
      users = users.filter(u => u.is_active === isActive);
    }

    return users;
  });

  readonly totalCustomersCount = computed(() => this.customers().length);
  readonly customersWithLocationCount = computed(() => this.customersWithLocation().length);
  readonly filteredCustomersCount = computed(() => this.filteredCustomers().length);

  readonly activeCustomersCount = computed(() =>
    this.customersWithLocation().filter(u => u.is_active).length
  );
  readonly inactiveCustomersCount = computed(() =>
    this.customersWithLocation().filter(u => !u.is_active).length
  );

  readonly ROUTES = ROUTES;

  ngOnInit(): void {
    this.loadUsers();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  private loadUsers(): void {
    this.loading.set(true);
    this.adminService.getAllUsers(1, PAGINATION.FETCH_ALL_LIMIT)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: UsersResponse) => {
          this.allUsers.set(response.users || []);
          this.loading.set(false);
          // Initialize map after data is loaded
          setTimeout(() => this.initMap(), 100);
        },
        error: (err) => {
          console.error('Failed to load users:', err);
          this.loading.set(false);
          // Still initialize the map even on error
          setTimeout(() => this.initMap(), 100);
        }
      });
  }

  private initMap(): void {
    // Fix Leaflet default icon path
    L.Icon.Default.mergeOptions({
      iconUrl: LEAFLET_ASSETS.MARKER_ICON,
      iconRetinaUrl: LEAFLET_ASSETS.MARKER_ICON_RETINA,
      shadowUrl: LEAFLET_ASSETS.MARKER_SHADOW,
    });

    // Create map
    this.map = L.map('users-map', {
      center: [MAP_DEFAULTS.LATITUDE, MAP_DEFAULTS.LONGITUDE],
      zoom: MAP_DEFAULTS.OVERVIEW_ZOOM,
      zoomControl: false
    });

    // Add Google tile layer
    this.currentTileLayer = L.tileLayer(LEAFLET_TILES.GOOGLE.URL, {
      maxZoom: LEAFLET_TILES.GOOGLE.MAX_ZOOM,
      subdomains: LEAFLET_TILES.GOOGLE.SUBDOMAINS,
      attribution: LEAFLET_TILES.GOOGLE.ATTRIBUTION
    }).addTo(this.map);

    // Add markers layer
    this.markersLayer.addTo(this.map);

    // Add depot marker
    this.addDepotMarker();

    // Render customer markers
    this.renderMarkers();

    // Fit bounds to show all markers including depot
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
    this.depotMarker.bindTooltip('Depot - Ouadhia', {
      permanent: false,
      direction: 'top',
      offset: [0, -15]
    });
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
    const color = CUSTOMER_COLOR;
    const initials = this.getInitials(user.full_name);

    // Create custom colored icon
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

    // Add click event
    marker.on('click', () => {
      this.selectUser(user);
    });

    // Add tooltip with user name
    marker.bindTooltip(user.full_name || user.email, {
      permanent: false,
      direction: 'top',
      offset: [0, -35]
    });

    return marker;
  }

  private fitBoundsToMarkers(): void {
    const customers = this.filteredCustomers();

    // Start with depot location
    const points: L.LatLngTuple[] = [[MAP_DEFAULTS.LATITUDE, MAP_DEFAULTS.LONGITUDE]];

    // Add customer locations
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
  setStatusFilter(status: 'all' | 'active' | 'inactive'): void {
    this.statusFilter.set(status);
    this.renderMarkers();
    this.fitBoundsToMarkers();
  }

  // User selection
  selectUser(user: UserManage): void {
    this.selectedUser.set(user);
    this.drawerVisible.set(true);

    // Center map on user
    if (user.latitude && user.longitude) {
      this.map.setView([user.latitude, user.longitude], 15);
    }
  }

  closeDrawer(): void {
    this.drawerVisible.set(false);
    this.selectedUser.set(null);
  }

  // Navigation
  goToUsersList(): void {
    this.router.navigate([ROUTES.ADMIN.USERS]);
  }

  editUser(user: UserManage): void {
    this.router.navigate([ROUTES.ADMIN.USERS, user.id, 'edit']);
  }

  // Helpers
  getStatusSeverity(isActive: boolean): 'success' | 'danger' {
    return isActive ? 'success' : 'danger';
  }

  private getInitials(fullName: string | undefined): string {
    if (!fullName) return '?';

    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) {
      // Single name: return first two letters
      return parts[0].substring(0, 2).toUpperCase();
    }

    // Multiple names: first letter of first name + first letter of last name
    const firstInitial = parts[0].charAt(0).toUpperCase();
    const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
    return firstInitial + lastInitial;
  }
}
