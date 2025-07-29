// src/app/pages/admin/admin-orders/admin-orders.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TagModule } from 'primeng/tag';
import { PaginatorModule } from 'primeng/paginator';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AdminService } from '../../../services/admin.service';
import { Order } from '../../../models/admin.model';
import { ProductService } from '../../../services/product.service';
import { DateService } from '../../../core/services/date.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { TranslationHelperService } from '../../../core/services/translation-helper.service';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SelectModule,
    TableModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    ToastModule,
    TagModule,
    PaginatorModule,
    DialogModule,
    ConfirmDialogModule,
    IconFieldModule,
    InputIconModule,
    TooltipModule,
    ProgressSpinnerModule,
    TranslateModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './admin-orders.component.html',
  styleUrl: './admin-orders.component.scss',
  styles: [`
    :host ::ng-deep .p-datatable-header {
      padding-left: 0 !important;
      padding-right: 0 !important;
    }
  `]
})
export class AdminOrdersComponent implements OnInit {
  allOrders: Order[] = []; // Store all orders loaded once
  orders: Order[] = [];    // Filtered orders to display
  users: any[] = [];       // Store users for lookup
  products: any[] = [];    // Store products for translation lookup
  totalRecords = 0;
  loading = true;
  searchQuery = '';
  filterStatus = '';
  page = 1;
  pageSize = 10;

  private searchTimeout: any;
  
  statusOptions: any[] = [];
  
  selectedOrder: Order | null = null;
  displayOrderDialog = false;
  
  // Services injected using inject()
  private adminService = inject(AdminService);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private router = inject(Router);
  private translateService = inject(TranslateService);
  private productService = inject(ProductService);
  private dateService = inject(DateService);
  private currencyService = inject(CurrencyService);
  private translationHelper = inject(TranslationHelperService);

  ngOnInit() {
    this.initializeStatusOptions();
    this.loadUsersAndOrders();
    this.loadProducts();
    
    // Update status options when language changes
    this.translateService.onLangChange.subscribe(() => {
      this.initializeStatusOptions();
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
  
  initializeStatusOptions() {
    this.statusOptions = [
      { label: this.translateService.instant('admin.orders.filters.all'), value: '' },
      { label: this.translateService.instant('admin.orders.status.pending'), value: 'pending' },
      { label: this.translateService.instant('admin.orders.status.confirmed'), value: 'confirmed' },
      { label: this.translateService.instant('admin.orders.status.shipped'), value: 'shipped' },
      { label: this.translateService.instant('admin.orders.status.delivered'), value: 'delivered' },
      { label: this.translateService.instant('admin.orders.status.cancelled'), value: 'cancelled' }
    ];
  }

  // Load both users and orders, then match them
  loadUsersAndOrders() {
    this.loading = true;
    
    // First try to load users (only admins have access)
    this.adminService.getAllUsers().subscribe({
      next: (usersResponse) => {
        this.users = Array.isArray(usersResponse) ? usersResponse : usersResponse.users;
        // Load orders after users
        this.loadAllOrders();
      },
      error: (error) => {
        console.error('Error loading users (this is normal for staff users):', error);
        // Still load orders even if users can't be loaded
        this.users = [];
        this.loadAllOrders();
      }
    });
  }

  // Get user by ID from loaded users
  getUserById(userId: number) {
    return this.users.find(user => user.id === userId);
  }

  hasActiveFilters(): boolean {
    return !!(this.searchQuery?.trim() || this.filterStatus);
  }

  // Load all orders once on page load
  loadAllOrders() {
    console.log('Loading orders, users available:', this.users.length);
    
    this.adminService.getAllOrders('', 1, 1000).subscribe({ // Load large number to get all
      next: (response) => {
        console.log('Orders loaded, sample order:', response?.orders?.[0]);
        
        if (response && response.orders) {
          this.allOrders = response.orders;
          this.orders = response.orders;
          this.totalRecords = response.total || response.orders.length;
          
          // Debug: Check if we can match users
          if (this.orders.length > 0 && this.users.length > 0) {
            const firstOrder = this.orders[0];
            const matchedUser = this.getUserById(firstOrder.user_id);
            console.log('First order user_id:', firstOrder.user_id);
            console.log('Matched user:', matchedUser);
          }
        } else {
          this.allOrders = [];
          this.orders = [];
          this.totalRecords = 0;
        }
        
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading orders:', error);
        this.loading = false;
        
        let errorMessage = this.translateService.instant('admin.orders.load_error');
        if (error.status === 403) {
          errorMessage = this.translateService.instant('admin.orders.permission_error');
          this.router.navigate(['/']);
        }
        
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: errorMessage
        });
        
        this.allOrders = [];
        this.orders = [];
        this.totalRecords = 0;
      }
    });
  }

  // Filter orders client-side (no API calls)
  filterOrders() {
    let filtered = [...this.allOrders];

    // Apply search filter
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

    // Apply status filter
    if (this.filterStatus) {
      filtered = filtered.filter(order => 
        order.status === this.filterStatus
      );
    }

    this.orders = filtered;
    this.totalRecords = filtered.length;
    console.log(`Filtered ${filtered.length} orders from ${this.allOrders.length} total`);
  }

  // Search input with client-side filtering
  onSearchInput() {
    // Clear the previous timeout if user is still typing
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    // Set a new timeout to filter after 300ms of no typing
    this.searchTimeout = setTimeout(() => {
      this.filterOrders(); // Filter client-side instead of API call
    }, 300);
  }

  onStatusChange() {
    this.filterOrders(); // Filter client-side instead of API call
  }

  clearFilters() {
    this.searchQuery = '';
    this.filterStatus = '';
    this.filterOrders(); // Filter client-side instead of API call
  }

  refreshOrderData() {
    this.loadAllOrders();
  }

  exportOrders() {
    // TODO: Implement export functionality
    this.messageService.add({
      severity: 'info',
      summary: this.translateService.instant('admin.orders.export'),
      detail: this.translateService.instant('admin.orders.export_coming_soon')
    });
  }

  onPageChange(event: any) {
    this.page = event.page + 1;
    this.pageSize = event.rows;
    this.loadAllOrders();
  }

  openOrderDetails(order: Order) {
    this.selectedOrder = order;
    this.displayOrderDialog = true;
  }

  getStatusSeverity(status: string): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" {
    switch (status) {
      case 'pending': return 'warn';
      case 'confirmed': return 'info';
      case 'shipped': return 'info';
      case 'delivered': return 'success';
      case 'cancelled': return 'danger';
      default: return 'secondary';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'pending': return 'pi pi-clock';
      case 'confirmed': return 'pi pi-check';
      case 'shipped': return 'pi pi-send';
      case 'delivered': return 'pi pi-check-circle';
      case 'cancelled': return 'pi pi-times';
      default: return 'pi pi-info-circle';
    }
  }

