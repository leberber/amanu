import { Component, OnInit, OnDestroy, signal, inject, computed, DestroyRef, viewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { trigger, transition, style, animate } from '@angular/animations';
import * as L from 'leaflet';

// PrimeNG
import { ButtonModule } from 'primeng/button';
import { Popover, PopoverModule } from 'primeng/popover';
import { TranslateModule } from '@ngx-translate/core';

// App
import { MAP_DEFAULTS, LEAFLET_TILES, LEAFLET_ASSETS } from '../../../core/constants/map.constants';
import { ROUTES, RouteHelpers } from '../../../core/constants';
import { AdminService } from '../../../services/admin.service';
import { ClientMapPoint } from '../../../models/admin.model';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';

type SpendingTier = 'all' | 'none' | 'low' | 'medium' | 'high' | 'top';

type DatePreset = 'all' | '30d' | '90d' | 'year' | 'custom';

const TIER_CONFIG: Record<Exclude<SpendingTier, 'all'>, { color: string; labelKey: string }> = {
  none:   { color: '#94a3b8', labelKey: 'admin.sales_map.tier_none' },
  low:    { color: '#3b82f6', labelKey: 'admin.sales_map.tier_low' },
  medium: { color: '#22c55e', labelKey: 'admin.sales_map.tier_medium' },
  high:   { color: '#f59e0b', labelKey: 'admin.sales_map.tier_high' },
  top:    { color: '#ef4444', labelKey: 'admin.sales_map.tier_top' },
};

function getTier(totalSpent: number): Exclude<SpendingTier, 'all'> {
  if (totalSpent === 0) return 'none';
  if (totalSpent < 10000) return 'low';
  if (totalSpent < 50000) return 'medium';
  if (totalSpent < 100000) return 'high';
  return 'top';
}

function getRadius(totalSpent: number, maxSpent: number): number {
  if (maxSpent === 0 || totalSpent === 0) return 8;
  const ratio = Math.sqrt(totalSpent / maxSpent);
  return Math.round(8 + ratio * 28);
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Component({
  selector: 'app-admin-sales-map',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    PopoverModule,
    TranslateModule,
    PageLayoutComponent,
  ],
  templateUrl: './admin-sales-map.component.html',
  styleUrl: './admin-sales-map.component.scss',
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('200ms ease-out', style({ opacity: 1 }))
      ])
    ]),
    trigger('slideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(16px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0, transform: 'translateX(16px)' }))
      ])
    ])
  ]
})
export class AdminSalesMapComponent implements OnInit, OnDestroy {
  private adminService = inject(AdminService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly clientPopover = viewChild<Popover>('clientPopover');
  readonly popoverTarget = viewChild<ElementRef>('popoverTarget');

  private map!: L.Map;
  private markersLayer = L.layerGroup();

  // State
  readonly loading = signal(true);
  readonly allClients = signal<ClientMapPoint[]>([]);
  readonly selectedClient = signal<ClientMapPoint | null>(null);
  readonly tierFilter = signal<SpendingTier>('all');
  readonly showTopPanel = signal(false);

  // Date range
  readonly datePreset = signal<DatePreset>('all');
  readonly customStart = signal('');
  readonly customEnd = signal('');

  // Computed
  readonly clientsOnMap = computed(() => this.allClients().filter(c => c.latitude && c.longitude));

  readonly filteredClients = computed(() => {
    const filter = this.tierFilter();
    if (filter === 'all') return this.clientsOnMap();
    return this.clientsOnMap().filter(c => getTier(c.total_spent) === filter);
  });

  readonly maxSpent = computed(() => Math.max(0, ...this.clientsOnMap().map(c => c.total_spent)));

  readonly totalRevenue = computed(() =>
    this.filteredClients().reduce((sum, c) => sum + c.total_spent, 0)
  );

  readonly topSpender = computed(() =>
    this.clientsOnMap().reduce((top, c) => (!top || c.total_spent > top.total_spent ? c : top), null as ClientMapPoint | null)
  );

  readonly tierCounts = computed(() => {
    const counts: Record<Exclude<SpendingTier, 'all'>, number> = { none: 0, low: 0, medium: 0, high: 0, top: 0 };
    for (const c of this.clientsOnMap()) counts[getTier(c.total_spent)]++;
    return counts;
  });

  readonly topClients = computed(() =>
    [...this.filteredClients()]
      .filter(c => c.total_spent > 0)
      .sort((a, b) => b.total_spent - a.total_spent)
      .slice(0, 30)
  );

  readonly dateRangeLabel = computed(() => {
    if (this.datePreset() !== 'custom') return null;
    const s = this.customStart();
    const e = this.customEnd();
    return s && e ? `${this.formatDate(s)} → ${this.formatDate(e)}` : null;
  });

  readonly TIER_CONFIG = TIER_CONFIG;
  readonly ROUTES = ROUTES;
  readonly tiers: Exclude<SpendingTier, 'all'>[] = ['none', 'low', 'medium', 'high', 'top'];
  readonly datePresets: DatePreset[] = ['all', '30d', '90d', 'year', 'custom'];

  readonly selectedTierColor = computed(() => {
    const tier = getTier(this.selectedClient()?.total_spent ?? 0);
    return TIER_CONFIG[tier].color;
  });

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    if (this.map) this.map.remove();
  }

