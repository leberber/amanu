import { Component, OnInit, inject, DestroyRef, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConfirmationService } from 'primeng/api';

import { ADMIN_LIST_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { TableSkeletonComponent, SkeletonColumn } from '../../../shared/components/table-skeleton/table-skeleton.component';
import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { ConfirmationDialogService } from '../../../core/services/confirmation-dialog.service';
import { BaseAdminListComponent, ColumnOption } from '../../../shared/base/base-admin-list.component';
import { RouteHelpers } from '../../../core/constants/routes.constants';
import {
  PurchaseOrderService,
  PurchaseOrder,
  PurchaseOrderStatus
} from '../../../services/purchase-order.service';

@Component({
  selector: 'app-admin-purchase-orders',
  standalone: true,
  imports: [
    ...ADMIN_LIST_IMPORTS,
    TableSkeletonComponent,
    AgroclikPageContainerComponent
  ],
  providers: [ConfirmationService],
  templateUrl: './admin-purchase-orders.component.html',
  styleUrl: './admin-purchase-orders.component.scss'
})
export class AdminPurchaseOrdersComponent extends BaseAdminListComponent implements OnInit {
  // Data signals
  allOrders = signal<PurchaseOrder[]>([]);
  orders = signal<PurchaseOrder[]>([]);
  paginatedOrders = signal<PurchaseOrder[]>([]);

  // Computed counts - single pass through orders
  private statusCounts = computed(() => {
    const counts = { draft: 0, sent: 0, delivered: 0 };
    for (const order of this.allOrders()) {
      if (order.status in counts) {
        counts[order.status as keyof typeof counts]++;
      }
    }
    return counts;
  });

  draftCount = computed(() => this.statusCounts().draft);
  sentCount = computed(() => this.statusCounts().sent);
  deliveredCount = computed(() => this.statusCounts().delivered);

  // Skeleton configuration
  skeletonColumns: SkeletonColumn[] = [
    { width: '12%', type: 'text', headerWidth: '80px' },
    { width: '20%', type: 'text', headerWidth: '100px' },
    { width: '12%', type: 'pill', headerWidth: '60px' },
    { width: '15%', type: 'text', headerWidth: '80px' },
    { width: '12%', type: 'text', headerWidth: '80px' },
    { width: '12%', type: 'text', headerWidth: '60px' },
    { width: '17%', type: 'actions', headerWidth: '60px' }
  ];

  // Column visibility options
  override columnOptions: ColumnOption[] = [
    { field: 'reference', label: 'Référence', visible: true },
    { field: 'supplier', label: 'Fournisseur', visible: true },
    { field: 'status', label: 'Statut', visible: true },
    { field: 'total', label: 'Total', visible: true },
    { field: 'items', label: 'Produits', visible: true },
    { field: 'date', label: 'Date', visible: true },
    { field: 'actions', label: 'Actions', visible: true }
  ];

  private router = inject(Router);
  private orderService = inject(PurchaseOrderService);
  private confirmationService = inject(ConfirmationService);
  private confirmDialog = inject(ConfirmationDialogService);
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading = true;
    this.orderService.getOrders()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.allOrders.set(response.orders);
          this.orders.set(response.orders);
          this.updatePaginatedItems();
          this.loading = false;
          this.markTableInitialized();
        },
        error: () => {
          this.allOrders.set([]);
          this.orders.set([]);
          this.loading = false;
          this.baseToast.showError('Erreur lors du chargement des commandes');
        }
      });
  }

  hasActiveFilters(): boolean {
    return !!(this.searchQuery?.trim()) || this.statusFilter !== 'all';
  }

  filterItems(): void {
    let filtered = this.allOrders();

    // Apply status filter
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(o => o.status === this.statusFilter);
    }

    // Apply search filter
    if (this.hasSearchQuery()) {
      const search = this.searchQuery.toLowerCase();
      filtered = filtered.filter(order =>
        order.reference.toLowerCase().includes(search) ||
        order.supplier_name.toLowerCase().includes(search)
      );
    }

    this.orders.set(filtered);
    this.resetPagination();
    this.updatePaginatedItems();
  }

  updatePaginatedItems(): void {
    this.paginatedOrders.set(this.orders().slice(this.first, this.first + this.rows));
  }

  getSearchDebounceKey(): string {
    return 'purchase-orders-search';
  }

  override clearFilters() {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.filterItems();
  }

  viewOrder(order: PurchaseOrder): void {
    this.router.navigate([RouteHelpers.adminPurchaseOrderDetail(order.id)]);
  }

  confirmDeleteOrder(order: PurchaseOrder): void {
    if (!this.orderService.canDelete(order)) {
      this.baseToast.showError('Seuls les brouillons peuvent être supprimés');
      return;
    }
    this.confirmDialog.confirmDelete(
      this.confirmationService,
      order.reference,
      () => this.deleteOrder(order)
    );
  }

  deleteOrder(order: PurchaseOrder): void {
    this.handleDeleteWithSignal(
      () => this.orderService.deleteOrder(order.id),
      this.allOrders,
      order.id,
      'Commande supprimée',
      'Erreur lors de la suppression'
    );
  }

  getStatusLabel(status: PurchaseOrderStatus): string {
    return this.orderService.getStatusLabel(status);
  }

  getStatusSeverity(status: PurchaseOrderStatus): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    return this.orderService.getStatusSeverity(status);
  }

  canDelete(order: PurchaseOrder): boolean {
    return this.orderService.canDelete(order);
  }
}
