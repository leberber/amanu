// src/app/pages/admin/admin-orders/admin-orders.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TagModule } from 'primeng/tag';
import { PaginatorModule } from 'primeng/paginator';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import { AdminService } from '../../../services/admin.service';
import { Order } from '../../../models/admin.model';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SelectModule,
    // RouterLink,
    TableModule,
    ButtonModule,
    CardModule,
    DropdownModule,
    ToastModule,
    TagModule,
    PaginatorModule,
    DialogModule,
    ConfirmDialogModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './admin-orders.component.html',
  styleUrl: './admin-orders.component.scss'
})
export class AdminOrdersComponent implements OnInit {
  orders: Order[] = [];
  totalRecords = 0;
  loading = true;
  filterStatus = '';
  page = 1;
  pageSize = 10;
  
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
    this.loadOrders();
  }

// Updated loadOrders method in component with better error handling
loadOrders() {
  this.loading = true;
  this.adminService.getAllOrders(this.filterStatus, this.page, this.pageSize).subscribe({
    next: (response) => {
      console.log('Orders response:', response);
      
      // Check if we received a valid response
      if (!response) {
        console.error('Response is null or undefined');
        this.orders = [];
        this.totalRecords = 0;
      } else {
        // Check if orders property exists
        if (response.orders) {
          this.orders = response.orders;
          console.log('Parsed orders:', this.orders);
        } else {
          console.error('Orders property missing in response:', response);
          this.orders = [];
        }
        
        // Check if total property exists
        if (response.total !== undefined) {
          this.totalRecords = response.total;
        } else {
          console.error('Total property missing in response');
          this.totalRecords = 0;
        }
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
      } else if (error.status === 404) {
        errorMessage = 'Orders endpoint not found';
      } else if (error.status === 500) {
        errorMessage = 'Server error while loading orders';
      }
      
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: errorMessage
      });
      
      this.orders = [];
      this.totalRecords = 0;
    }
  });
}

  onPageChange(event: any) {
    this.page = event.page + 1;
    this.pageSize = event.rows;
    this.loadOrders();
  }

  onStatusChange() {
    this.page = 1; // Reset to first page on filter change
    this.loadOrders();
  }

  openOrderDetails(order: Order) {
    this.selectedOrder = order;
    this.displayOrderDialog = true;
  }

  getStatusSeverity(status: string): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" {
    switch (status) {
      case 'pending': return 'warn';     // Changed from 'warning' to 'warn'
      case 'confirmed': return 'info';
      case 'shipped': return 'info';
      case 'delivered': return 'success';
      case 'cancelled': return 'danger';
      default: return 'secondary';
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
            // Update order in the list
            const index = this.orders.findIndex(o => o.id === orderId);
            if (index !== -1) {
              this.orders[index] = updatedOrder;
            }
            
            this.messageService.add({
              severity: 'success',
              summary: 'Status Updated',
              detail: `Order #${orderId} status changed to ${newStatus}`
            });
            
            // Close dialog if open
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