  private getDateParams(): { startDate?: string; endDate?: string } {
    const preset = this.datePreset();
    const now = new Date();
    if (preset === '30d') {
      const d = new Date(now); d.setDate(d.getDate() - 30);
      return { startDate: toIsoDate(d), endDate: toIsoDate(now) };
    }
    if (preset === '90d') {
      const d = new Date(now); d.setDate(d.getDate() - 90);
      return { startDate: toIsoDate(d), endDate: toIsoDate(now) };
    }
    if (preset === 'year') {
      return { startDate: `${now.getFullYear()}-01-01`, endDate: toIsoDate(now) };
    }
    if (preset === 'custom') {
      return { startDate: this.customStart() || undefined, endDate: this.customEnd() || undefined };
    }
    return {};
  }

  private loadData(): void {
    this.loading.set(true);
    const { startDate, endDate } = this.getDateParams();
    this.adminService.getClientsMap(startDate, endDate)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (clients) => {
          this.allClients.set(clients);
          this.loading.set(false);
          if (this.map) {
            this.renderMarkers();
          } else {
            setTimeout(() => this.initMap(), 100);
          }
        },
        error: () => {
          this.loading.set(false);
          if (!this.map) setTimeout(() => this.initMap(), 100);
        }
      });
  }

  private initMap(): void {
    L.Icon.Default.mergeOptions({
      iconUrl: LEAFLET_ASSETS.MARKER_ICON,
      iconRetinaUrl: LEAFLET_ASSETS.MARKER_ICON_RETINA,
      shadowUrl: LEAFLET_ASSETS.MARKER_SHADOW,
    });

    this.map = L.map('sales-map', {
      center: [MAP_DEFAULTS.LATITUDE, MAP_DEFAULTS.LONGITUDE],
      zoom: MAP_DEFAULTS.OVERVIEW_ZOOM,
      zoomControl: false
    });

    L.tileLayer(LEAFLET_TILES.CARTODB_LIGHT.URL, {
      maxZoom: LEAFLET_TILES.CARTODB_LIGHT.MAX_ZOOM,
      subdomains: LEAFLET_TILES.CARTODB_LIGHT.SUBDOMAINS,
      attribution: LEAFLET_TILES.CARTODB_LIGHT.ATTRIBUTION
    }).addTo(this.map);

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
    L.marker([MAP_DEFAULTS.LATITUDE, MAP_DEFAULTS.LONGITUDE], { icon: depotIcon })
      .bindTooltip('Depot - Ouadhia', { permanent: false, direction: 'top', offset: [0, -15] })
      .addTo(this.map);
  }

  private renderMarkers(): void {
    this.markersLayer.clearLayers();
    const max = this.maxSpent();

    for (const client of this.filteredClients()) {
      const tier = getTier(client.total_spent);
      const color = TIER_CONFIG[tier].color;
      const radius = getRadius(client.total_spent, max);

      const circle = L.circleMarker([client.latitude, client.longitude], {
        radius,
        fillColor: color,
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.85,
      });

      const label = client.store_name || client.full_name;
      circle.bindTooltip(`${label} — ${this.formatAmount(client.total_spent)} DA`, {
        permanent: false,
        direction: 'top',
        offset: [0, -radius]
      });

      circle.on('click', (e: L.LeafletMouseEvent) => this.selectClient(client, e.originalEvent));
      circle.addTo(this.markersLayer);
    }
  }

  private fitBoundsToMarkers(): void {
    const pts = this.filteredClients();
    if (!pts.length) return;
    const latLngs: L.LatLngTuple[] = pts.map(c => [c.latitude, c.longitude]);
    latLngs.push([MAP_DEFAULTS.LATITUDE, MAP_DEFAULTS.LONGITUDE]);
    const bounds = L.latLngBounds(latLngs);
    if (bounds.isValid()) this.map.fitBounds(bounds, { padding: [50, 50] });
  }

  // Date range
  setDatePreset(preset: DatePreset): void {
    this.datePreset.set(preset);
    if (preset !== 'custom') {
      this.loadData();
    }
  }

  applyCustomRange(): void {
    if (this.customStart() && this.customEnd()) {
      this.loadData();
    }
  }

  onCustomStartChange(event: Event): void {
    this.customStart.set((event.target as HTMLInputElement).value);
  }

  onCustomEndChange(event: Event): void {
    this.customEnd.set((event.target as HTMLInputElement).value);
  }

  // Tier filter
  setTierFilter(tier: SpendingTier): void {
    this.tierFilter.set(tier);
    this.renderMarkers();
    this.fitBoundsToMarkers();
  }

  // Top panel
  toggleTopPanel(): void {
    this.showTopPanel.update(v => !v);
  }

  flyToClient(client: ClientMapPoint): void {
    this.showTopPanel.set(false);
    this.selectClient(client);
  }

  // Client selection
  selectClient(client: ClientMapPoint, event?: Event): void {
    const popover = this.clientPopover();
    popover?.hide();

    this.selectedClient.set(client);
    this.map.setView([client.latitude, client.longitude], 14, { animate: true });

    setTimeout(() => {
      const target = this.popoverTarget();
      if (popover && target) {
        popover.show(event || new Event('click'), target.nativeElement);
      }
    }, 100);
  }

  closePopover(): void {
    this.clientPopover()?.hide();
    this.selectedClient.set(null);
  }

  onPopoverHide(): void {
    this.selectedClient.set(null);
  }

  goToUserAnalytics(userId: number): void {
    this.router.navigate([RouteHelpers.adminUserAnalytics(userId)]);
  }

  // Helpers
  formatAmount(value: number): string {
    return new Intl.NumberFormat('fr-DZ', { maximumFractionDigits: 0 }).format(value);
  }

  formatDate(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  }

  getTierColor(tier: Exclude<SpendingTier, 'all'>): string {
    return TIER_CONFIG[tier].color;
  }

  getRankColor(rank: number): string {
    if (rank === 1) return '#f59e0b';
    if (rank === 2) return '#94a3b8';
    if (rank === 3) return '#cd7f32';
    return 'var(--text-color-secondary)';
  }

  getTierForClient(client: ClientMapPoint): Exclude<SpendingTier, 'all'> {
    return getTier(client.total_spent);
  }
}
