import { Component, input, computed, inject, DestroyRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CurrencyService } from '../../../core/services/currency.service';
import { onLanguageChange } from '../../../core/utils/language-change.util';
import { Chart } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

export interface BarChartDataPoint {
  label: string;
  value: number;
}

export type BarChartColor = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'mixed';

const BAR_COLORS: Record<Exclude<BarChartColor, 'mixed'>, { bg: string; hover: string }> = {
  primary: { bg: 'rgba(99, 102, 241, 0.8)', hover: 'rgba(99, 102, 241, 1)' },
  success: { bg: 'rgba(34, 197, 94, 0.8)', hover: 'rgba(34, 197, 94, 1)' },
  warning: { bg: 'rgba(234, 179, 8, 0.8)', hover: 'rgba(234, 179, 8, 1)' },
  danger: { bg: 'rgba(239, 68, 68, 0.8)', hover: 'rgba(239, 68, 68, 1)' },
  info: { bg: 'rgba(14, 165, 233, 0.8)', hover: 'rgba(14, 165, 233, 1)' },
  purple: { bg: 'rgba(139, 92, 246, 0.8)', hover: 'rgba(139, 92, 246, 1)' }
};

// Distinct colors for mixed mode
const MIXED_COLORS = {
  bg: [
    'rgba(59, 130, 246, 0.8)',   // blue
    'rgba(34, 197, 94, 0.8)',    // green
    'rgba(139, 92, 246, 0.8)',   // purple
    'rgba(239, 68, 68, 0.8)',    // red
    'rgba(234, 179, 8, 0.8)',    // yellow
    'rgba(236, 72, 153, 0.8)',   // pink
    'rgba(6, 182, 212, 0.8)',    // cyan
    'rgba(249, 115, 22, 0.8)',   // orange
    'rgba(20, 184, 166, 0.8)',   // teal
    'rgba(132, 204, 22, 0.8)',   // lime
  ],
  hover: [
    'rgba(59, 130, 246, 1)',
    'rgba(34, 197, 94, 1)',
    'rgba(139, 92, 246, 1)',
    'rgba(239, 68, 68, 1)',
    'rgba(234, 179, 8, 1)',
    'rgba(236, 72, 153, 1)',
    'rgba(6, 182, 212, 1)',
    'rgba(249, 115, 22, 1)',
    'rgba(20, 184, 166, 1)',
    'rgba(132, 204, 22, 1)',
  ]
};

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  imports: [CommonModule, ChartModule, TranslateModule],
  template: `
    <div class="chart-wrapper">
      @if (loading()) {
        <div class="chart-skeleton">
          <div class="skeleton" style="width: 100%; height: 100%; border-radius: var(--radius-md);"></div>
        </div>
      } @else if (hasData()) {
        <p-chart type="bar" [data]="chartData()" [options]="chartOptions()" [plugins]="chartPlugins"></p-chart>
      } @else {
        <div class="empty-state empty-state--compact">
          <div class="empty-state__icon">
            <i class="pi pi-chart-bar"></i>
          </div>
          <h3 class="empty-state__title">{{ emptyMessage() | translate }}</h3>
        </div>
      }
    </div>
  `,
  styles: [`
    .chart-wrapper {
      height: 100%;
      min-height: 150px;
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
export class BarChartComponent implements OnInit {
  readonly chartPlugins = [ChartDataLabels];

  // Inputs
  data = input.required<BarChartDataPoint[]>();
  label = input<string>('');
  color = input<BarChartColor>('primary');
  loading = input<boolean>(false);
  emptyMessage = input<string>('common.no_data');
  horizontal = input<boolean>(false);
  formatAsCurrency = input<boolean>(true);
  showLegend = input<boolean>(false);

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
    const _ = this.languageTrigger;
    const items = this.data();
    const colorType = this.color();

    let bgColors: string | string[];
    let hoverColors: string | string[];

    if (colorType === 'mixed') {
      // Use array of distinct colors, cycling if needed
      bgColors = items.map((_, i) => MIXED_COLORS.bg[i % MIXED_COLORS.bg.length]);
      hoverColors = items.map((_, i) => MIXED_COLORS.hover[i % MIXED_COLORS.hover.length]);
    } else {
      const colorScheme = BAR_COLORS[colorType];
      bgColors = colorScheme.bg;
      hoverColors = colorScheme.hover;
    }

    return {
      labels: items.map(item => item.label),
      datasets: [{
        label: this.label(),
        data: items.map(item => item.value),
        backgroundColor: bgColors,
        hoverBackgroundColor: hoverColors,
        borderRadius: 6,
        borderSkipped: false
      }]
    };
  });

  chartOptions = computed(() => {
    const _ = this.languageTrigger;
    const formatAsCurrency = this.formatAsCurrency();
    const currencyService = this.currencyService;
    const isHorizontal = this.horizontal();
    const items = this.data();
    const maxLabelLength = 20;

    // Helper to truncate labels
    const truncateLabel = (label: string): string => {
      if (label.length > maxLabelLength) {
        return label.substring(0, maxLabelLength - 3) + '...';
      }
      return label;
    };

    return {
      indexAxis: isHorizontal ? 'y' : 'x',
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
            // Show full product name in tooltip title
            title: (tooltipItems: { dataIndex: number }[]) => {
              const index = tooltipItems[0]?.dataIndex;
              return items[index]?.label || '';
            },
            label: (context: { raw: number }) => {
              const value = context.raw || 0;
              return formatAsCurrency
                ? currencyService.formatCurrency(value)
                : value.toLocaleString();
            }
          }
        },
        datalabels: {
          anchor: 'end',
          align: (context: { chart: Chart, dataIndex: number, dataset: { data: number[] } }) => {
            // Get max value to calculate ratio
            const data = context.dataset.data;
            const maxValue = Math.max(...data);
            const currentValue = data[context.dataIndex] || 0;
            const ratio = currentValue / maxValue;

            // If bar takes more than 75% of chart width, put label inside
            return ratio > 0.75 ? 'start' : 'end';
          },
          clamp: true,
          clip: false,
          font: {
            size: 11,
            weight: 'bold'
          },
          color: (context: { chart: Chart, dataIndex: number, dataset: { data: number[] } }) => {
            const data = context.dataset.data;
            const maxValue = Math.max(...data);
            const currentValue = data[context.dataIndex] || 0;
            const ratio = currentValue / maxValue;

            // White text if inside bar, dark text if outside
            return ratio > 0.75 ? '#ffffff' : '#374151';
          },
          formatter: (value: number) => {
            return formatAsCurrency
              ? currencyService.formatCurrency(value)
              : value.toLocaleString();
          }
        }
      },
      scales: {
        x: {
          grid: { display: isHorizontal },
          ticks: {
            font: { size: 11 },
            maxRotation: 45,
            minRotation: 0,
            callback: isHorizontal
              ? (value: number) => formatAsCurrency ? currencyService.formatCurrency(value) : value.toLocaleString()
              : undefined
          }
        },
        y: {
          beginAtZero: true,
          grid: { display: !isHorizontal, color: 'rgba(0, 0, 0, 0.05)' },
          ticks: {
            font: { size: 11 },
            callback: !isHorizontal
              ? (value: number) => formatAsCurrency ? currencyService.formatCurrency(value) : value.toLocaleString()
              : (value: number, index: number) => {
                  // Truncate y-axis labels for horizontal bar chart
                  const label = items[index]?.label || '';
                  return truncateLabel(label);
                }
          }
        }
      },
      animation: {
        duration: 400,
        easing: 'easeOutQuart'
      }
    };
  });
}
