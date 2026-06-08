import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { trigger, transition, style, animate } from '@angular/animations';

import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';
import { TranslateModule } from '@ngx-translate/core';

import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { BackButtonComponent } from '../../../shared/components/back-button/back-button.component';
import { LineChartComponent, LineChartDataPoint } from '../../../shared/components/charts/line-chart.component';
import { BarChartComponent, BarChartDataPoint } from '../../../shared/components/charts/bar-chart.component';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { CurrencyPipe } from '../../../shared/pipes/currency.pipe';
import { DateFormatPipe } from '../../../shared/pipes/date-format.pipe';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { SupplierService } from '../../../core/services/supplier.service';
import {
  SupplierStats, SupplierPayment, SupplierPaymentCreate,
  SupplierProductPrice, SupplierPurchaseOrder
} from '../../../models/supplier.model';

@Component({
  selector: 'app-admin-supplier-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    TableModule,
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
    BarChartComponent,
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
  private supplierService = inject(SupplierService);
  private fb = inject(FormBuilder);

  loading = signal(true);
  stats = signal<SupplierStats | null>(null);
  payments = signal<SupplierPayment[]>([]);
  productPrices = signal<SupplierProductPrice[]>([]);
  purchaseOrders = signal<SupplierPurchaseOrder[]>([]);

  showPaymentDialog = signal(false);
  savingPayment = signal(false);
  deletingPaymentId = signal<number | null>(null);

  activeTab = signal(0);
  selectedPeriod = signal<'3m' | '6m' | '1y' | '5y' | 'all'>('all');
  selectedProductName = signal<string | null>(null);

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

  supplierId = computed(() => Number(this.route.snapshot.paramMap.get('id')));

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

  private filteredPrices = computed(() => {
    const cutoff = this.periodCutoff();
    if (!cutoff) return this.productPrices();
    return this.productPrices().filter(p => new Date(p.date) >= cutoff);
  });

  private filteredPayments = computed(() => {
    const cutoff = this.periodCutoff();
    if (!cutoff) return this.payments();
    return this.payments().filter(p => new Date(p.payment_date) >= cutoff);
  });

  availableProducts = computed(() =>
    [...new Set(this.productPrices().map(p => p.product_name))]
      .sort()
      .map(n => ({ label: n, value: n }))
  );

  timelineChartData = computed((): LineChartDataPoint[] =>
    [...this.filteredOrders()]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map(o => ({
        label: new Date(o.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }),
        value: o.total_amount
      }))
  );

  topProductsChartData = computed((): BarChartDataPoint[] => {
    const productMap = new Map<string, number>();
    for (const p of this.filteredPrices()) {
      productMap.set(p.product_name, (productMap.get(p.product_name) ?? 0) + p.unit_price * p.quantity_received);
    }
    return Array.from(productMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  });

  paymentTimelineData = computed((): LineChartDataPoint[] =>
    [...this.filteredPayments()]
      .sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime())
      .map(p => ({
        label: new Date(p.payment_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }),
        value: p.amount
      }))
  );

  productPriceHistoryData = computed((): LineChartDataPoint[] => {
    const name = this.selectedProductName();
    if (!name) return [];
    return this.filteredPrices()
      .filter(p => p.product_name === name)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(p => ({
        label: new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }),
        value: p.unit_price
      }));
  });

  productQuantityData = computed((): BarChartDataPoint[] => {
    const name = this.selectedProductName();
    if (!name) return [];
    return this.filteredPrices()
      .filter(p => p.product_name === name)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(p => ({
        label: new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }),
        value: p.quantity_received
      }));
  });

  productOrderCostData = computed((): BarChartDataPoint[] => {
    const name = this.selectedProductName();
    if (!name) return [];
    return this.filteredPrices()
      .filter(p => p.product_name === name)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(p => ({
        label: new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }),
        value: Math.round(p.unit_price * p.quantity_received)
      }));
  });

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
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

  getBalanceColor(s: SupplierStats): string {
    if (s.balance_owed === 0) return '#16a34a';
    if (this.getOwedPercent(s) > 50) return '#dc2626';
    return '#ea580c';
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
