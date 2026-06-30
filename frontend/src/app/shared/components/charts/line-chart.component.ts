import { Component, input, computed, inject, DestroyRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CurrencyService } from '../../../core/services/currency.service';
import { onLanguageChange } from '../../../core/utils/language-change.util';

export interface LineChartDataPoint {
  label: string | string[];
  value: number;
}

export type LineChartColor = 'primary' | 'success' | 'warning' | 'danger' | 'info';

const LINE_COLORS: Record<LineChartColor, { border: string; background: string; point: string }> = {
  primary: { border: '#6366f1', background: 'rgba(99, 102, 241, 0.1)', point: '#6366f1' },
  success: { border: '#22c55e', background: 'rgba(34, 197, 94, 0.1)', point: '#22c55e' },
  warning: { border: '#eab308', background: 'rgba(234, 179, 8, 0.1)', point: '#eab308' },
  danger: { border: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', point: '#ef4444' },
  info: { border: '#0ea5e9', background: 'rgba(14, 165, 233, 0.1)', point: '#0ea5e9' }
};

@Component({
  selector: 'app-line-chart',
  standalone: true,
  imports: [CommonModule, ChartModule, TranslateModule],
  template: `
    <div class="chart-wrapper">
      @if (loading()) {
        <div class="chart-skeleton">
          <div class="skeleton" style="width: 100%; height: 100%; border-radius: var(--radius-md);"></div>
        </div>
      } @else if (hasData()) {
        <p-chart type="line" [data]="chartData()" [options]="chartOptions()"></p-chart>
      } @else {
        <div class="empty-state empty-state--compact">
          <div class="empty-state__icon">
            <i class="pi pi-chart-line"></i>
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
export class LineChartComponent implements OnInit {
  // Inputs
  data = input.required<LineChartDataPoint[]>();
  label = input<string>('');
  color = input<LineChartColor>('primary');
  loading = input<boolean>(false);
  emptyMessage = input<string>('common.no_data');
  fill = input<boolean>(true);
  showLegend = input<boolean>(false);
  tension = input<number>(0.4);
  formatAsCurrency = input<boolean>(true);
  tooltipLabels = input<string[]>([]);
  pointColors = input<string[]>([]);
  tickColors = input<string[]>([]);
  yAxisLabel = input<string>('');

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
    return items && items.length > 0;
  });

  chartData = computed(() => {
    // Access languageTrigger to trigger recomputation
    const _ = this.languageTrigger;
    const items = this.data();
    const colorScheme = LINE_COLORS[this.color()];
    const perPointColors = this.pointColors();
    const hasPerPointColors = perPointColors.length > 0;

    return {
      labels: items.map(item => item.label),
      datasets: [{
        label: this.label(),
        data: items.map(item => item.value),
        fill: this.fill(),
        borderColor: colorScheme.border,
        backgroundColor: colorScheme.background,
        tension: this.tension(),
        pointBackgroundColor: hasPerPointColors ? perPointColors : colorScheme.point,
        pointBorderColor: '#ffffff',
        pointHoverBackgroundColor: '#ffffff',
        pointHoverBorderColor: hasPerPointColors ? perPointColors : colorScheme.point,
        pointRadius: hasPerPointColors ? 7 : 4,
        pointHoverRadius: hasPerPointColors ? 9 : 6
      }]
    };
  });

  chartOptions = computed(() => {
    // Access languageTrigger to trigger recomputation
    const _ = this.languageTrigger;
    const formatAsCurrency = this.formatAsCurrency();
    const currencyService = this.currencyService;
    const tooltipLabelsArr = this.tooltipLabels();
    const tickColorsArr = this.tickColors();
    const yLabel = this.yAxisLabel();

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: this.showLegend()
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleFont: { size: 14, weight: 'bold' },
          bodyFont: { size: 13 },
          padding: 12,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            label: (context: { raw: number }) => {
              const value = context.raw || 0;
              return formatAsCurrency
                ? currencyService.formatCurrency(value)
                : value.toLocaleString();
            },
            afterLabel: (context: { dataIndex: number }) => {
              const label = tooltipLabelsArr[context.dataIndex];
              return label ? `↑ ${label}` : '';
            }
          }
        },
        datalabels: { display: false }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { size: 12 },
            maxRotation: 45,
            minRotation: 0,
            color: tickColorsArr.length > 0
              ? (context: { index: number }) => tickColorsArr[context.index] ?? 'rgba(100,100,100,0.8)'
              : undefined
          }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0, 0, 0, 0.05)' },
          title: { display: !!yLabel, text: yLabel, font: { size: 11 }, color: 'rgba(100,100,100,0.8)' },
          ticks: {
            font: { size: 12 },
            callback: (value: number) => {
              if (!formatAsCurrency) return value.toLocaleString();
              // Compact format: 1K, 10K, 1M, etc.
              if (value >= 1000000) {
                return (value / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
              }
              if (value >= 1000) {
                return (value / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
              }
              return value.toString();
            }
          }
        }
      },
      interaction: {
        intersect: false,
        mode: 'index'
      },
      animation: {
        duration: 400,
        easing: 'easeOutQuart'
      }
    };
  });
}
