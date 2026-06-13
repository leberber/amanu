import { Component, OnInit, computed, inject, signal, DestroyRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { TranslateModule } from '@ngx-translate/core';

import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { OrderService } from '../../../services/order.service';
import { UserPaymentItem } from '../../../models/order.model';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { CurrencyPipe } from '../../../shared/pipes/currency.pipe';
import { DateFormatPipe } from '../../../shared/pipes/date-format.pipe';

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

  payments = signal<UserPaymentItem[]>([]);
  loading = signal(true);
  error = signal(false);

  totalPaid = computed(() =>
    this.payments().filter(p => p.amount > 0).reduce((sum, p) => sum + p.amount, 0)
  );

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

  getMethodLabel(method: string): string {
    return method === 'cash' ? 'orders.payments.method_cash' : 'orders.payments.method_virement';
  }
}
