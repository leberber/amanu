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
import { UI, ANIMATION, TIME_FILTER_DAYS, TIME_FILTER_OPTIONS } from '../../../core/constants/ui.constants';
import { PAGINATION } from '../../../core/constants';
import { OrderService } from '../../../services/order.service';
import { AuthService } from '../../../services/auth.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { Order } from '../../../models/order.model';
import { StatusSeverityService } from '../../../core/services/status-severity.service';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { CurrencyDisplayComponent } from '../../../shared/components/currency-display/currency-display.component';
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
    CurrencyDisplayComponent,
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
  readonly ROWS_PER_PAGE_OPTIONS = PAGINATION.USER_PAGE_SIZE_OPTIONS;
  readonly ANIMATION_DELAY = ANIMATION.STAGGER_DELAY;
  readonly TIME_FILTERS = TIME_FILTER_OPTIONS;

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

  // Filtered orders based on time filter
  filteredOrders = computed(() => {
    const filter = this.timeFilter();
    const orders = this.orders();

    if (filter === 'all') return orders;

    const now = new Date();
    const days = TIME_FILTER_DAYS[filter];
    const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    return orders.filter(order => new Date(order.created_at) >= cutoffDate);
  });

  // Computed values (reactive to time filter)
  totalSpend = computed(() =>
    this.filteredOrders().reduce((sum, order) => sum + order.total_amount, 0)
  );

  totalOutstanding = computed(() =>
    this.filteredOrders().reduce((sum, order) => sum + Math.max(0, order.total_amount - (order.total_paid ?? 0)), 0)
  );

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
  readonly router = inject(Router);
  private toast = inject(ToastMessageService);
  readonly statusSeverity = inject(StatusSeverityService); // Public for template access
  private translateService = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private authService = inject(AuthService);

  ngOnInit(): void {
    // Skip loading for inactive users to avoid 400 errors
    if (!this.authService.currentUserValue?.is_active) {
      this.loading.set(false);
      return;
    }
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