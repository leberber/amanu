import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';
import { HttpClient, HttpParams } from '@angular/common/http';

import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';

import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { BackButtonComponent } from '../../../shared/components/back-button/back-button.component';
import { LineChartComponent, LineChartDataPoint } from '../../../shared/components/charts/line-chart.component';
import { CurrencyDisplayComponent } from '../../../shared/components/currency-display/currency-display.component';
import { CurrencyService } from '../../../core/services/currency.service';
import { ROUTES } from '../../../core/constants/routes.constants';
import { environment } from '../../../../environments/environment';

interface UserDailyActivity {
  date: string;
  order_count: number;
  revenue: number;
}

interface UserTopProduct {
  product_id: number;
  product_name: string;
  pieces_per_box: number | null;
  packaging_type: string | null;
  quantity: number;
  revenue: number;
  order_count: number;
}

interface UserAnalyticsSummary {
  total_orders: number;
  total_spent: number;
  avg_order_value: number;
  unique_products: number;
  avg_days_between_orders: number | null;
  first_order_date: string | null;
  last_order_date: string | null;
}

interface UserAnalyticsResponse {
  user_id: number;
  user_name: string;
  daily_activity: UserDailyActivity[];
  top_products: UserTopProduct[];
  summary: UserAnalyticsSummary;
}

@Component({
  selector: 'app-admin-user-analytics',
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
  templateUrl: './admin-user-analytics.component.html',
  styleUrl: './admin-user-analytics.component.scss',
  animations: [
    trigger('pageAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class AdminUserAnalyticsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);
  protected currencyService = inject(CurrencyService);

  readonly ROUTES = ROUTES;

  userId = signal<number | null>(null);
  analytics = signal<UserAnalyticsResponse | null>(null);
  loading = signal(true);
  selectedPeriod = signal('30');
  activeChart = signal<'orders' | 'revenue'>('revenue');

  readonly periodOptions = [
    { label: '7 derniers jours', value: '7' },
    { label: '30 derniers jours', value: '30' },
    { label: '90 derniers jours', value: '90' },
    { label: 'Tout le temps', value: 'all' },
  ];

  dailyRevenueData = computed((): LineChartDataPoint[] => {
    const data = this.analytics();
    if (!data) return [];
    return data.daily_activity.map(d => ({
      label: this.formatDate(d.date),
      value: d.revenue,
    }));
  });

  dailyOrdersData = computed((): LineChartDataPoint[] => {
    const data = this.analytics();
    if (!data) return [];
    return data.daily_activity.map(d => ({
      label: this.formatDate(d.date),
      value: d.order_count,
    }));
  });

  sortedProducts = computed(() => {
    const data = this.analytics();
    if (!data) return [];
    return [...data.top_products].sort(
      (a, b) => this.toPackagingQty(b.quantity, b) - this.toPackagingQty(a.quantity, a)
    );
  });

  topProductsBarData = computed(() => {
    const data = this.analytics();
    if (!data || data.top_products.length === 0) return null;
    const top = [...data.top_products]
      .sort((a, b) => this.toPackagingQty(b.quantity, b) - this.toPackagingQty(a.quantity, a))
      .slice(0, 12);
    return {
      labels: top.map(p => p.product_name),
      datasets: [{
        label: 'Quantité',
        data: top.map(p => this.toPackagingQty(p.quantity, p)),
        backgroundColor: 'rgba(99, 102, 241, 0.7)',
        borderColor: '#6366f1',
        borderWidth: 1,
        borderRadius: 6,
      }]
    };
  });

  topProductsBarOptions = computed(() => ({
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.8)',
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: (ctx: { raw: number }) => `${ctx.raw.toLocaleString()}`,
        }
      },
      datalabels: { display: false }
    },
    scales: {
      x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 } } },
      y: { grid: { display: false }, ticks: { font: { size: 11 } } }
    },
    animation: { duration: 400, easing: 'easeOutQuart' }
  }));

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const id = Number(params.get('id'));
        this.userId.set(id);
        this.loadAnalytics();
      });
  }

  onPeriodChange(): void {
    this.loadAnalytics();
  }

  toPackagingQty(pieces: number, product: UserTopProduct): number {
    const ppb = product.pieces_per_box;
    return ppb && ppb > 1 ? Math.round(pieces / ppb) : pieces;
  }

  packagingLabel(product: UserTopProduct): string {
    const ppb = product.pieces_per_box;
    if (!ppb || ppb <= 1) return 'unité(s)';
    return product.packaging_type || 'carton(s)';
  }

  private loadAnalytics(): void {
    const id = this.userId();
    if (!id) return;
    this.loading.set(true);

    let params = new HttpParams();
    const period = this.selectedPeriod();
    if (period !== 'all') {
      const from = new Date();
      from.setDate(from.getDate() - parseInt(period, 10));
      params = params.set('from_date', from.toISOString());
    }

    this.http.get<UserAnalyticsResponse>(
      `${environment.apiUrl}/users/${id}/analytics`,
      { params }
    )
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: data => { this.analytics.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  private formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  }

  goBack(): void {
    this.router.navigate([ROUTES.ADMIN.USERS]);
  }
}
