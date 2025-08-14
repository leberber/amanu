// src/app/pages/orders/order-list/order-list.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';

import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TagModule } from 'primeng/tag';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { OrderService } from '../../../services/order.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { Order } from '../../../models/order.model';
import { StatusSeverityService } from '../../../core/services/status-severity.service';

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ButtonModule,
    CardModule,
    TableModule,
    ToastModule,
    TagModule,
    TranslateModule
  ],
  providers: [MessageService],
  templateUrl: './order-list.component.html'

})
export class OrderListComponent implements OnInit {
  orders: Order[] = [];
  loading = true;

  // Services injected using inject()
  private orderService = inject(OrderService);
  private router = inject(Router);
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService);
  private currencyService = inject(CurrencyService);
  private statusSeverity = inject(StatusSeverityService);

  ngOnInit() {
    this.loadOrders();
  }

  loadOrders() {
    this.loading = true;
    this.orderService.getUserOrders().subscribe({
      next: (orders) => {
        this.orders = orders;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading orders:', error);
        this.loading = false;
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: this.translateService.instant('orders.errors.failed_to_load')
        });
      }
    });
  }

  viewOrderDetails(orderId: number) {
    this.router.navigate(['/orders', orderId]);
  }

  getStatusSeverity(status: string): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" {
    return this.statusSeverity.getOrderStatusSeverity(status);
  }

  getStatusLabel(status: string): string {
    return this.translateService.instant(`orders.status.${status}`);
  }

  // Format price using CurrencyService
  formatPrice(price: number): string {
    return this.currencyService.formatCurrency(price);
  }

  // Format date in DD/MM/YYYY HH:MM format
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }
}