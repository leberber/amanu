import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { DriverService } from '../../../services/driver.service';
import { RouteHelpers } from '../../../core/constants/routes.constants';
import { ORDER_STATUS_CONFIG } from '../../../core/constants/order.constants';
import { Order } from '../../../models/order.model';
import { DateFormatPipe } from '../../../shared/pipes/date-format.pipe';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-driver-history',
  standalone: true,
  imports: [TranslateModule, DateFormatPipe, DecimalPipe],
  templateUrl: './driver-history.component.html',
  styleUrl: './driver-history.component.scss'
})
export class DriverHistoryComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly driverService = inject(DriverService);

  readonly orderStatusConfig = ORDER_STATUS_CONFIG;

  // State
  history = signal<Order[]>([]);
  loading = signal(false);
  private loadingTimeout: ReturnType<typeof setTimeout> | null = null;

  // Filter state
  selectedPeriod = signal<'week' | 'month' | 'all'>('month');

  ngOnInit(): void {
    this.loadHistory();
  }

  loadHistory(): void {
    // Only show skeleton if request takes longer than 300ms
    this.loadingTimeout = setTimeout(() => {
      this.loading.set(true);
    }, 300);

    this.driverService.getTripHistory(this.selectedPeriod()).subscribe({
      next: (orders) => {
        if (this.loadingTimeout) clearTimeout(this.loadingTimeout);
        this.history.set(orders);
        this.loading.set(false);
      },
      error: () => {
        if (this.loadingTimeout) clearTimeout(this.loadingTimeout);
        this.loading.set(false);
      }
    });
  }

  changePeriod(period: 'week' | 'month' | 'all'): void {
    this.selectedPeriod.set(period);
    this.loadHistory();
  }

  viewDetails(order: Order): void {
    this.router.navigate([RouteHelpers.driverTripDetail(order.id)]);
  }

  getStatusIcon(status: string): string {
    return this.orderStatusConfig[status as keyof typeof this.orderStatusConfig]?.icon || 'pi pi-circle';
  }

  getStatusColor(status: string): string {
    return this.orderStatusConfig[status as keyof typeof this.orderStatusConfig]?.color || '#6b7280';
  }

  getTotalEarnings(): number {
    return this.history().reduce((sum, order) => sum + (order.total_amount || 0), 0);
  }
}
