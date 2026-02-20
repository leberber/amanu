// src/app/pages/admin/admin-orders/admin-orders.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { PaginatorModule } from 'primeng/paginator';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { TooltipModule } from 'primeng/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AdminService } from '../../../services/admin.service';
import { Order } from '../../../models/admin.model';
import { ProductService } from '../../../services/product.service';
import { DateService } from '../../../core/services/date.service';
import { TranslationHelperService } from '../../../core/services/translation-helper.service';
import { SearchDebounceService } from '../../../core/services/search-debounce.service';
import { UnitsService } from '../../../core/services/units.service';
import { StatusSeverityService } from '../../../core/services/status-severity.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { CurrencyPipe } from '../../../shared/pipes/currency.pipe';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    ToastModule,
    TagModule,
    PaginatorModule,
    DialogModule,
    ConfirmDialogModule,
    TooltipModule,
    TranslateModule,
    CurrencyPipe
  ],
  providers: [ConfirmationService],
  templateUrl: './admin-orders.component.html',
  styleUrl: './admin-orders.component.scss'
})
export class AdminOrdersComponent implements OnInit {
  allOrders: Order[] = [];
  orders: Order[] = [];
  paginatedOrders: Order[] = [];
  users: any[] = [];
  products: any[] = [];
  loading = true;
  searchQuery = '';

  // Pagination
  first = 0;
  rows = 10;

  // Status filter
  statusFilter: 'all' | 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' = 'all';

  selectedOrder: Order | null = null;
  displayOrderDialog = false;

  // Inline status editing
  editingStatusOrderId: number | null = null;

  // Services
  private adminService = inject(AdminService);
  private toast = inject(ToastMessageService);
  private confirmationService = inject(ConfirmationService);
  private router = inject(Router);
  private translateService = inject(TranslateService);
  private productService = inject(ProductService);
  private dateService = inject(DateService);
  private translationHelper = inject(TranslationHelperService);
  private unitsService = inject(UnitsService);
  private searchDebounce = inject(SearchDebounceService);
  private statusSeverity = inject(StatusSeverityService);

  ngOnInit() {
    this.loadUsersAndOrders();
    this.loadProducts();

    this.translateService.onLangChange.subscribe(() => {
      // Re-filter to update any translated content
      this.filterOrders();
    });
  }

  loadProducts() {
    this.productService.getProducts().subscribe({
      next: (products) => {
        this.products = products || [];
      },
      error: (error) => {
        console.error('Error loading products:', error);
      }
    });
  }

  loadUsersAndOrders() {
    this.loading = true;

    this.adminService.getAllUsers().subscribe({
      next: (usersResponse) => {
        this.users = Array.isArray(usersResponse) ? usersResponse : usersResponse.users;
        this.loadAllOrders();
      },
      error: (error) => {
        console.error('Error loading users:', error);
        this.users = [];
        this.loadAllOrders();
      }
    });
  }

  getUserById(userId: number) {
    return this.users.find(user => user.id === userId);
  }

  hasActiveFilters(): boolean {
    return !!(this.searchQuery?.trim() || this.statusFilter !== 'all');
  }

  // Status filter methods
  onStatusFilterChange(status: 'all' | 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled') {
    this.statusFilter = status;
    this.first = 0;
    this.filterOrders();
  }

  getPendingCount(): number {
    return this.allOrders.filter(o => o.status === 'pending').length;
  }

  getConfirmedCount(): number {
    return this.allOrders.filter(o => o.status === 'confirmed').length;
  }

  getShippedCount(): number {
    return this.allOrders.filter(o => o.status === 'shipped').length;
  }

  getDeliveredCount(): number {
    return this.allOrders.filter(o => o.status === 'delivered').length;
  }

  getCancelledCount(): number {
    return this.allOrders.filter(o => o.status === 'cancelled').length;
  }

  // Pagination methods
  onPageChange(event: any) {
    this.first = event.first;
    this.rows = event.rows;
    this.updatePaginatedOrders();
  }

  updatePaginatedOrders() {
    this.paginatedOrders = this.orders.slice(this.first, this.first + this.rows);
  }

  loadAllOrders() {
    this.adminService.getAllOrders('', 1, 1000).subscribe({
      next: (response) => {
        if (response && response.orders) {
          this.allOrders = response.orders;
          this.orders = response.orders;
          this.updatePaginatedOrders();
        } else {
          this.allOrders = [];
          this.orders = [];
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading orders:', error);
        this.loading = false;

        if (error.status === 403) {
          this.toast.showPermissionDenied();
          this.router.navigate(['/']);
        } else {
          this.toast.showError('admin.orders.load_error');
        }

        this.allOrders = [];
        this.orders = [];
      }
    });
  }

  filterOrders() {
    let filtered = [...this.allOrders];

    // Status filter
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === this.statusFilter);
    }

