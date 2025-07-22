// src/app/pages/orders/order-detail/order-detail.component.ts
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TagModule } from 'primeng/tag';
import { TimelineModule } from 'primeng/timeline';
import { DividerModule } from 'primeng/divider';
import { PanelModule } from 'primeng/panel';
import { CardModule } from 'primeng/card';
import { TranslateModule, TranslateService } from '@ngx-translate/core'; // Added TranslateModule and TranslateService

import { OrderService } from '../../../services/order.service'; 
import { Order } from '../../../models/order.model';

interface OrderStatus {
  status: string;
  date: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    PanelModule,
    ButtonModule,
    CardModule,
    TableModule,
    ToastModule,
    TagModule,
    TimelineModule,
    DividerModule,
    TranslateModule // Added TranslateModule
  ],
  providers: [MessageService],
  templateUrl: './order-detail.component.html'
})
export class OrderDetailComponent implements OnInit {
  // Dependency injection
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private orderService = inject(OrderService);
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService); // Added TranslateService

  // Signals
  order = signal<Order | null>(null);
  loading = signal<boolean>(true);
  error = signal<boolean>(false);
  orderStatuses = signal<OrderStatus[]>([]);

  // Computed values
  totalAmount = computed(() => this.order()?.total_amount || 0);
  canCancelOrder = computed(() => this.order()?.status === 'pending');

  ngOnInit(): void {
    // Check for success parameter
    this.route.queryParams.subscribe(params => {
      if (params['success'] === 'true') {
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('orders.detail.order_placed_success'),
          detail: this.translateService.instant('orders.detail.order_placed_success_message'),
          life: 5000
        });
      }
    });
    
    // Load order details
    this.route.paramMap.pipe(
      switchMap(params => {
        const orderId = params.get('id');
        if (!orderId) {
          this.error.set(true);
          this.loading.set(false);
          return of(null);
        }
        
        return this.orderService.getOrderDetails(Number(orderId)).pipe(
          catchError(error => {
            this.error.set(true);
            this.loading.set(false);
            this.messageService.add({
              severity: 'error',
              summary: this.translateService.instant('orders.detail.load_error_title'),
              detail: this.translateService.instant('orders.detail.load_error_message')
            });
            return of(null);
          })
        );
      })
    ).subscribe(orderData => {
      this.order.set(orderData);
      this.loading.set(false);
      
      if (orderData) {
        this.generateOrderStatusTimeline(orderData);
      }
    });
  }

  generateOrderStatusTimeline(order: Order): void {
    // Create timeline based on order status with translated labels
    const statuses: OrderStatus[] = [
      {
        status: this.translateService.instant('orders.detail.timeline.order_placed'),
        date: order.created_at,
        icon: 'pi pi-shopping-cart',
        color: '#607D8B'
      }
    ];
    
    // Add statuses based on current order status
    switch (order.status) {
      case 'cancelled':
        statuses.push({
          status: this.translateService.instant('orders.detail.timeline.order_cancelled'),
          date: order.updated_at || order.created_at,
          icon: 'pi pi-times',
          color: '#F44336'
        });
        break;
        
      case 'confirmed':
      case 'shipped':
      case 'delivered':
        statuses.push({
          status: this.translateService.instant('orders.detail.timeline.order_confirmed'),
          date: order.updated_at || order.created_at,
          icon: 'pi pi-check-circle',
          color: '#4CAF50'
        });
        
        if (order.status === 'shipped' || order.status === 'delivered') {
          statuses.push({
            status: this.translateService.instant('orders.detail.timeline.order_shipped'),
            date: order.updated_at || order.created_at,
            icon: 'pi pi-truck',
            color: '#3F51B5'
          });
          
          if (order.status === 'delivered') {
            statuses.push({
              status: this.translateService.instant('orders.detail.timeline.order_delivered'),
              date: order.updated_at || order.created_at,
              icon: 'pi pi-check-square',
              color: '#2E7D32'
            });
          }
        }
        break;
    }
    
    this.orderStatuses.set(statuses);
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

  getStatusLabel(status: string): string {
    // Use translation service for status labels
    return this.translateService.instant(`orders.status.${status}`);
  }

  getUnitDisplay(unit: string): string {
    switch (unit) {
      case 'kg': return 'Kg';
      case 'gram': return 'g';
      case 'piece': return 'Piece';
      case 'bunch': return 'Bunch';
      case 'dozen': return 'Dozen';
      case 'pound': return 'lb';
      default: return unit;
    }
  }

  cancelOrder(): void {
    const currentOrder = this.order();
    if (!currentOrder || currentOrder.status !== 'pending') {
      return;
    }
    
    this.orderService.cancelOrder(currentOrder.id).subscribe({
      next: (updatedOrder) => {
        this.order.set(updatedOrder);
        this.generateOrderStatusTimeline(updatedOrder);
        
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('orders.detail.order_cancelled_success'),
          detail: this.translateService.instant('orders.detail.order_cancelled_success_message')
        });
      },
      error: (error) => {
        console.error('Error cancelling order:', error);
        
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('orders.detail.cancel_error_title'),
          detail: this.translateService.instant('orders.detail.cancel_error_message')
        });
      }
    });
  }

  backToOrders(): void {
    this.router.navigate(['/orders']);
  }
}