import { Component, input, output, computed, inject, DestroyRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CurrencyService } from '../../../core/services/currency.service';
import { onLanguageChange } from '../../../core/utils/language-change.util';
import Chart from 'chart.js/auto';

// Custom plugin for modern connector lines with percentage labels
const modernLabelsPlugin = {
  id: 'modernLabels',
  afterDraw(chart: Chart) {
    const ctx = chart.ctx;
    const meta = chart.getDatasetMeta(0);
    if (!meta?.data?.length) return;

    const dataset = chart.data.datasets[0];
    const data = dataset.data as number[];
    const total = data.reduce((a, b) => a + b, 0);

    meta.data.forEach((element, index) => {
      const arc = element as unknown as {
        x: number;
        y: number;
        startAngle: number;
        endAngle: number;
        outerRadius: number;
      };

      const value = data[index];
      const percentage = (value / total) * 100;
      if (percentage < 3) return; // Skip small segments

      const midAngle = (arc.startAngle + arc.endAngle) / 2;
      const { x: centerX, y: centerY, outerRadius } = arc;

      // Calculate points
      const startX = centerX + Math.cos(midAngle) * outerRadius;
      const startY = centerY + Math.sin(midAngle) * outerRadius;
      const elbowRadius = outerRadius + 10;
      const elbowX = centerX + Math.cos(midAngle) * elbowRadius;
      const elbowY = centerY + Math.sin(midAngle) * elbowRadius;
      const isRightSide = Math.cos(midAngle) > 0;
      const endX = elbowX + (isRightSide ? 20 : -20);

      ctx.save();

      // Draw connector line
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(elbowX, elbowY);
      ctx.lineTo(endX, elbowY);
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw dot at end
      ctx.beginPath();
      ctx.arc(endX, elbowY, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#9ca3af';
      ctx.fill();

      // Draw percentage label
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = '#374151';
      ctx.textBaseline = 'middle';
      ctx.textAlign = isRightSide ? 'left' : 'right';
      ctx.fillText(`${percentage.toFixed(0)}%`, endX + (isRightSide ? 5 : -5), elbowY);

      ctx.restore();
    });
  }
};

Chart.register(modernLabelsPlugin);

export interface DoughnutChartItem {
  id?: number;
  label: string;
  value: number;
}

export interface DoughnutChartClickEvent {
  index: number;
  item: DoughnutChartItem;
}

export type ChartColorScheme = 'purple' | 'blue' | 'green' | 'orange' | 'mixed';

const COLOR_SCHEMES: Record<ChartColorScheme, { bg: string[]; hover: string[] }> = {
  purple: {
    bg: ['#8b5cf6', '#6366f1', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6'],
    hover: ['#a78bfa', '#818cf8', '#c084fc', '#e879f9', '#f472b6', '#fb7185', '#fb923c', '#facc15', '#4ade80', '#2dd4bf']
  },
  blue: {
    bg: ['#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#22c55e', '#84cc16', '#eab308', '#f59e0b', '#f97316'],
    hover: ['#60a5fa', '#38bdf8', '#22d3ee', '#2dd4bf', '#34d399', '#4ade80', '#a3e635', '#facc15', '#fbbf24', '#fb923c']
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
    // Distinct colors: blue, green, purple, red, yellow, pink, cyan, orange, teal, lime
    bg: ['#3b82f6', '#22c55e', '#8b5cf6', '#ef4444', '#eab308', '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#84cc16'],
    hover: ['#60a5fa', '#4ade80', '#a78bfa', '#f87171', '#facc15', '#f472b6', '#22d3ee', '#fb923c', '#2dd4bf', '#a3e635']
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
        <p-chart type="doughnut" [data]="chartData()" [options]="chartOptions()" (onDataSelect)="onChartClick($event)"></p-chart>
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
  data = input.required<DoughnutChartItem[]>();
  colorScheme = input<ChartColorScheme>('purple');
  loading = input<boolean>(false);
  emptyMessage = input<string>('common.no_data');
  showLegend = input<boolean>(true);
  legendPosition = input<'top' | 'bottom' | 'left' | 'right'>('bottom');
  selectedId = input<number | null>(null);

  itemClick = output<DoughnutChartClickEvent>();

  private translateService = inject(TranslateService);
  private currencyService = inject(CurrencyService);
  private destroyRef = inject(DestroyRef);
  private languageTrigger = 0;

  ngOnInit() {
    onLanguageChange(this.translateService, this.destroyRef, () => {
      this.languageTrigger++;
    });
  }

  hasData = computed(() => {
    const items = this.data();
    return items?.length > 0 && items.some(item => item.value > 0);
  });

  chartData = computed(() => {
    const _ = this.languageTrigger;
    const items = this.data();
    const scheme = COLOR_SCHEMES[this.colorScheme()];
    const selectedId = this.selectedId();

    // Create offset array - selected segment is offset
    const offsets = items.map(item => item.id === selectedId ? 12 : 0);

    // Create border array - selected segment has border
    const borderWidths = items.map(item => item.id === selectedId ? 3 : 0);
    const borderColors = items.map(item => item.id === selectedId ? '#1e293b' : 'transparent');

    return {
      labels: items.map(item => item.label),
      datasets: [{
        data: items.map(item => item.value),
        backgroundColor: scheme.bg.slice(0, items.length),
        hoverBackgroundColor: scheme.hover.slice(0, items.length),
        borderWidth: borderWidths,
        borderColor: borderColors,
        hoverOffset: 8,
        offset: offsets
      }]
    };
  });

  chartOptions = computed(() => {
    const _ = this.languageTrigger;
    const currencyService = this.currencyService;

    return {
      cutout: '45%',
      radius: '60%',
      responsive: true,
      maintainAspectRatio: false,
      onHover: (event: { native: MouseEvent }, elements: unknown[]) => {
        const canvas = event.native?.target as HTMLCanvasElement;
        if (canvas) {
          canvas.style.cursor = elements.length > 0 ? 'pointer' : 'default';
        }
      },
      plugins: {
        legend: {
          display: this.showLegend(),
          position: this.legendPosition(),
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 8,
            boxWidth: 8,
            font: { size: 10, weight: '500' }
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
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${label}: ${currencyService.formatCurrency(value)} (${percentage}%)`;
            }
          }
        },
        datalabels: { display: false }
      },
      animation: false
    };
  });

  onChartClick(event: { element: { index: number } }) {
    if (event?.element) {
      const index = event.element.index;
      const items = this.data();
      if (index >= 0 && index < items.length) {
        this.itemClick.emit({ index, item: items[index] });
      }
    }
  }
}
