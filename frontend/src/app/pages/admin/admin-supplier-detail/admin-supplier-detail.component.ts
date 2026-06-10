import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { forkJoin, of, switchMap } from 'rxjs';
import { trigger, transition, style, animate } from '@angular/animations';

import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { BackButtonComponent } from '../../../shared/components/back-button/back-button.component';
import { LineChartComponent, LineChartDataPoint } from '../../../shared/components/charts/line-chart.component';
import { ChartModule } from 'primeng/chart';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { CurrencyPipe } from '../../../shared/pipes/currency.pipe';
import { DateFormatPipe } from '../../../shared/pipes/date-format.pipe';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { SupplierService } from '../../../core/services/supplier.service';
import {
  SupplierStats, SupplierPayment, SupplierPaymentCreate,
  SupplierProductPrice, SupplierPurchaseOrder, ProductPriceHistoryPoint, ProductStockStats
} from '../../../models/supplier.model';

@Component({
  selector: 'app-admin-supplier-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    TagModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    TextareaModule,
    TooltipModule,
    TranslateModule,
    AgroclikPageContainerComponent,
    BackButtonComponent,
    LineChartComponent,
    ChartModule,
    CurrencyPipe,
    DateFormatPipe
  ],
  templateUrl: './admin-supplier-detail.component.html',
  styleUrl: './admin-supplier-detail.component.scss',
  animations: [
    trigger('pageAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class AdminSupplierDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private toast = inject(ToastMessageService);
  private currencyService = inject(CurrencyService);
  private supplierService = inject(SupplierService);
  private fb = inject(FormBuilder);
  private translateService = inject(TranslateService);

  loading = signal(true);
  allSuppliers = signal<{ label: string; value: number }[]>([]);
  stats = signal<SupplierStats | null>(null);
  payments = signal<SupplierPayment[]>([]);
  productPrices = signal<SupplierProductPrice[]>([]);
  purchaseOrders = signal<SupplierPurchaseOrder[]>([]);

  showPaymentDialog = signal(false);
  savingPayment = signal(false);
  deletingPaymentId = signal<number | null>(null);

  activeTab = signal(0);
  selectedPeriod = signal<'3m' | '6m' | '1y' | '5y' | 'all'>('3m');
  selectedProductName = signal<string | null>(null);
  stockTableExpanded = signal(false);
  globalPriceHistory = signal<ProductPriceHistoryPoint[]>([]);
  loadingProductHistory = signal(false);
  stockStats = signal<ProductStockStats | null>(null);
  priceAxisMode = signal<'carton' | 'unit'>('unit');

  currentPkgLabel = computed(() => {
    const st = this.stockStats();
    return st ? (this.packagingLabel(st) || 'Carton') : 'Carton';
  });

  private selectedProductId = computed(() => {
    const name = this.selectedProductName();
    if (!name) return null;
    return this.productPrices().find(p => p.product_name === name)?.product_id ?? null;
  });

  private productId$ = toObservable(this.selectedProductId);

  paymentMethods = [
    { label: 'Espèce', value: 'espece' },
    { label: 'Chèque', value: 'cheque' },
    { label: 'Virement', value: 'virement' }
  ];

  paymentForm = this.fb.group({
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    payment_method: ['espece', Validators.required],
    payment_date: [new Date().toISOString().split('T')[0]],
    notes: ['']
  });

  supplierId = signal<number>(Number(this.route.snapshot.paramMap.get('id')));

  private periodCutoff = computed((): Date | null => {
    const period = this.selectedPeriod();
    if (period === 'all') return null;
    const cutoff = new Date();
    if (period === '3m') cutoff.setMonth(cutoff.getMonth() - 3);
    else if (period === '6m') cutoff.setMonth(cutoff.getMonth() - 6);
    else if (period === '1y') cutoff.setFullYear(cutoff.getFullYear() - 1);
    else if (period === '5y') cutoff.setFullYear(cutoff.getFullYear() - 5);
    return cutoff;
  });

  private filteredOrders = computed(() => {
    const cutoff = this.periodCutoff();
    if (!cutoff) return this.purchaseOrders();
    return this.purchaseOrders().filter(o => new Date(o.created_at) >= cutoff);
  });

  availableProducts = computed(() => {
    const seen = new Map<string, string | undefined>();
    for (const p of this.productPrices()) {
      if (!seen.has(p.product_name)) seen.set(p.product_name, p.product_image ?? undefined);
    }
    return [...seen.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, image]) => ({ label: name, value: name, image }));
  });

  private readonly supplierPalette = [
    '#6366f1', '#22c55e', '#ef4444', '#eab308',
    '#0ea5e9', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6'
  ];

  private supplierColorMap = computed((): Map<string, string> => {
    const names = [...new Set(this.globalPriceHistory().map(p => p.supplier_name))].sort();
    const map = new Map<string, string>();
    names.forEach((name, i) => map.set(name, this.supplierPalette[i % this.supplierPalette.length]));
    return map;
  });

  private sortedGlobalHistory = computed(() =>
    [...this.globalPriceHistory()].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  );

  private globalPricePointColors = computed((): string[] => {
    const colorMap = this.supplierColorMap();
    return this.sortedGlobalHistory().map(p => colorMap.get(p.supplier_name) ?? '#6366f1');
  });

  timelineChartData = computed((): LineChartDataPoint[] =>
    [...this.filteredOrders()]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map(o => ({
        label: new Date(o.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }),
        value: o.total_amount
      }))
  );

  stockTableData = computed(() => {
    const seen = new Map<string, { qty: number; unitsPerCarton: number; packagingType: string | null }>();
    for (const p of this.productPrices()) {
      if (!seen.has(p.product_name)) {
        seen.set(p.product_name, { qty: p.stock_quantity, unitsPerCarton: p.units_per_carton, packagingType: p.packaging_type });
      }
    }
    const items = Array.from(seen.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.qty - a.qty);
    const max = items[0]?.qty || 1;
    return items.map(item => {
      const pct = Math.round((item.qty / max) * 100);
      const color = pct > 60 ? '#22c55e' : pct > 25 ? '#f59e0b' : '#ef4444';
      const cartons = item.unitsPerCarton > 1 ? Math.floor(item.qty / item.unitsPerCarton) : item.qty;
      const pkgLabel = item.packagingType
        ? this.translateService.instant(`products.product.packaging_types.${item.packagingType}`)
        : '';
      return { name: item.name, qty: item.qty, cartons, pkgLabel, unitsPerCarton: item.unitsPerCarton, pct, color };
    });
  });

  dualAxisChartData = computed(() => {
    const history = this.sortedGlobalHistory();
    const st = this.stockStats();
    const upc = this.priceAxisMode() === 'unit' && st && st.units_per_carton > 1 ? st.units_per_carton : 1;
    const colorMap = this.supplierColorMap();
    const toRgba = (hex: string, alpha: number) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    };
    const perPointColors = history.map(p => colorMap.get(p.supplier_name) ?? '#6366f1');

    return {
      labels: history.map(p => [
        new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }),
        p.supplier_name.length > 14 ? p.supplier_name.slice(0, 13) + '…' : p.supplier_name
      ]),
      datasets: [
        {
          type: 'line',
          label: 'Prix',
          data: history.map(p => upc > 1 ? +(p.unit_price / upc).toFixed(2) : p.unit_price),
          yAxisID: 'yPrice',
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34,197,94,0.08)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: perPointColors,
          pointBorderColor: '#ffffff',
          pointHoverBackgroundColor: '#ffffff',
          pointHoverBorderColor: perPointColors,
          pointRadius: 7,
          pointHoverRadius: 9,
          order: 1
        },
        {
          type: 'bar',
          label: 'Quantité',
          data: history.map(p => p.quantity_received),
          yAxisID: 'yQty',
          backgroundColor: perPointColors.map(c => toRgba(c, 0.35)),
          borderColor: perPointColors,
          borderWidth: 1.5,
          borderRadius: 4,
          minBarLength: 4,
          order: 2
        }
      ]
    };
  });

  dualAxisChartOptions = computed(() => {
    const currencyService = this.currencyService;
    const tickColors = this.globalPricePointColors();
    const st = this.stockStats();
    const upc = this.priceAxisMode() === 'unit' && st && st.units_per_carton > 1 ? st.units_per_carton : 1;
    const pkgLabel = st ? (this.packagingLabel(st) || 'carton') : 'carton';
    const priceAxisTitle = upc > 1 ? 'DA/unité' : `DA/${pkgLabel}`;

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          titleFont: { size: 14, weight: 'bold' },
          bodyFont: { size: 13 },
          padding: 12,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            label: (context: { dataset: { yAxisID: string }; raw: number }) => {
              if (context.dataset.yAxisID === 'yPrice') {
                return currencyService.formatCurrency(context.raw);
              }
              return context.raw.toLocaleString() + ' u.';
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
            color: (context: { index: number }) => tickColors[context.index] ?? 'rgba(100,100,100,0.8)'
          }
        },
        yPrice: {
          type: 'linear',
          position: 'left',
          beginAtZero: false,
          grid: { color: 'rgba(0,0,0,0.05)' },
          title: { display: true, text: priceAxisTitle, font: { size: 11 }, color: 'rgba(100,100,100,0.8)' },
          ticks: {
            font: { size: 12 },
            callback: (value: number) => {
              if (value >= 1000000) return (value / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
              if (value >= 1000) return (value / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
              return value.toString();
            }
          }
        },
        yQty: {
          type: 'linear',
          position: 'right',
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'Units (cartons)', font: { size: 11 }, color: 'rgba(100,100,100,0.8)' },
          ticks: {
            font: { size: 12 },
            color: 'rgba(100,100,100,0.8)',
            callback: (value: number) => value % 1 === 0 ? value.toString() : ''
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

  ngOnInit(): void {
    this.supplierService.getSuppliers(false).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(
      suppliers => this.allSuppliers.set(suppliers.map(s => ({ label: s.name, value: s.id })))
    );

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = Number(params.get('id'));
      const productParam = this.route.snapshot.queryParamMap.get('product');
      this.supplierId.set(id);
      this.selectedProductName.set(null);
      this.globalPriceHistory.set([]);
      this.stockStats.set(null);
      this.loadAll(productParam ?? undefined);
    });

    this.productId$.pipe(
      switchMap(productId => {
        if (!productId) {
          this.stockStats.set(null);
          return of({ history: [] as ProductPriceHistoryPoint[], stats: null });
        }
        this.loadingProductHistory.set(true);
        return forkJoin({
          history: this.supplierService.getProductPriceHistory(productId),
          stats: this.supplierService.getProductStockStats(productId)
        });
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: ({ history, stats }) => {
        this.globalPriceHistory.set(history);
        this.stockStats.set(stats);
        this.priceAxisMode.set('unit');
        this.loadingProductHistory.set(false);
      },
      error: () => this.loadingProductHistory.set(false)
    });
  }

  loadAll(selectProduct?: string): void {
    this.loading.set(true);
    const id = this.supplierId();

    forkJoin({
      stats: this.supplierService.getStats(id),
      payments: this.supplierService.getPayments(id),
      productPrices: this.supplierService.getProductPrices(id),
      purchaseOrders: this.supplierService.getPurchaseOrders(id)
    }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ stats, payments, productPrices, purchaseOrders }) => {
          this.stats.set(stats);
          this.payments.set(payments);
          this.productPrices.set(productPrices);
          this.purchaseOrders.set(purchaseOrders);
          this.loading.set(false);
          if (selectProduct) {
            this.activeTab.set(0);
            this.selectedProductName.set(selectProduct);
          }
        },
        error: () => {
          this.toast.showError('admin.suppliers.load_error');
          this.loading.set(false);
        }
      });
  }

  openPaymentDialog(): void {
    this.paymentForm.reset({
      amount: null,
      payment_method: 'espece',
      payment_date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    this.showPaymentDialog.set(true);
  }

  savePayment(): void {
    if (this.paymentForm.invalid) return;
    this.savingPayment.set(true);

    const val = this.paymentForm.value;
    const payload: SupplierPaymentCreate = {
      amount: val.amount!,
      payment_method: val.payment_method as 'espece' | 'cheque' | 'virement',
      payment_date: val.payment_date ? new Date(val.payment_date).toISOString() : undefined,
      notes: val.notes || undefined
    };

    this.supplierService.addPayment(this.supplierId(), payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.showPaymentDialog.set(false);
          this.savingPayment.set(false);
          this.toast.showSuccess('admin.suppliers.payment_added');
          this.loadAll();
        },
        error: () => {
          this.savingPayment.set(false);
          this.toast.showError('admin.suppliers.payment_error');
        }
      });
  }

  deletePayment(paymentId: number): void {
    this.deletingPaymentId.set(paymentId);
    this.supplierService.deletePayment(this.supplierId(), paymentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deletingPaymentId.set(null);
          this.toast.showSuccess('admin.suppliers.payment_deleted');
          this.loadAll();
        },
        error: () => {
          this.deletingPaymentId.set(null);
          this.toast.showError('admin.suppliers.payment_error');
        }
      });
  }

  switchSupplier(id: number): void {
    this.router.navigate([RouteHelpers.adminSupplierDetail(id)]);
  }

  goBack(): void {
    this.router.navigate([ROUTES.ADMIN.SUPPLIERS]);
  }

  editSupplier(): void {
    this.router.navigate([RouteHelpers.adminEditSupplier(this.supplierId())]);
  }

  goToPurchaseOrder(orderId: number): void {
    this.router.navigate([RouteHelpers.adminPurchaseOrderDetail(orderId)]);
  }

  getPaymentMethodLabel(method: string): string {
    return this.paymentMethods.find(m => m.value === method)?.label ?? method;
  }

  getPaymentPercent(s: SupplierStats): number {
    if (!s.total_ordered) return 0;
    return Math.min(100, Math.round((s.total_paid / s.total_ordered) * 100));
  }

  private getOwedPercent(s: SupplierStats): number {
    if (!s.total_ordered) return 0;
    return (s.balance_owed / s.total_ordered) * 100;
  }

  getBalanceTextColor(s: SupplierStats): string {
    if (s.balance_owed === 0) return '#16a34a';
    if (this.getOwedPercent(s) > 50) return '#dc2626';
    return '#ea580c';
  }

  getBalanceLabelColor(s: SupplierStats): string {
    if (s.balance_owed === 0) return '#4ade80';
    if (this.getOwedPercent(s) > 50) return '#f87171';
    return '#fb923c';
  }

  toCartons(units: number, st: { units_per_carton: number }): number {
    return st.units_per_carton > 1 ? Math.floor(units / st.units_per_carton) : units;
  }

  packagingLabel(st: { packaging_type: string | null }): string {
    if (!st.packaging_type) return '';
    return this.translateService.instant(`products.product.packaging_types.${st.packaging_type}`);
  }

  getStatusSeverity(status: string): 'success' | 'warn' | 'info' | 'danger' | 'secondary' {
    switch (status) {
      case 'delivered': return 'success';
      case 'sent': return 'info';
      case 'confirmed': return 'warn';
      case 'cancelled': return 'danger';
      default: return 'secondary';
    }
  }
}
