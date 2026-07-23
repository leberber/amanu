import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { trigger, transition, style, animate } from '@angular/animations';

import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { CurrencyDisplayComponent } from '../../../shared/components/currency-display/currency-display.component';
import { DateFormatPipe } from '../../../shared/pipes/date-format.pipe';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { ReturnsService, OrderReturn } from '../../../core/services/returns.service';
import { RouteHelpers, ROUTES } from '../../../core/constants/routes.constants';
import { Router } from '@angular/router';

type StatusFilter = 'all' | 'pending' | 'approved' | 'received' | 'rejected';

@Component({
  selector: 'app-admin-returns',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TagModule,
    TooltipModule,
    AgroclikPageContainerComponent,
    CurrencyDisplayComponent,
    DateFormatPipe,
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
  private router = inject(Router);

  readonly ROUTES = ROUTES;

  loading = signal(true);
  returns = signal<OrderReturn[]>([]);
  statusFilter = signal<StatusFilter>('all');

  // Action loading
  actionLoadingId = signal<number | null>(null);

  filteredReturns = computed(() => {
    const filter = this.statusFilter();
    const all = this.returns();
    if (filter === 'all') return all;
    return all.filter(r => r.status === filter);
  });

  statusTabs: { label: string; value: StatusFilter }[] = [
    { label: 'Tous', value: 'all' },
    { label: 'En attente', value: 'pending' },
    { label: 'Approuvés', value: 'approved' },
    { label: 'Reçus', value: 'received' },
    { label: 'Rejetés', value: 'rejected' },
  ];

  statusCounts = computed(() => {
    const counts: Record<string, number> = {};
    for (const r of this.returns()) {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    }
    return counts;
  });

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

  openCreatePage(): void {
    this.router.navigate([ROUTES.ADMIN.RETURNS_NEW]);
  }

  approve(ret: OrderReturn): void {
    this.actionLoadingId.set(ret.id);
    this.returnsService.approve(ret.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => { this.updateReturn(updated); this.actionLoadingId.set(null); this.toast.showSuccess('Retour approuvé'); },
      error: () => { this.actionLoadingId.set(null); this.toast.showError('Erreur'); }
    });
  }

  receive(ret: OrderReturn): void {
    this.actionLoadingId.set(ret.id);
    this.returnsService.receive(ret.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => { this.updateReturn(updated); this.actionLoadingId.set(null); this.toast.showSuccess('Retour reçu — remboursement et stock mis à jour'); },
      error: () => { this.actionLoadingId.set(null); this.toast.showError('Erreur'); }
    });
  }

  reject(ret: OrderReturn): void {
    this.actionLoadingId.set(ret.id);
    this.returnsService.reject(ret.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => { this.updateReturn(updated); this.actionLoadingId.set(null); this.toast.showSuccess('Retour rejeté'); },
      error: () => { this.actionLoadingId.set(null); this.toast.showError('Erreur'); }
    });
  }

  goToOrder(orderId: number): void {
    this.router.navigate([RouteHelpers.adminOrderDetail(orderId)]);
  }

  getStatusSeverity(status: string): 'warn' | 'info' | 'success' | 'danger' | 'secondary' {
    switch (status) {
      case 'pending': return 'warn';
      case 'approved': return 'info';
      case 'received': return 'success';
      case 'rejected': return 'danger';
      default: return 'secondary';
    }
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'En attente',
      approved: 'Approuvé',
      received: 'Reçu',
      rejected: 'Rejeté',
    };
    return labels[status] ?? status;
  }

  private updateReturn(updated: OrderReturn): void {
    this.returns.update(list => list.map(r => r.id === updated.id ? updated : r));
  }
}
