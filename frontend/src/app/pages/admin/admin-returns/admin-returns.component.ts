import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { trigger, transition, style, animate } from '@angular/animations';

import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DatePickerModule } from 'primeng/datepicker';

import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { CurrencyDisplayComponent } from '../../../shared/components/currency-display/currency-display.component';
import { DateFormatPipe } from '../../../shared/pipes/date-format.pipe';
import { TableSearchComponent } from '../../../shared/components/table-search/table-search.component';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { ReturnsService, OrderReturn, ReturnItem } from '../../../core/services/returns.service';
import { PackagingTypeService } from '../../../core/services/packaging-type.service';
import { RouteHelpers, ROUTES } from '../../../core/constants/routes.constants';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-returns',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TagModule,
    TooltipModule,
    DatePickerModule,
    FormsModule,
    AgroclikPageContainerComponent,
    CurrencyDisplayComponent,
    DateFormatPipe,
    TableSearchComponent,
  ],
  templateUrl: './admin-returns.component.html',
  styleUrl: './admin-returns.component.scss',
  animations: [
    trigger('pageAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class AdminReturnsComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private toast = inject(ToastMessageService);
  private returnsService = inject(ReturnsService);
  private packagingTypeService = inject(PackagingTypeService);
  private router = inject(Router);

  readonly ROUTES = ROUTES;

  loading = signal(true);
  returns = signal<OrderReturn[]>([]);

  searchTerm = signal('');
  dateFilter = signal<'today' | 'week' | 'month' | 'custom' | null>(null);
  dateRange = signal<Date[]>([]);

  filteredReturns = computed(() => {
    let result = this.returns();

    const search = this.searchTerm().toLowerCase().trim();
    if (search) {
      result = result.filter(r => r.customer_name?.toLowerCase().includes(search));
    }

    const now = new Date();
    const filter = this.dateFilter();
    if (filter === 'today') {
      result = result.filter(r => new Date(r.created_at).toDateString() === now.toDateString());
    } else if (filter === 'week') {
      const mon = new Date(now);
      mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      mon.setHours(0, 0, 0, 0);
      result = result.filter(r => new Date(r.created_at) >= mon);
    } else if (filter === 'month') {
      result = result.filter(r => {
        const d = new Date(r.created_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
    } else if (filter === 'custom') {
      const range = this.dateRange();
      if (range.length === 2 && range[0] && range[1]) {
        const start = new Date(range[0]); start.setHours(0, 0, 0, 0);
        const end = new Date(range[1]); end.setHours(23, 59, 59, 999);
        result = result.filter(r => {
          const d = new Date(r.created_at);
          return d >= start && d <= end;
        });
      }
    }

    return result;
  });

  totalRefunded = computed(() =>
    this.filteredReturns().reduce((sum, r) => sum + r.refund_amount, 0)
  );

  totalMarginImpact = computed(() =>
    this.filteredReturns().reduce((sum, r) => sum + (r.margin_impact ?? 0), 0)
  );

  ngOnInit(): void {
    this.loadReturns();
  }

  loadReturns(): void {
    this.loading.set(true);
    this.returnsService.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => { this.returns.set(data); this.loading.set(false); },
      error: () => { this.toast.showError('Erreur lors du chargement des retours'); this.loading.set(false); }
    });
  }

  setDateFilter(f: 'today' | 'week' | 'month' | 'custom' | null): void {
    this.dateFilter.set(f);
    if (f !== 'custom') this.dateRange.set([]);
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.dateFilter.set(null);
    this.dateRange.set([]);
  }

  getItemQtyLabel(item: ReturnItem): string {
    const ppb = item.pieces_per_box || 1;
    if (ppb <= 1) return `× ${item.quantity}`;
    const cartons = item.quantity / ppb;
    const label = this.packagingTypeService.getPackagingTypeForCount(item.packaging_type || 'carton', cartons);
    return `× ${cartons} ${label}`;
  }

  openCreatePage(): void {
    this.router.navigate([ROUTES.ADMIN.RETURNS_NEW]);
  }

  goToOrder(orderId: number): void {
    this.router.navigate([RouteHelpers.adminOrderDetail(orderId)]);
  }

}
