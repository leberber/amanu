import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { trigger, transition, style, animate } from '@angular/animations';
import { HttpClient, HttpParams } from '@angular/common/http';

import { DecimalPipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';

import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { BackButtonComponent } from '../../../shared/components/back-button/back-button.component';
import { LineChartComponent, LineChartDataPoint } from '../../../shared/components/charts/line-chart.component';
import { CurrencyDisplayComponent } from '../../../shared/components/currency-display/currency-display.component';
import { CurrencyService } from '../../../core/services/currency.service';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { environment } from '../../../../environments/environment';
import { formatFractionalCartons } from '../../../shared/utils/quantity.utils';

interface ProductDailySale {
  date: string;
  quantity: number;
  revenue: number;
}

interface ProductCustomerSale {
  customer_id: number;
  customer_name: string;
  quantity: number;
  revenue: number;
  order_count: number;
}

interface ProductAnalyticsSummary {
  total_units: number;
  total_revenue: number;
  unique_customers: number;
  order_count: number;
  avg_quantity_per_order: number;
}

interface ProductAnalyticsResponse {
  product_id: number;
  product_name: string;
  pieces_per_box: number | null;
  packaging_type: string | null;
  daily_sales: ProductDailySale[];
  customer_sales: ProductCustomerSale[];
  summary: ProductAnalyticsSummary;
}

@Component({
  selector: 'app-admin-product-analytics',
  standalone: true,
  imports: [
    FormsModule,
    DecimalPipe,
    ButtonModule,
    ChartModule,
    SelectModule,
    AgroclikPageContainerComponent,
    BackButtonComponent,
    LineChartComponent,
    CurrencyDisplayComponent,
  ],
  templateUrl: './admin-product-analytics.component.html',
  styleUrl: './admin-product-analytics.component.scss',
  animations: [
    trigger('pageAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class AdminProductAnalyticsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);
  protected currencyService = inject(CurrencyService);

  readonly ROUTES = ROUTES;
  readonly RouteHelpers = RouteHelpers;

  productId = signal<number | null>(null);
  analytics = signal<ProductAnalyticsResponse | null>(null);
  loading = signal(true);
  selectedPeriod = signal('30');

  readonly periodOptions = [
    { label: '7 derniers jours', value: '7' },
    { label: '30 derniers jours', value: '30' },
    { label: '90 derniers jours', value: '90' },
    { label: 'Tout le temps', value: 'all' },
  ];

  dailyChartData = computed((): LineChartDataPoint[] => {
    const data = this.analytics();
    if (!data) return [];
    const ppb = data.pieces_per_box;
    return data.daily_sales.map(d => ({
      label: this.formatDate(d.date),
      value: ppb && ppb > 1 ? Math.round(d.quantity / ppb) : d.quantity,
    }));
  });

  customerBarData = computed(() => {
    const data = this.analytics();
    if (!data || data.customer_sales.length === 0) return null;
    const top = [...data.customer_sales].sort((a, b) => b.quantity - a.quantity).slice(0, 15);
    const ppb = data.pieces_per_box;
    return {
      labels: top.map(c => c.customer_name),
      datasets: [{
        label: 'Quantité vendue',
        data: top.map(c => ppb && ppb > 1 ? Math.round(c.quantity / ppb) : c.quantity),
        backgroundColor: 'rgba(99, 102, 241, 0.7)',
        borderColor: '#6366f1',
        borderWidth: 1,
        borderRadius: 6,
      }]
    };
  });

  customerBarOptions = computed(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.8)',
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: (ctx: { raw: number }) => `${ctx.raw.toLocaleString()} unités`,
        }
      },
      datalabels: { display: false }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 }, maxRotation: 35 }
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: { font: { size: 11 } }
      }
    },
    animation: { duration: 400, easing: 'easeOutQuart' }
  }));

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const id = Number(params.get('id'));
        this.productId.set(id);
        this.loadAnalytics();
      });
  }

  onPeriodChange(): void {
    this.loadAnalytics();
  }

  private loadAnalytics(): void {
    const id = this.productId();
    if (!id) return;
    this.loading.set(true);

    let params = new HttpParams();
    const period = this.selectedPeriod();
    if (period !== 'all') {
      const days = parseInt(period, 10);
      const from = new Date();
      from.setDate(from.getDate() - days);
      params = params.set('from_date', from.toISOString());
    }

    this.http.get<ProductAnalyticsResponse>(
      `${environment.apiUrl}/products/${id}/analytics`,
      { params }
    )
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: data => {
        this.analytics.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  }

  toPackagingQty(pieces: number, data: ProductAnalyticsResponse): string {
    const ppb = data.pieces_per_box;
    return ppb && ppb > 1 ? formatFractionalCartons(pieces, ppb) : pieces.toString();
  }

  packagingLabel(data: ProductAnalyticsResponse): string {
    const ppb = data.pieces_per_box;
    if (!ppb || ppb <= 1) return 'unité(s)';
    return data.packaging_type || 'carton(s)';
  }

  goBack(): void {
    this.router.navigate([ROUTES.ADMIN.PRODUCTS]);
  }
}
