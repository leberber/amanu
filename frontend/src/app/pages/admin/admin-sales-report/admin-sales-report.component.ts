import { Component, OnInit, inject, DestroyRef, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { ChartModule } from 'primeng/chart';

import { ADMIN_CORE_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { onLanguageChange } from '../../../core/utils/language-change.util';
import { AdminService } from '../../../services/admin.service';
import { SalesReport } from '../../../models/admin.model';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { CurrencyService } from '../../../core/services/currency.service';

type PeriodType = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    fill: boolean;
    borderColor: string;
    backgroundColor: string;
    tension: number;
    pointBackgroundColor: string;
    pointBorderColor: string;
    pointHoverBackgroundColor: string;
    pointHoverBorderColor: string;
    pointRadius: number;
    pointHoverRadius: number;
  }[];
}

interface ChartOptions {
  responsive: boolean;
  maintainAspectRatio: boolean;
  plugins: {
    legend: {
      display: boolean;
    };
    tooltip: {
      backgroundColor: string;
      titleFont: { size: number; weight: string };
      bodyFont: { size: number };
      padding: number;
      cornerRadius: number;
      displayColors: boolean;
      callbacks: {
        label: (context: TooltipContext) => string;
      };
    };
  };
  scales: {
    x: {
      grid: { display: boolean };
      ticks: { font: { size: number }; maxRotation: number; minRotation: number };
    };
    y: {
      beginAtZero: boolean;
      grid: { color: string };
      ticks: {
        font: { size: number };
        callback: (value: number) => string;
      };
    };
  };
  interaction: {
    intersect: boolean;
    mode: string;
  };
}

interface TooltipContext {
  label: string;
  raw: number;
}

@Component({
  selector: 'app-admin-sales-report',
  standalone: true,
  imports: [
    ...ADMIN_CORE_IMPORTS,
    ChartModule,
    AgroclikPageContainerComponent
  ],
  templateUrl: './admin-sales-report.component.html',
  styleUrl: './admin-sales-report.component.scss'
})
export class AdminSalesReportComponent implements OnInit {
  // Data signals
  salesReport = signal<SalesReport | null>(null);
  loading = signal(true);
  selectedPeriod = signal<PeriodType>('weekly');

  // Chart signals
  chartData = signal<ChartData | null>(null);
  chartOptions = signal<ChartOptions | null>(null);

  // Period options
  readonly periodOptions: { value: PeriodType; labelKey: string; icon: string }[] = [
    { value: 'daily', labelKey: 'admin.sales_report.period.daily', icon: 'pi-calendar' },
    { value: 'weekly', labelKey: 'admin.sales_report.period.weekly', icon: 'pi-calendar-plus' },
    { value: 'monthly', labelKey: 'admin.sales_report.period.monthly', icon: 'pi-calendar-times' },
    { value: 'yearly', labelKey: 'admin.sales_report.period.yearly', icon: 'pi-chart-line' }
  ];

  // Computed
  hasData = computed(() => {
    const report = this.salesReport();
    return report !== null && report.data.length > 0;
  });

  // Services
  private adminService = inject(AdminService);
  private toast = inject(ToastMessageService);
  private translateService = inject(TranslateService);
  private currencyService = inject(CurrencyService);
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    this.loadReport(this.selectedPeriod());
    onLanguageChange(this.translateService, this.destroyRef, () => this.prepareChart());
  }

  loadReport(period: PeriodType) {
    this.loading.set(true);
    this.selectedPeriod.set(period);

    this.adminService.getSalesReport(period)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (report) => {
          this.salesReport.set(report);
          this.loading.set(false);
          this.prepareChart();
        },
        error: () => {
          this.loading.set(false);
          this.toast.showError('admin.sales_report.load_error');
        }
      });
  }

  selectPeriod(period: PeriodType) {
    if (period !== this.selectedPeriod()) {
      this.loadReport(period);
    }
  }

  prepareChart() {
    const report = this.salesReport();
    if (!report || report.data.length === 0) {
      this.chartData.set(null);
      return;
    }

    const labels = report.data.map(item => this.formatDateLabel(item.date));
    const sales = report.data.map(item => item.sales);

    this.chartData.set({
      labels,
      datasets: [{
        label: this.translateService.instant('admin.sales_report.sales'),
        data: sales,
        fill: true,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        tension: 0.4,
        pointBackgroundColor: '#6366f1',
        pointBorderColor: '#ffffff',
        pointHoverBackgroundColor: '#ffffff',
        pointHoverBorderColor: '#6366f1',
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    });

    this.chartOptions.set({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleFont: { size: 14, weight: 'bold' },
          bodyFont: { size: 13 },
          padding: 12,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            label: (context: TooltipContext) => {
              return this.currencyService.formatCurrency(context.raw);
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 }, maxRotation: 45, minRotation: 0 }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0, 0, 0, 0.05)' },
          ticks: {
            font: { size: 11 },
            callback: (value: number) => this.currencyService.formatCurrency(value)
          }
        }
      },
      interaction: {
        intersect: false,
        mode: 'index'
      }
    });
  }

  private formatDateLabel(dateStr: string): string {
    const date = new Date(dateStr);
    const period = this.selectedPeriod();

    if (period === 'daily') {
      return date.toLocaleDateString(this.translateService.currentLang, {
        day: 'numeric',
        month: 'short'
      });
    } else if (period === 'weekly') {
      return date.toLocaleDateString(this.translateService.currentLang, {
        day: 'numeric',
        month: 'short'
      });
    } else if (period === 'monthly') {
      return date.toLocaleDateString(this.translateService.currentLang, {
        month: 'short',
        year: 'numeric'
      });
    } else {
      return date.getFullYear().toString();
    }
  }

  formatCurrency(value: number): string {
    return this.currencyService.formatCurrency(value);
  }
}
