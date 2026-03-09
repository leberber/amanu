import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { trigger, transition, style, animate, stagger, query } from '@angular/animations';

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
  styleUrl: './driver-history.component.scss',
  animations: [
    trigger('listAnimation', [
      transition(':enter', [
        query('.history-item', [
          style({ opacity: 0, transform: 'translateY(10px)' }),
          stagger(40, [
            animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true })
      ])
    ])
  ]
})
export class DriverHistoryComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly driverService = inject(DriverService);

  readonly orderStatusConfig = ORDER_STATUS_CONFIG;

  // State
  history = signal<Order[]>([]);
  loading = signal(true);
  
  // Filter state
  selectedPeriod = signal<'week' | 'month' | 'all'>('month');

  ngOnInit(): void {
    this.loadHistory();
  }

  loadHistory(): void {
    this.loading.set(true);
    this.driverService.getTripHistory(this.selectedPeriod()).subscribe({
      next: (orders) => {
        this.history.set(orders);
        this.loading.set(false);
      },
      error: () => {
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
