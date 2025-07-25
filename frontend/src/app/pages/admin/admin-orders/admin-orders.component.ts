// src/app/pages/admin/admin-orders/admin-orders.component.ts
import { Component, OnInit } from '@angular/core';
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

import { AdminService } from '../../../services/admin.service';
import { Order } from '../../../models/admin.model';

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
    ProgressSpinnerModule
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
  totalRecords = 0;
  loading = true;
  searchQuery = '';
  filterStatus = '';
  page = 1;
  pageSize = 10;

  private searchTimeout: any;
  
  statusOptions = [
    { label: 'All', value: '' },
    { label: 'Pending', value: 'pending' },
    { label: 'Confirmed', value: 'confirmed' },
    { label: 'Shipped', value: 'shipped' },
    { label: 'Delivered', value: 'delivered' },
    { label: 'Cancelled', value: 'cancelled' }
  ];
  
  selectedOrder: Order | null = null;
  displayOrderDialog = false;
  
  constructor(
    private adminService: AdminService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadUsersAndOrders();
  }

  // Load both users and orders, then match them
  loadUsersAndOrders() {
    this.loading = true;
    
    // First load users
    this.adminService.getAllUsers().subscribe({
      next: (usersResponse) => {
        this.users = Array.isArray(usersResponse) ? usersResponse : usersResponse.users;
        
        // Then load orders
        this.loadAllOrders();
      },
      error: (error) => {
        console.error('Error loading users:', error);
        this.loading = false;
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
        
        let errorMessage = 'Failed to load orders';
        if (error.status === 403) {
          errorMessage = 'You do not have permission to access this page';
          this.router.navigate(['/']);
        }
        
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
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
      summary: 'Export',
      detail: 'Export functionality coming soon!'
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
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }

  updateOrderStatus(orderId: number, newStatus: string) {
    this.confirmationService.confirm({
      message: `Are you sure you want to update this order status to ${newStatus}?`,
      header: 'Confirm Status Update',
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
              summary: 'Status Updated',
              detail: `Order #${orderId} status changed to ${newStatus}`
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
              summary: 'Update Failed',
              detail: error.error?.detail || 'Failed to update order status'
            });
          }
        });
      }
    });
  }
}