    // Search filter
    if (this.searchQuery?.trim()) {
      const search = this.searchQuery.toLowerCase();
      filtered = filtered.filter(order =>
        order.id.toString().includes(search) ||
        order.user?.full_name?.toLowerCase().includes(search) ||
        order.user?.email?.toLowerCase().includes(search) ||
        order.status.toLowerCase().includes(search) ||
        order.total_amount.toString().includes(search) ||
        order.contact_phone?.toLowerCase().includes(search)
      );
    }

    this.orders = filtered;
    this.first = 0;
    this.updatePaginatedOrders();
  }

  onSearchInput() {
    this.searchDebounce.debounce('orders-search', () => {
      this.filterOrders();
    });
  }

  clearFilters() {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.first = 0;
    this.filterOrders();
  }

  refreshOrderData() {
    this.loadAllOrders();
  }

  exportOrders() {
    this.toast.showInfo('admin.orders.export_coming_soon');
  }

  openOrderDetails(order: Order) {
    this.selectedOrder = order;
    this.displayOrderDialog = true;
  }

  getStatusSeverity(status: string): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" {
    return this.statusSeverity.getOrderStatusSeverity(status);
  }

  getStatusIcon(status: string): string {
    return this.statusSeverity.getOrderStatusIcon(status);
  }

  formatDate(dateString: string): string {
    return this.dateService.formatDate(dateString);
  }

  getProductName(item: any): string {
    if (item.name_translations || item.name) {
      return this.translationHelper.getProductName(item);
    }

    if (item.product_id && this.products.length > 0) {
      const fullProduct = this.products.find(p => p.id === item.product_id);
      if (fullProduct) {
        return this.translationHelper.getProductName(fullProduct);
      }
    }

    return item.product_name || item.name;
  }

  getUnitDisplay(unit: string): string {
    return this.unitsService.getUnitTranslated(unit, true);
  }

  updateOrderStatus(orderId: number, newStatus: string) {
    const statusText = this.translateService.instant('admin.orders.status.' + newStatus);
    const message = this.translateService.instant('admin.orders.confirm_status_update', { status: statusText });

    this.confirmationService.confirm({
      message: message,
      header: this.translateService.instant('common.warning'),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-warning',
      rejectButtonStyleClass: 'p-button-text',
      acceptLabel: this.translateService.instant('common.proceed'),
      rejectLabel: this.translateService.instant('common.cancel'),
      accept: () => {
        this.adminService.updateOrderStatus(orderId, newStatus).subscribe({
          next: (updatedOrder) => {
            const allIndex = this.allOrders.findIndex(o => o.id === orderId);
            if (allIndex !== -1) {
              this.allOrders[allIndex] = updatedOrder;
            }

            this.filterOrders();

            this.toast.showSuccess('admin.orders.status_update_message', {
              orderId: orderId,
              status: this.translateService.instant('admin.orders.status.' + newStatus)
            });

            if (this.selectedOrder && this.selectedOrder.id === orderId) {
              this.selectedOrder = updatedOrder;
            }
          },
          error: (error) => {
            console.error('Error updating order status:', error);
            this.toast.showApiError(error, 'admin.orders.update_error');
          }
        });
      }
    });
  }

  // ===== INLINE STATUS EDITING =====

  startEditStatus(order: Order): void {
    // Only allow editing if there are next statuses available
    if (this.getNextStatuses(order.status).length > 0) {
      this.editingStatusOrderId = order.id;
    }
  }

  cancelEditStatus(): void {
    this.editingStatusOrderId = null;
  }

  isEditingStatus(orderId: number): boolean {
    return this.editingStatusOrderId === orderId;
  }

  getNextStatuses(currentStatus: string): { value: string; label: string; icon: string }[] {
    // Allow skipping steps - show all forward statuses
    const statusTransitions: Record<string, string[]> = {
      'pending': ['confirmed', 'shipped', 'delivered', 'cancelled'],
      'confirmed': ['shipped', 'delivered', 'cancelled'],
      'shipped': ['delivered', 'cancelled'],
      'delivered': [],
      'cancelled': []
    };

    const nextStatuses = statusTransitions[currentStatus] || [];

    return nextStatuses.map(status => ({
      value: status,
      label: this.translateService.instant('admin.orders.status.' + status),
      icon: this.getStatusIcon(status)
    }));
  }

  selectNewStatus(orderId: number, newStatus: string): void {
    this.cancelEditStatus();
    this.updateOrderStatus(orderId, newStatus);
  }

  canEditStatus(status: string): boolean {
    return this.getNextStatuses(status).length > 0;
  }
}
