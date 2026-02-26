import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { PaginatorModule } from 'primeng/paginator';
import { Popover } from 'primeng/popover';
import { TooltipModule } from 'primeng/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { UI, ANIMATION } from '../../../core/constants/app.constants';
import { OrderService } from '../../../services/order.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { Order } from '../../../models/order.model';
import { StatusSeverityService } from '../../../core/services/status-severity.service';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { CurrencyPipe } from '../../../shared/pipes/currency.pipe';
import { DateFormatPipe } from '../../../shared/pipes/date-format.pipe';
import { StatusPipe } from '../../../shared/pipes/status.pipe';

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [
    RouterLink,
    ToastModule,
    TagModule,
    PaginatorModule,
    Popover,
    TooltipModule,
    TranslateModule,
    PageLayoutComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    CurrencyPipe,
    DateFormatPipe,
    StatusPipe
  ],
  templateUrl: './order-list.component.html',
  styleUrls: ['./order-list.component.scss']
})
export class OrderListComponent implements OnInit {
  // Constants from centralized config
  readonly SKELETON_ROWS = Array.from({ length: UI.SKELETON_TABLE_ROWS }, (_, i) => i);
  readonly SKELETON_MOBILE_ROWS = Array.from({ length: UI.SKELETON_MOBILE_ROWS }, (_, i) => i);
  readonly SKELETON_SIDEBAR_ITEMS = Array.from({ length: UI.SKELETON_SIDEBAR_ITEMS }, (_, i) => i);
  readonly ROWS_PER_PAGE_OPTIONS = [5, 10, 25];
  readonly ANIMATION_DELAY = ANIMATION.STAGGER_DELAY;
  readonly TIME_FILTERS = [
    { value: 'all' as const, label: 'orders.filters.all' },
    { value: '7days' as const, label: 'orders.filters.last_7_days' },
    { value: '30days' as const, label: 'orders.filters.last_month' },
    { value: '90days' as const, label: 'orders.filters.last_3_months' }
  ];

  // State signals
  orders = signal<Order[]>([]);
  loading = signal(true);
  error = signal(false);

  // Table state
  isFullscreen = signal(false);
  rows = signal(10);
  first = signal(0);

  // Time filter
  timeFilter = signal<'all' | '7days' | '30days' | '90days'>('all');

  // Computed values
  totalSpend = computed(() =>
    this.orders().reduce((sum, order) => sum + order.total_amount, 0)
  );

  // Filtered orders based on time filter (for mobile)
  filteredOrders = computed(() => {
    const filter = this.timeFilter();
    const orders = this.orders();

    if (filter === 'all') return orders;

    const now = new Date();
    const daysMap = { '7days': 7, '30days': 30, '90days': 90 };
    const cutoffDate = new Date(now.getTime() - daysMap[filter] * 24 * 60 * 60 * 1000);

    return orders.filter(order => new Date(order.created_at) >= cutoffDate);
  });

  // Paginated orders for table (respects time filter)
  paginatedOrders = computed(() => {
    const filtered = this.filteredOrders();
    const start = this.first();
    const end = start + this.rows();
    return filtered.slice(start, end);
  });

  // Page layout subtitle
  pageSubtitle = computed(() => {
    const count = this.orders().length;
    if (count === 0) return '';
    const orderWord = this.translateService.instant(count === 1 ? 'common.order' : 'common.orders');
    return `${count} ${orderWord}`;
  });

  // Route constants
  readonly ROUTES = ROUTES;

  // Services
  private orderService = inject(OrderService);
  private router = inject(Router);
  private toast = inject(ToastMessageService);
  readonly statusSeverity = inject(StatusSeverityService); // Public for template access
  private translateService = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading.set(true);
    this.error.set(false);

    this.orderService.getUserOrders()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (orders) => {
          this.orders.set(orders);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
          this.toast.showError('orders.errors.failed_to_load');
        }
      });
  }

  viewOrderDetails(orderId: number): void {
    this.router.navigate([RouteHelpers.orderDetail(orderId)]);
  }

  // Table actions
  toggleFullscreen(): void {
    this.isFullscreen.update(v => !v);
  }

  setRowsPerPage(rows: number): void {
    this.rows.set(rows);
    this.first.set(0);
  }

  onPageChange(event: { first?: number; rows?: number }): void {
    if (event.first !== undefined) this.first.set(event.first);
    if (event.rows !== undefined) this.rows.set(event.rows);
  }

  getPaginationTemplate(): string {
    const total = this.filteredOrders().length;
    const first = this.first() + 1;
    const last = Math.min(this.first() + this.rows(), total);
    return `${first} - ${last} / ${total}`;
  }

  setTimeFilter(filter: 'all' | '7days' | '30days' | '90days'): void {
    this.timeFilter.set(filter);
    this.first.set(0);
  }
}