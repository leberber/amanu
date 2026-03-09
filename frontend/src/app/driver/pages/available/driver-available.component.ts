import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { trigger, transition, style, animate, stagger, query } from '@angular/animations';

import { DriverService } from '../../../services/driver.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { RouteHelpers } from '../../../core/constants/routes.constants';
import { Order } from '../../../models/order.model';

@Component({
  selector: 'app-driver-available',
  standalone: true,
  imports: [TranslateModule, DecimalPipe],
  templateUrl: './driver-available.component.html',
  styleUrl: './driver-available.component.scss',
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('250ms ease-out', style({ opacity: 1 }))
      ])
    ]),
    trigger('listAnimation', [
      transition(':enter', [
        query('.trip-card', [
          style({ opacity: 0, transform: 'translateY(10px)' }),
          stagger(50, [
            animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true })
      ])
    ])
  ],
  host: {
    '[@fadeIn]': ''
  }
})
export class DriverAvailableComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly driverService = inject(DriverService);
  private readonly toast = inject(ToastMessageService);

  // State from service
  availableTrips = this.driverService.availableTrips;
  canAcceptOrders = this.driverService.canAcceptOrders;

  // Local state
  loading = signal(false);
  accepting = signal<number | null>(null);
  private loadingTimeout: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    // Only show skeleton if request takes longer than 300ms
    this.loadingTimeout = setTimeout(() => {
      this.loading.set(true);
    }, 300);

    this.driverService.getAvailableTrips().subscribe({
      next: () => {
        if (this.loadingTimeout) clearTimeout(this.loadingTimeout);
        this.loading.set(false);
      },
      error: () => {
        if (this.loadingTimeout) clearTimeout(this.loadingTimeout);
        this.loading.set(false);
      }
    });
  }

  acceptTrip(order: Order): void {
    if (this.accepting() || !this.canAcceptOrders()) return;

    this.accepting.set(order.id);

    this.driverService.acceptTrip(order.id).subscribe({
      next: (response) => {
        this.accepting.set(null);
        if (response.success) {
          this.toast.showSuccess('driver.messages.trip_accepted');
          // Navigate to trip detail
          this.router.navigate([RouteHelpers.driverTripDetail(order.id)]);
        }
      },
      error: (err) => {
        this.accepting.set(null);
        this.toast.showError(err.error?.detail || 'driver.messages.trip_accept_failed');
      }
    });
  }

  viewDetails(order: Order): void {
    this.router.navigate([RouteHelpers.driverTripDetail(order.id)]);
  }

  getItemsCount(order: Order): number {
    return order.items?.length || 0;
  }
}
