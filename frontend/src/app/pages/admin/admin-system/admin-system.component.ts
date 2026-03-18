import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService } from '../../../services/admin.service';
import { SystemMetrics, SystemHealth, ApiError } from '../../../models/admin.model';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ProgressBarModule } from 'primeng/progressbar';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { AccordionModule } from 'primeng/accordion';
import { trigger, transition, style, animate, stagger, query } from '@angular/animations';

@Component({
  selector: 'app-admin-system',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    CardModule,
    TagModule,
    ProgressBarModule,
    TooltipModule,
    SkeletonModule,
    AccordionModule
  ],
  templateUrl: './admin-system.component.html',
  styleUrl: './admin-system.component.scss',
  animations: [
    trigger('pageAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('staggerAnimation', [
      transition(':enter', [
        query('.metric-card', [
          style({ opacity: 0, transform: 'translateY(20px)' }),
          stagger(100, [
            animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true })
      ])
    ])
  ]
})
export class AdminSystemComponent implements OnInit, OnDestroy {
  private adminService = inject(AdminService);

  metrics = signal<SystemMetrics | null>(null);
  health = signal<SystemHealth | null>(null);
  errors = signal<ApiError[]>([]);
  totalErrors = signal(0);
  loading = signal(true);
  loadingErrors = signal(false);
  clearingErrors = signal(false);
  error = signal<string | null>(null);
  autoRefresh = signal(true);
  lastUpdated = signal<Date | null>(null);
  showAllSlowest = signal(false);
  showAllTop = signal(false);

  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  // Computed values for UI
  cpuStatus = computed(() => {
    const m = this.metrics();
    if (!m) return 'normal';
    return m.system.cpu.status;
  });

  memoryStatus = computed(() => {
    const m = this.metrics();
    if (!m) return 'normal';
    return m.system.memory.status;
  });

  diskStatus = computed(() => {
    const m = this.metrics();
    if (!m) return 'normal';
    return m.system.disk.status;
  });

  apiStatus = computed(() => {
    const m = this.metrics();
    if (!m) return 'normal';
    return m.api.status;
  });

  // Computed for displayed endpoints (5 or all)
  displayedSlowestEndpoints = computed(() => {
    const m = this.metrics();
    if (!m) return [];
    return this.showAllSlowest() ? m.api.slowest_endpoints : m.api.slowest_endpoints.slice(0, 5);
  });

  displayedTopEndpoints = computed(() => {
    const m = this.metrics();
    if (!m) return [];
    return this.showAllTop() ? m.api.top_endpoints : m.api.top_endpoints.slice(0, 6);
  });

  ngOnInit(): void {
    this.loadMetrics();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  loadMetrics(): void {
    // Load metrics, health, and errors in parallel
    this.adminService.getSystemMetrics().subscribe({
      next: (data) => {
        this.metrics.set(data);
        this.loading.set(false);
        this.error.set(null);
        this.lastUpdated.set(new Date());
      },
      error: (err) => {
        this.error.set('Failed to load system metrics');
        this.loading.set(false);
      }
    });

    this.adminService.getSystemHealth().subscribe({
      next: (data) => {
        this.health.set(data);
      },
      error: () => {}
    });

    this.loadErrors();
  }

  loadErrors(): void {
    this.loadingErrors.set(true);
    this.adminService.getSystemErrors(100).subscribe({
      next: (data) => {
        this.errors.set(data.errors);
        this.totalErrors.set(data.total_errors);
        this.loadingErrors.set(false);
      },
      error: () => {
        this.loadingErrors.set(false);
      }
    });
  }

  clearErrors(): void {
    this.clearingErrors.set(true);
    this.adminService.clearSystemErrors().subscribe({
      next: () => {
        this.errors.set([]);
        this.clearingErrors.set(false);
      },
      error: () => {
        this.clearingErrors.set(false);
      }
    });
  }

  getStatusCodeSeverity(code: number): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
    if (code >= 500) return 'danger';
    if (code >= 400) return 'warning';
    return 'info';
  }

  refresh(): void {
    this.loadMetrics();
  }

  toggleAutoRefresh(): void {
    this.autoRefresh.set(!this.autoRefresh());
    if (this.autoRefresh()) {
      this.startAutoRefresh();
    } else {
      this.stopAutoRefresh();
    }
  }

  private startAutoRefresh(): void {
    if (this.refreshInterval) return;
    this.refreshInterval = setInterval(() => {
      if (this.autoRefresh()) {
        this.loadMetrics();
      }
    }, 30000); // Refresh every 30 seconds
  }

  private stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  getStatusSeverity(status: string): 'success' | 'warning' | 'danger' {
    switch (status) {
      case 'normal': return 'success';
      case 'medium': return 'warning';
      case 'high': return 'danger';
      default: return 'success';
    }
  }

  getHealthSeverity(status: string): 'success' | 'warning' | 'danger' {
    switch (status) {
      case 'healthy': return 'success';
      case 'warning': return 'warning';
      case 'critical': return 'danger';
      default: return 'success';
    }
  }

  getProgressColor(status: string): string {
    switch (status) {
      case 'normal': return '';
      case 'medium': return 'bg-yellow-500';
      case 'high': return 'bg-red-500';
      default: return '';
    }
  }

  formatTime(ms: number): string {
    if (ms < 1) return '<1ms';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  toggleShowAllSlowest(): void {
    this.showAllSlowest.set(!this.showAllSlowest());
  }

  toggleShowAllTop(): void {
    this.showAllTop.set(!this.showAllTop());
  }
}
