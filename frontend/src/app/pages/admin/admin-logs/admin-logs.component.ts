import { Component, OnInit, OnDestroy, inject, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';

import { ADMIN_CORE_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { AdminService } from '../../../services/admin.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { LogEntry, LogStats } from '../../../models/admin.model';

@Component({
  selector: 'app-admin-logs',
  standalone: true,
  imports: [
    ...ADMIN_CORE_IMPORTS,
    SelectModule,
    TagModule
  ],
  templateUrl: './admin-logs.component.html',
  styleUrl: './admin-logs.component.scss'
})
export class AdminLogsComponent implements OnInit, OnDestroy {
  private readonly adminService = inject(AdminService);
  private readonly toastService = inject(ToastMessageService);
  private readonly destroyRef = inject(DestroyRef);

  // State
  loading = signal(true);
  entries = signal<LogEntry[]>([]);
  stats = signal<LogStats | null>(null);

  // Filters
  selectedLevel = signal<string | null>(null);
  selectedLines = signal(100);

  // Auto-refresh
  autoRefresh = signal(false);
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  // Options
  levelOptions = [
    { label: 'All Levels', value: null },
    { label: 'INFO', value: 'INFO' },
    { label: 'WARNING', value: 'WARNING' },
    { label: 'ERROR', value: 'ERROR' }
  ];

  linesOptions = [
    { label: '50 lines', value: 50 },
    { label: '100 lines', value: 100 },
    { label: '200 lines', value: 200 },
    { label: '500 lines', value: 500 }
  ];

  // Computed
  filteredEntries = computed(() => {
    const level = this.selectedLevel();
    const all = this.entries();
    if (!level) return all;
    return all.filter(e => e.level === level);
  });

  errorCount = computed(() => this.entries().filter(e => e.level === 'ERROR').length);
  warningCount = computed(() => this.entries().filter(e => e.level === 'WARNING').length);

  ngOnInit(): void {
    this.loadLogs();
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  loadLogs(): void {
    this.loading.set(true);

    this.adminService.getLogs(this.selectedLines(), this.selectedLevel() || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.entries.set(response.entries);
          this.stats.set(response.stats);
          this.loading.set(false);
        },
        error: () => {
          this.toastService.showError('Failed to load logs');
          this.loading.set(false);
        }
      });
  }

  onLevelChange(level: string | null): void {
    this.selectedLevel.set(level);
    this.loadLogs();
  }

  onLinesChange(lines: number): void {
    this.selectedLines.set(lines);
    this.loadLogs();
  }

  toggleAutoRefresh(): void {
    if (this.autoRefresh()) {
      this.stopAutoRefresh();
    } else {
      this.startAutoRefresh();
    }
  }

  private startAutoRefresh(): void {
    this.autoRefresh.set(true);
    this.refreshInterval = setInterval(() => {
      this.loadLogs();
    }, 30000); // Refresh every 30 seconds
  }

  private stopAutoRefresh(): void {
    this.autoRefresh.set(false);
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  getLevelSeverity(level: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (level) {
      case 'ERROR': return 'danger';
      case 'WARNING': return 'warn';
      case 'INFO': return 'info';
      case 'DEBUG': return 'secondary';
      default: return 'secondary';
    }
  }

  scrollToBottom(): void {
    const container = document.querySelector('.logs-container');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  scrollToTop(): void {
    const container = document.querySelector('.logs-container');
    if (container) {
      container.scrollTop = 0;
    }
  }
}