  formatDate(dateString: string): string {
    return this.dateService.formatDate(dateString);
  }

  getProductName(item: any): string {
    // If item already has translations, use it as a product
    if (item.name_translations || item.name) {
      return this.translationHelper.getProductName(item);
    }
    
    // Try to find the full product object
    if (item.product_id && this.products.length > 0) {
      const fullProduct = this.products.find(p => p.id === item.product_id);
      if (fullProduct) {
        return this.translationHelper.getProductName(fullProduct);
      }
    }
    
    return item.product_name || item.name;
  }

  getUnitDisplay(unit: string): string {
    return this.translateService.instant('admin.products.units.' + unit + '_short');
  }

  formatCurrency(amount: number): string {
    return this.currencyService.formatCurrency(amount);
  }

  updateOrderStatus(orderId: number, newStatus: string) {
    this.confirmationService.confirm({
      message: this.translateService.instant('admin.orders.confirm_status_update', { status: this.translateService.instant('admin.orders.status.' + newStatus) }),
      header: this.translateService.instant('admin.orders.confirm_header'),
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.adminService.updateOrderStatus(orderId, newStatus).subscribe({
          next: (updatedOrder) => {
            // Update order in both arrays
            const allIndex = this.allOrders.findIndex(o => o.id === orderId);
            if (allIndex !== -1) {
              this.allOrders[allIndex] = updatedOrder;
            }
            
            // Reapply filters to update display
            this.filterOrders();
            
            this.messageService.add({
              severity: 'success',
              summary: this.translateService.instant('admin.orders.status_updated'),
              detail: this.translateService.instant('admin.orders.status_update_message', { 
                orderId: orderId, 
                status: this.translateService.instant('admin.orders.status.' + newStatus) 
              })
            });
            
            // Update selected order if in dialog
            if (this.selectedOrder && this.selectedOrder.id === orderId) {
              this.selectedOrder = updatedOrder;
            }
          },
          error: (error) => {
            console.error('Error updating order status:', error);
            this.messageService.add({
              severity: 'error',
              summary: this.translateService.instant('admin.orders.update_failed'),
              detail: error.error?.detail || this.translateService.instant('admin.orders.update_error')
            });
          }
        });
      }
    });
  }
}