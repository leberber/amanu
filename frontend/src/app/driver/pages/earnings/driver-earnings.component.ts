import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { trigger, transition, style, animate } from '@angular/animations';

import { DriverService } from '../../../services/driver.service';
import { DriverStats } from '../../../models/driver.model';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';

@Component({
  selector: 'app-driver-earnings',
  standalone: true,
  imports: [TranslateModule, DecimalPipe, PageLayoutComponent],
  templateUrl: './driver-earnings.component.html',
  styleUrl: './driver-earnings.component.scss',
  animations: [
    trigger('pageAnimation', [
      transition(':enter', [
        style({ transform: 'translateX(100%)' }),
        animate('300ms ease-out', style({ transform: 'translateX(0)' }))
      ])
    ])
  ]
})
export class DriverEarningsComponent implements OnInit {
  private readonly driverService = inject(DriverService);

  // State
  stats = this.driverService.stats;
  loading = signal(false);
  selectedPeriod = signal<'today' | 'week' | 'month'>('week');
  private loadingTimeout: ReturnType<typeof setTimeout> | null = null;

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
    // Only show skeleton if request takes longer than 300ms
    this.loadingTimeout = setTimeout(() => {
      this.loading.set(true);
    }, 300);

    this.driverService.getStats().subscribe({
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

  changePeriod(period: 'today' | 'week' | 'month'): void {
    this.selectedPeriod.set(period);
  }
}
