import { Component, input, computed, inject, DestroyRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CurrencyService } from '../../../core/services/currency.service';
import { onLanguageChange } from '../../../core/utils/language-change.util';

export interface DoughnutChartItem {
  label: string;
  value: number;
}

export type ChartColorScheme = 'purple' | 'blue' | 'green' | 'orange' | 'mixed';

const COLOR_SCHEMES: Record<ChartColorScheme, { bg: string[]; hover: string[] }> = {
  purple: {
    bg: ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6'],
    hover: ['#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185', '#fb923c', '#facc15', '#4ade80', '#2dd4bf']
  },
  blue: {
    bg: ['#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#22c55e', '#84cc16', '#eab308', '#f59e0b', '#f97316', '#ef4444'],
    hover: ['#38bdf8', '#22d3ee', '#2dd4bf', '#34d399', '#4ade80', '#a3e635', '#facc15', '#fbbf24', '#fb923c', '#f87171']
  },
  green: {
    bg: ['#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'],
    hover: ['#4ade80', '#34d399', '#2dd4bf', '#22d3ee', '#38bdf8', '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6']
  },
  orange: {
    bg: ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ea580c', '#c2410c', '#9a3412', '#eab308', '#facc15', '#fef08a'],
    hover: ['#fb923c', '#fdba74', '#fed7aa', '#ffedd5', '#f97316', '#ea580c', '#c2410c', '#facc15', '#fde047', '#fef9c3']
  },
  mixed: {
    bg: ['#6366f1', '#0ea5e9', '#22c55e', '#eab308', '#f97316', '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e', '#84cc16'],
    hover: ['#818cf8', '#38bdf8', '#4ade80', '#facc15', '#fb923c', '#f472b6', '#a78bfa', '#2dd4bf', '#fb7185', '#a3e635']
  }
};

@Component({
  selector: 'app-doughnut-chart',
  standalone: true,
  imports: [CommonModule, ChartModule, TranslateModule],
  template: `
    <div class="chart-wrapper">
      @if (loading()) {
        <div class="chart-skeleton">
          <div class="skeleton" style="width: 200px; height: 200px; border-radius: 50%; margin: 0 auto;"></div>
        </div>
      } @else if (hasData()) {
        <p-chart type="doughnut" [data]="chartData()" [options]="chartOptions()"></p-chart>
      } @else {
        <div class="empty-state empty-state--compact">
          <div class="empty-state__icon">
            <i class="pi pi-chart-pie"></i>
          </div>
          <h3 class="empty-state__title">{{ emptyMessage() | translate }}</h3>
        </div>
      }
    </div>
  `,
  styles: [`
    .chart-wrapper {
      height: 100%;
      min-height: 180px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .chart-skeleton {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
    }

    :host ::ng-deep p-chart {
      display: block;
      width: 100%;
      height: 100%;
    }
  `]
})
export class DoughnutChartComponent implements OnInit {
  // Inputs
  data = input.required<DoughnutChartItem[]>();
  title = input<string>('');
  colorScheme = input<ChartColorScheme>('purple');
  loading = input<boolean>(false);
  emptyMessage = input<string>('common.no_data');
  showPercentage = input<boolean>(true);
  showLegend = input<boolean>(true);
  legendPosition = input<'top' | 'bottom' | 'left' | 'right'>('bottom');

  // Services
  private translateService = inject(TranslateService);
  private currencyService = inject(CurrencyService);
  private destroyRef = inject(DestroyRef);

  // Internal state for re-rendering on language change
  private languageTrigger = 0;

  ngOnInit() {
    onLanguageChange(this.translateService, this.destroyRef, () => {
      this.languageTrigger++;
    });
  }

  hasData = computed(() => {
    const items = this.data();
    return items && items.length > 0 && items.some(item => item.value > 0);
  });

  chartData = computed(() => {
    // Access languageTrigger to trigger recomputation
    const _ = this.languageTrigger;
    const items = this.data();
    const scheme = COLOR_SCHEMES[this.colorScheme()];

    return {
      labels: items.map(item => item.label),
      datasets: [{
        label: this.title(),
        data: items.map(item => item.value),
        backgroundColor: scheme.bg.slice(0, items.length),
        hoverBackgroundColor: scheme.hover.slice(0, items.length),
        borderWidth: 0,
        hoverOffset: 8
      }]
    };
  });

  chartOptions = computed(() => {
    // Access languageTrigger to trigger recomputation
    const _ = this.languageTrigger;
    const showPercentage = this.showPercentage();
    const currencyService = this.currencyService;

    return {
      cutout: '55%',
      radius: '85%',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: this.showLegend(),
          position: this.legendPosition(),
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 8,
            boxWidth: 8,
            font: {
              size: 10,
              weight: '500'
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleFont: { size: 14, weight: 'bold' },
          bodyFont: { size: 13 },
          padding: 12,
          cornerRadius: 8,
          displayColors: true,
          boxPadding: 6,
          callbacks: {
            label: (context: { label: string; raw: number; dataset: { data: number[] } }) => {
              const label = context.label || '';
              const value = context.raw || 0;
              const formatted = currencyService.formatCurrency(value);

              if (showPercentage) {
                const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${label}: ${formatted} (${percentage}%)`;
              }

              return `${label}: ${formatted}`;
            }
          }
        }
      },
      animation: {
        animateRotate: true,
        animateScale: true
      },
      locale: this.translateService.currentLang === 'ar' ? 'ar-SA' : this.translateService.currentLang
    };
  });
}
