import { Component, inject, signal, computed, DestroyRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { trigger, transition, style, animate } from '@angular/animations';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';

import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DatePickerModule } from 'primeng/datepicker';
import { TooltipModule } from 'primeng/tooltip';

import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { CurrencyDisplayComponent } from '../../../shared/components/currency-display/currency-display.component';
import { DateFormatPipe } from '../../../shared/pipes/date-format.pipe';
import { RouteHelpers } from '../../../core/constants/routes.constants';
import { environment } from '../../../../environments/environment';

export interface DailyOrderRow {
  order_id: number;
  customer_name: string;
  total: number;
  total_paid: number;
  payment_status: string;
  delivered_at: string;
  margin?: number | null;
  margin_pct?: number | null;
}

export interface DailyPurchaseRow {
  id: number;
  reference: string;
  supplier_name: string;
  total_amount: number;
}

export interface DailyReturnRow {
  id: number;
  order_id: number;
  customer_name?: string;
  refund_amount: number;
  reason?: string;
  created_at: string;
}

export interface StaffPaymentRow {
  staff_name: string;
  total: number;
  by_method: Record<string, number>;
}

export interface DailyReport {
  date: string;
  deliveries_count: number;
  deliveries_total: number;
  deliveries_outstanding: number;
  orders: DailyOrderRow[];
  payments_total: number;
  payments_by_method: Record<string, number>;
  payments_by_staff: StaffPaymentRow[];
  purchases_count: number;
  purchases_total: number;
  purchases: DailyPurchaseRow[];
  returns_count: number;
  returns_total: number;
  returns: DailyReturnRow[];
  net: number;
  margin_total?: number | null;
  margin_pct?: number | null;
}

@Component({
  selector: 'app-admin-daily-report',
  standalone: true,
  imports: [
    FormsModule,
    DecimalPipe,
    ButtonModule,
    TagModule,
    DatePickerModule,
    TooltipModule,
    AgroclikPageContainerComponent,
    CurrencyDisplayComponent,
    DateFormatPipe,
  ],
  templateUrl: './admin-daily-report.component.html',
  styleUrl: './admin-daily-report.component.scss',
  animations: [
    trigger('pageAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class AdminDailyReportComponent {
  private http = inject(HttpClient);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  loading = signal(true);
  report = signal<DailyReport | null>(null);
  selectedDate = signal<Date>(new Date());
  activeTab = signal(0);

  formattedDate = computed(() => {
    const d = this.selectedDate();
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  });

  collectionRate = computed(() => {
    const r = this.report();
    if (!r || r.deliveries_total === 0) return 0;
    return Math.min(100, Math.round((r.payments_total / r.deliveries_total) * 100));
  });

  methodEntries = computed(() => {
    const r = this.report();
    if (!r) return [];
    const total = r.payments_total || 1;
    return Object.entries(r.payments_by_method).map(([method, amount]) => ({
      method,
      label: this.methodLabel(method),
      amount,
      pct: Math.round((amount / total) * 100),
    })).sort((a, b) => b.amount - a.amount);
  });

  constructor() {
    this.load();
  }

  load(): void {
    const d = this.selectedDate();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    this.loading.set(true);
    this.http.get<DailyReport>(`${environment.apiUrl}/admin/daily-report?date=${dateStr}`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => { this.report.set(data); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
  }

  onDateChange(date: Date): void {
    if (!date) return;
    this.selectedDate.set(date);
    this.load();
  }

  goToOrder(id: number): void {
    this.router.navigate([RouteHelpers.adminOrderDetail(id)]);
  }

  goToPurchaseOrder(id: number): void {
    this.router.navigate([RouteHelpers.adminPurchaseOrderDetail(id)]);
  }

  methodLabel(method: string): string {
    const m: Record<string, string> = { cash: 'Espèces', virement: 'Virement', cheque: 'Chèque' };
    return m[method] ?? method;
  }

  methodColor(method: string): string {
    const m: Record<string, string> = { cash: '#16a34a', virement: '#2563eb', cheque: '#d97706' };
    return m[method] ?? '#6b7280';
  }

  paymentSeverity(status: string): 'success' | 'warn' | 'danger' {
    if (status === 'paid') return 'success';
    if (status === 'partial') return 'warn';
    return 'danger';
  }

  paymentLabel(status: string): string {
    if (status === 'paid') return 'Payé';
    if (status === 'partial') return 'Partiel';
    return 'Impayé';
  }

  isToday(): boolean {
    const d = this.selectedDate();
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }

  goToToday(): void {
    this.selectedDate.set(new Date());
    this.load();
  }

  prevDay(): void {
    const d = new Date(this.selectedDate());
    d.setDate(d.getDate() - 1);
    this.selectedDate.set(d);
    this.load();
  }

  nextDay(): void {
    const d = new Date(this.selectedDate());
    d.setDate(d.getDate() + 1);
    this.selectedDate.set(d);
    this.load();
  }
}
