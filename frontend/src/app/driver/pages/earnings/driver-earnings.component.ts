import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { trigger, transition, style, animate } from '@angular/animations';

import { DriverService } from '../../../services/driver.service';
import { DriverStats } from '../../../models/driver.model';

@Component({
  selector: 'app-driver-earnings',
  standalone: true,
  imports: [TranslateModule, DecimalPipe],
  templateUrl: './driver-earnings.component.html',
  styleUrl: './driver-earnings.component.scss',
  animations: [
    trigger('pageAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class DriverEarningsComponent implements OnInit {
  private readonly driverService = inject(DriverService);

  // State
  stats = this.driverService.stats;
  loading = signal(true);
  selectedPeriod = signal<'today' | 'week' | 'month'>('week');

  // Computed
  periodEarnings = computed(() => {
    const s = this.stats();
    if (!s) return 0;

    switch (this.selectedPeriod()) {
      case 'today':
        return s.earnings_today || 0;
      case 'week':
        return s.earnings_this_week || 0;
      case 'month':
        return s.total_earnings || 0; // Use total as month approximation for now
    }
  });

  periodDeliveries = computed(() => {
    const s = this.stats();
    if (!s) return 0;

    switch (this.selectedPeriod()) {
      case 'today':
        return s.deliveries_today || 0;
      case 'week':
        return s.deliveries_this_week || 0;
      case 'month':
        return s.total_deliveries || 0; // Use total as month approximation for now
    }
  });

  averagePerDelivery = computed(() => {
    const earnings = this.periodEarnings();
    const deliveries = this.periodDeliveries();
    return deliveries > 0 ? earnings / deliveries : 0;
  });

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.loading.set(true);
    this.driverService.getStats().subscribe({
      next: () => {
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  changePeriod(period: 'today' | 'week' | 'month'): void {
    this.selectedPeriod.set(period);
  }
}
