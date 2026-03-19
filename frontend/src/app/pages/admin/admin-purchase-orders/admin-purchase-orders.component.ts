import { Component, OnInit, inject, DestroyRef, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConfirmationService } from 'primeng/api';
import { PopoverModule } from 'primeng/popover';
import { DialogModule } from 'primeng/dialog';

import { ADMIN_LIST_IMPORTS, ADMIN_DIALOG_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { TableSkeletonComponent, SkeletonColumn } from '../../../shared/components/table-skeleton/table-skeleton.component';
import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { ConfirmationDialogService } from '../../../core/services/confirmation-dialog.service';
import { BaseAdminListComponent, ColumnOption } from '../../../shared/base/base-admin-list.component';
import { AdminService } from '../../../services/admin.service';
import { PurchaseOrder } from '../../../models/admin.model';

@Component({
  selector: 'app-admin-purchase-orders',
  standalone: true,
  imports: [
    ...ADMIN_LIST_IMPORTS,
    ...ADMIN_DIALOG_IMPORTS,
    PopoverModule,
    DialogModule,
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

  // Computed counts
  draftCount = computed(() => this.allOrders().filter(o => o.status === 'draft').length);
  sentCount = computed(() => this.allOrders().filter(o => o.status === 'sent').length);
  confirmedCount = computed(() => this.allOrders().filter(o => o.status === 'confirmed').length);
  deliveredCount = computed(() => this.allOrders().filter(o => o.status === 'delivered').length);

  // Detail dialog
  showDetailDialog = signal(false);
  selectedOrder = signal<PurchaseOrder | null>(null);

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

  private adminService = inject(AdminService);
  private confirmationService = inject(ConfirmationService);
  private confirmDialog = inject(ConfirmationDialogService);
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading = true;
    this.adminService.getPurchaseOrders()
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
    this.selectedOrder.set(order);
    this.showDetailDialog.set(true);
  }

  closeDetailDialog(): void {
    this.showDetailDialog.set(false);
    this.selectedOrder.set(null);
  }

  updateStatus(order: PurchaseOrder, newStatus: string): void {
    this.adminService.updatePurchaseOrderStatus(order.id, newStatus)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          // Update local state
          this.allOrders.update(orders =>
            orders.map(o => o.id === updated.id ? updated : o)
          );
          this.filterItems();
          this.baseToast.showSuccess(`Statut mis à jour: ${this.getStatusLabel(newStatus)}`);
        },
        error: () => {
          this.baseToast.showError('Erreur lors de la mise à jour du statut');
        }
      });
  }

  confirmDeleteOrder(order: PurchaseOrder): void {
    this.confirmDialog.confirmDelete(
      this.confirmationService,
      order.reference,
      () => this.deleteOrder(order)
    );
  }

  deleteOrder(order: PurchaseOrder): void {
    this.adminService.deletePurchaseOrder(order.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.allOrders.update(orders => orders.filter(o => o.id !== order.id));
          this.filterItems();
          this.baseToast.showSuccess('Commande supprimée');
        },
        error: () => {
          this.baseToast.showError('Erreur lors de la suppression');
        }
      });
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'draft': 'Brouillon',
      'sent': 'Envoyée',
      'confirmed': 'Confirmée',
      'delivered': 'Livrée',
      'cancelled': 'Annulée'
    };
    return labels[status] || status;
  }

  getStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    const severities: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast'> = {
      'draft': 'secondary',
      'sent': 'info',
      'confirmed': 'warn',
      'delivered': 'success',
      'cancelled': 'danger'
    };
    return severities[status] || 'secondary';
  }

  override formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount) + ' DA';
  }
}
