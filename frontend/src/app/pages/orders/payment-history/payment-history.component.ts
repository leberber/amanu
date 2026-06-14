import { Component, OnInit, computed, inject, signal, DestroyRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { TranslateModule } from '@ngx-translate/core';

import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { TIME_FILTER_OPTIONS, TIME_FILTER_DAYS } from '../../../core/constants/ui.constants';
import { OrderService } from '../../../services/order.service';
import { OrderFinancialSummary } from '../../../models/order.model';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { CurrencyDisplayComponent } from '../../../shared/components/currency-display/currency-display.component';
import { DateFormatPipe } from '../../../shared/pipes/date-format.pipe';

type TimeFilter = 'all' | '7days' | '30days' | '90days';

@Component({
  selector: 'app-payment-history',
  standalone: true,
  imports: [
    RouterLink,
    TranslateModule,
    PageLayoutComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    CurrencyDisplayComponent,
    DateFormatPipe
  ],
  templateUrl: './payment-history.component.html',
  styleUrl: './payment-history.component.scss'
})
export class PaymentHistoryComponent implements OnInit {
  private orderService = inject(OrderService);
  private destroyRef = inject(DestroyRef);

  readonly ROUTES = ROUTES;
  readonly RouteHelpers = RouteHelpers;
  readonly SKELETON_ROWS = [1, 2, 3, 4, 5];
  readonly TIME_FILTERS = TIME_FILTER_OPTIONS;

  orders = signal<OrderFinancialSummary[]>([]);
  loading = signal(true);
  error = signal(false);
  timeFilter = signal<TimeFilter>('all');

  filteredOrders = computed(() => {
    const filter = this.timeFilter();
    const orders = this.orders().filter(o => o.status !== 'cancelled');
    if (filter === 'all') return orders;
    const cutoff = new Date(Date.now() - TIME_FILTER_DAYS[filter] * 24 * 60 * 60 * 1000);
    return orders.filter(o => new Date(o.created_at) >= cutoff);
  });

  totalPaid = computed(() =>
    this.filteredOrders().reduce((sum, o) => sum + o.total_paid, 0)
  );

  totalOutstanding = computed(() =>
    this.orders()
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + Math.max(0, o.total_amount - o.total_paid), 0)
  );

  ngOnInit(): void {
    this.orderService.getFinancialSummary()
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

  setTimeFilter(filter: TimeFilter): void {
    this.timeFilter.set(filter);
  }

  getRemaining(order: OrderFinancialSummary): number {
    return Math.max(0, order.total_amount - order.total_paid);
  }

  getPaymentStatusSeverity(status: string): string {
    if (status === 'paid') return 'success';
    if (status === 'partial') return 'warn';
    return 'danger';
  }
}
