import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { trigger, transition, style, animate } from '@angular/animations';

import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';

import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { CurrencyDisplayComponent } from '../../../shared/components/currency-display/currency-display.component';
import { DateFormatPipe } from '../../../shared/pipes/date-format.pipe';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { AdminService } from '../../../services/admin.service';
import { ReturnsService, OrderReturn, OrderReturnCreate } from '../../../core/services/returns.service';
import { Order, OrderItem } from '../../../models/admin.model';
import { RouteHelpers } from '../../../core/constants/routes.constants';
import { Router } from '@angular/router';

type StatusFilter = 'all' | 'pending' | 'approved' | 'received' | 'rejected';

interface ReturnItemDraft {
  orderItem: OrderItem;
  selected: boolean;
  quantity: number;
}

@Component({
  selector: 'app-admin-returns',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TagModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    TextareaModule,
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
  private adminService = inject(AdminService);
  private router = inject(Router);

  loading = signal(true);
  returns = signal<OrderReturn[]>([]);
  statusFilter = signal<StatusFilter>('all');

  // Create dialog
  showCreateDialog = signal(false);
  createOrderId = signal('');
  loadingOrder = signal(false);
  loadedOrder = signal<Order | null>(null);
  itemDrafts = signal<ReturnItemDraft[]>([]);
  createReason = signal('');
  createNotes = signal('');
  saving = signal(false);

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

  hasSelectedItems = computed(() => this.itemDrafts().some(d => d.selected && d.quantity > 0));

  selectedRefundTotal = computed(() =>
    this.itemDrafts()
      .filter(d => d.selected && d.quantity > 0)
      .reduce((sum, d) => sum + d.quantity * d.orderItem.unit_price, 0)
  );

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

  openCreateDialog(): void {
    this.createOrderId.set('');
    this.loadedOrder.set(null);
    this.itemDrafts.set([]);
    this.createReason.set('');
    this.createNotes.set('');
    this.showCreateDialog.set(true);
  }

  fetchOrder(): void {
    const id = Number(this.createOrderId());
    if (!id) return;
    this.loadingOrder.set(true);
    this.loadedOrder.set(null);
    this.itemDrafts.set([]);
    this.adminService.getOrderById(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (order) => {
        this.loadedOrder.set(order);
        this.itemDrafts.set((order.items ?? []).map(item => ({
          orderItem: item,
          selected: false,
          quantity: item.quantity,
        })));
        this.loadingOrder.set(false);
      },
      error: () => {
        this.toast.showError('Commande introuvable');
        this.loadingOrder.set(false);
      }
    });
  }

  submitCreate(): void {
    const order = this.loadedOrder();
    if (!order) return;
    const selectedItems = this.itemDrafts().filter(d => d.selected && d.quantity > 0);
    if (selectedItems.length === 0) return;

    const payload: OrderReturnCreate = {
      order_id: order.id,
      reason: this.createReason() || undefined,
      notes: this.createNotes() || undefined,
      items: selectedItems.map(d => ({ order_item_id: d.orderItem.id, quantity: d.quantity })),
    };

    this.saving.set(true);
    this.returnsService.create(payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (created) => {
        this.returns.update(list => [created, ...list]);
        this.showCreateDialog.set(false);
        this.saving.set(false);
        this.toast.showSuccess('Retour créé');
      },
      error: () => { this.toast.showError('Erreur lors de la création'); this.saving.set(false); }
    });
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

  toggleItem(index: number): void {
    this.itemDrafts.update(drafts => {
      const updated = [...drafts];
      updated[index] = { ...updated[index], selected: !updated[index].selected };
      return updated;
    });
  }

  setQuantity(index: number, qty: number): void {
    this.itemDrafts.update(drafts => {
      const updated = [...drafts];
      updated[index] = { ...updated[index], quantity: qty };
      return updated;
    });
  }

  private updateReturn(updated: OrderReturn): void {
    this.returns.update(list => list.map(r => r.id === updated.id ? updated : r));
  }
}
