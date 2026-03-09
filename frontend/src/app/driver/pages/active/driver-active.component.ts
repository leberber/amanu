import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { trigger, transition, style, animate, stagger, query } from '@angular/animations';

import { DriverService } from '../../../services/driver.service';
import { RouteHelpers } from '../../../core/constants/routes.constants';
import { ORDER_STATUS, ORDER_STATUS_CONFIG } from '../../../core/constants/order.constants';
import { Order } from '../../../models/order.model';

@Component({
  selector: 'app-driver-active',
  standalone: true,
  imports: [TranslateModule, DecimalPipe],
  templateUrl: './driver-active.component.html',
  styleUrl: './driver-active.component.scss',
  animations: [
    trigger('listAnimation', [
      transition(':enter', [
        query('.order-card', [
          style({ opacity: 0, transform: 'translateY(10px)' }),
          stagger(50, [
            animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true })
      ])
    ])
  ]
})
export class DriverActiveComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly driverService = inject(DriverService);

  readonly ORDER_STATUS = ORDER_STATUS;
  readonly orderStatusConfig = ORDER_STATUS_CONFIG;

  // State from service
  activeTrips = this.driverService.activeTrips;
  loading = this.driverService.loading;

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.driverService.getActiveTrips().subscribe();
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

  getStatusLabel(status: string): string {
    return this.orderStatusConfig[status as keyof typeof this.orderStatusConfig]?.label || status;
  }

  getItemsCount(order: Order): number {
    return order.items?.length || 0;
  }
}
