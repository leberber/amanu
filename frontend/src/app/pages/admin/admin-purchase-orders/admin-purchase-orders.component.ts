import { Component, OnInit, inject, DestroyRef, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConfirmationService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';

import { ADMIN_LIST_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { TableSkeletonComponent, SkeletonColumn } from '../../../shared/components/table-skeleton/table-skeleton.component';
import { InfiniteScrollDirective } from '../../../shared/directives/infinite-scroll.directive';
import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { ConfirmationDialogService } from '../../../core/services/confirmation-dialog.service';
import { BaseAdminListComponent, ColumnOption } from '../../../shared/base/base-admin-list.component';
import { RouteHelpers } from '../../../core/constants/routes.constants';
import {
  PurchaseOrderService,
  PurchaseOrder,
  PurchaseOrderStatus
} from '../../../services/purchase-order.service';
import { PurchasingCartService } from '../../../services/purchasing-cart.service';
import { PurchasingPdfService } from '../../../services/purchasing-pdf.service';

@Component({
  selector: 'app-admin-purchase-orders',
  standalone: true,
  imports: [
    ...ADMIN_LIST_IMPORTS,
    TableSkeletonComponent,
    InfiniteScrollDirective,
    AgroclikPageContainerComponent
  ],
  providers: [ConfirmationService],
  templateUrl: './admin-purchase-orders.component.html',
  styleUrl: './admin-purchase-orders.component.scss'
})
export class AdminPurchaseOrdersComponent extends BaseAdminListComponent implements OnInit {
  private readonly BATCH_SIZE = 20;

  // Data signals
  allOrders = signal<PurchaseOrder[]>([]);
  orders = signal<PurchaseOrder[]>([]);
  displayedOrders = signal<PurchaseOrder[]>([]);

  hasMore = computed(() => this.displayedOrders().length < this.orders().length);

  // Sort state
  sortField = signal<string>('date');
  sortDirection = signal<'asc' | 'desc'>('desc');

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
  private cartService = inject(PurchasingCartService);
  private pdfService = inject(PurchasingPdfService);
  private confirmationService = inject(ConfirmationService);
  private confirmDialog = inject(ConfirmationDialogService);
  private destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);

  ngOnInit() {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading = true;
    this.orderService.getOrders({ limit: 10000 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.allOrders.set(response.orders);
          this.orders.set(response.orders);
          this.displayedOrders.set(response.orders.slice(0, this.BATCH_SIZE));
          this.loading = false;
          this.markTableInitialized();
        },
        error: () => {
          this.allOrders.set([]);
          this.orders.set([]);
          this.displayedOrders.set([]);
          this.loading = false;
          this.baseToast.showError(this.translate.instant('admin.purchase_orders.load_error'));
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

    const sorted = this.applySorting(filtered);
    this.orders.set(sorted);
    this.displayedOrders.set(sorted.slice(0, this.BATCH_SIZE));
  }

  sortBy(field: string): void {
    if (this.sortField() === field) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
    this.filterItems();
  }

  private applySorting(orders: PurchaseOrder[]): PurchaseOrder[] {
    const field = this.sortField();
    if (!field) return orders;
    const dir = this.sortDirection() === 'asc' ? 1 : -1;
    return [...orders].sort((a, b) => {
      let aVal: string | number, bVal: string | number;
      switch (field) {
        case 'reference': aVal = a.reference; bVal = b.reference; break;
        case 'supplier': aVal = a.supplier_name; bVal = b.supplier_name; break;
        case 'status': aVal = a.status; bVal = b.status; break;
        case 'total': aVal = a.total_amount; bVal = b.total_amount; break;
        case 'items': aVal = a.item_count; bVal = b.item_count; break;
        case 'date': aVal = new Date(a.created_at).getTime(); bVal = new Date(b.created_at).getTime(); break;
        default: return 0;
      }
      if (aVal < bVal) return -1 * dir;
      if (aVal > bVal) return 1 * dir;
      return 0;
    });
  }

  loadMoreOrders(): void {
    if (!this.hasMore()) return;
    const current = this.displayedOrders().length;
    this.displayedOrders.update(list => [
      ...list,
      ...this.orders().slice(current, current + this.BATCH_SIZE)
    ]);
  }

  updatePaginatedItems(): void {
    // Not used - using client-side infinite scroll
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

  editDraft(order: PurchaseOrder): void {
    if (order.status === 'draft') {
      this.cartService.navigateToEditDraft(order.id);
    }
  }

  isDraft(order: PurchaseOrder): boolean {
    return order.status === 'draft';
  }

  confirmDeleteOrder(order: PurchaseOrder): void {
    if (!this.orderService.canDelete(order)) {
      this.baseToast.showError(this.translate.instant('admin.purchase_orders.only_drafts_deletable'));
      return;
    }
    this.confirmDialog.confirmDelete(
      this.confirmationService,
      order.reference,
      () => this.deleteOrder(order)
    );
  }

  deleteOrder(order: PurchaseOrder): void {
    this.orderService.deleteOrder(order.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.baseToast.showSuccess(this.translate.instant('admin.purchase_orders.delete_success'));
          this.loadOrders();
        },
        error: () => {
          this.baseToast.showError(this.translate.instant('admin.purchase_orders.delete_error'));
        }
      });
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

  downloadPdf(order: PurchaseOrder, event: Event): void {
    event.stopPropagation();
    // Fetch full order with items if not loaded
    if (!order.items || order.items.length === 0) {
      this.orderService.getOrder(order.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (fullOrder) => {
            this.pdfService.generatePurchaseOrderPdf(fullOrder, true);
          },
          error: () => {
            this.baseToast.showError('Erreur lors du chargement de la commande');
          }
        });
    } else {
      this.pdfService.generatePurchaseOrderPdf(order, true);
    }
  }
}
