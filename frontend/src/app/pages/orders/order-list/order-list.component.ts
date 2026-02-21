// src/app/pages/orders/order-list/order-list.component.ts
import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { OrderService } from '../../../services/order.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { Order } from '../../../models/order.model';
import { StatusSeverityService } from '../../../core/services/status-severity.service';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { CurrencyPipe } from '../../../shared/pipes/currency.pipe';
import { DateFormatPipe } from '../../../shared/pipes/date-format.pipe';

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [
    RouterLink,
    TableModule,
    ToastModule,
    TagModule,
    TranslateModule,
    PageLayoutComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    CurrencyPipe,
    DateFormatPipe
  ],
  templateUrl: './order-list.component.html',
  styleUrls: ['./order-list.component.scss']
})
export class OrderListComponent implements OnInit {
  // State signals
  orders = signal<Order[]>([]);
  loading = signal(true);
  error = signal(false);

  // Computed values
  totalSpend = computed(() =>
    this.orders().reduce((sum, order) => sum + order.total_amount, 0)
  );

  // Route constants
  readonly ROUTES = ROUTES;

  // Services
  private orderService = inject(OrderService);
  private router = inject(Router);
  private toast = inject(ToastMessageService);
  private translateService = inject(TranslateService);
  private statusSeverity = inject(StatusSeverityService);
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

  getStatusSeverity(status: string): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" {
    return this.statusSeverity.getOrderStatusSeverity(status);
  }

  getStatusLabel(status: string): string {
    return this.translateService.instant(`orders.status.${status}`);
  }
}