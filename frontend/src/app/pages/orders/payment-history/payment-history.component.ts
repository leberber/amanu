import { Component, OnInit, computed, inject, signal, DestroyRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { TranslateModule } from '@ngx-translate/core';

import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { TIME_FILTER_OPTIONS, TIME_FILTER_DAYS } from '../../../core/constants/ui.constants';
import { OrderService } from '../../../services/order.service';
import { UserPaymentItem } from '../../../models/order.model';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { CurrencyPipe } from '../../../shared/pipes/currency.pipe';
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
    CurrencyPipe,
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

  payments = signal<UserPaymentItem[]>([]);
  loading = signal(true);
  error = signal(false);
  timeFilter = signal<TimeFilter>('all');

  filteredPayments = computed(() => {
    const filter = this.timeFilter();
    const payments = this.payments();
    if (filter === 'all') return payments;
    const now = new Date();
    const cutoff = new Date(now.getTime() - TIME_FILTER_DAYS[filter] * 24 * 60 * 60 * 1000);
    return payments.filter(p => new Date(p.recorded_at) >= cutoff);
  });

  // Per-order balance map (based on ALL payments, not filtered)
  orderBalanceMap = computed(() => {
    const map = new Map<number, { total: number; paid: number }>();
    for (const p of this.payments()) {
      if (!map.has(p.order_id)) {
        map.set(p.order_id, { total: p.order_total_amount, paid: 0 });
      }
      map.get(p.order_id)!.paid += p.amount;
    }
    return map;
  });

  totalPaid = computed(() =>
    this.filteredPayments().filter(p => p.amount > 0).reduce((sum, p) => sum + p.amount, 0)
  );

  totalOutstanding = computed(() => {
    let outstanding = 0;
    for (const [, { total, paid }] of this.orderBalanceMap()) {
      const balance = total - paid;
      if (balance > 0) outstanding += balance;
    }
    return outstanding;
  });

  ngOnInit(): void {
    this.orderService.getUserPayments()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (payments) => {
          this.payments.set(payments);
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

  getOrderBalance(orderId: number): number {
    const entry = this.orderBalanceMap().get(orderId);
    if (!entry) return 0;
    return entry.total - entry.paid;
  }

  getMethodLabel(method: string): string {
    return method === 'cash' ? 'orders.payments.method_cash' : 'orders.payments.method_virement';
  }
}
