// src/app/pages/orders/order-detail/order-detail.component.ts
import { Component, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { switchMap, catchError, map } from 'rxjs/operators';
import { of, Subscription, forkJoin } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TagModule } from 'primeng/tag';
import { TimelineModule } from 'primeng/timeline';
import { DividerModule } from 'primeng/divider';
import { PanelModule } from 'primeng/panel';
import { CardModule } from 'primeng/card';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { OrderService } from '../../../services/order.service'; 
import { ProductService } from '../../../services/product.service'; // 🆕 ADD THIS
import { TranslationService } from '../../../services/translation.service'; // 🆕 ADD THIS
import { CurrencyService } from '../../../core/services/currency.service';
import { UnitsService } from '../../../core/services/units.service';
import { Order, OrderItem } from '../../../models/order.model';
import { StatusSeverityService } from '../../../core/services/status-severity.service';

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
    TranslateModule
  ],
  providers: [MessageService],
  templateUrl: './order-detail.component.html'
})
export class OrderDetailComponent implements OnInit, OnDestroy {
  // Dependency injection
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private orderService = inject(OrderService);
  private productService = inject(ProductService); // 🆕 ADD THIS
  private translationService = inject(TranslationService); // 🆕 ADD THIS
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService);
  private currencyService = inject(CurrencyService);
  private unitsService = inject(UnitsService);
  private statusSeverity = inject(StatusSeverityService);

  // Signals
  order = signal<Order | null>(null);
  loading = signal<boolean>(true);
  error = signal<boolean>(false);
  orderStatuses = signal<OrderStatus[]>([]);

  // 🆕 NEW: Subscription management
  private languageSubscription?: Subscription;

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
    
    // 🆕 NEW: Subscribe to language changes
    this.languageSubscription = this.translationService.currentLanguage$.subscribe(() => {
      this.loadTranslatedNames();
      // Regenerate timeline with new translations
      const currentOrder = this.order();
      if (currentOrder) {
        this.generateOrderStatusTimeline(currentOrder);
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
        // 🆕 Load translated names after order is loaded
        this.loadTranslatedNames();
      }
    });
  }

  // 🆕 NEW: Cleanup subscription
  ngOnDestroy(): void {
    if (this.languageSubscription) {
      this.languageSubscription.unsubscribe();
    }
  }

  // 🆕 NEW: Load translated names for order items
  private loadTranslatedNames(): void {
    const currentOrder = this.order();
    if (!currentOrder || !currentOrder.items || currentOrder.items.length === 0) {
      return;
    }

    const currentLanguage = this.translationService.getCurrentLanguage();
    
    // Create observables to fetch each product with translations
    const productObservables = currentOrder.items.map(item => 
      this.productService.getProduct(item.product_id).pipe(
        map(product => ({
          orderItemId: item.id,
          translatedName: product.name, // This will be translated by the API
          translatedDescription: product.description || ''
        })),
        catchError(error => {
          console.error(`Error loading product ${item.product_id}:`, error);
          return of({
            orderItemId: item.id,
            translatedName: item.product_name, // Fallback to original name
            translatedDescription: ''
          });
        })
      )
    );

    // Execute all requests in parallel
    forkJoin(productObservables).subscribe(results => {
      // Update order items with translated names
      const updatedOrder = { ...currentOrder };
      updatedOrder.items = currentOrder.items!.map(item => {
        const translation = results.find(r => r.orderItemId === item.id);
        if (translation) {
          return {
            ...item,
            product_name: translation.translatedName // Update with translated name
          };
        }
        return item;
      });

      this.order.set(updatedOrder);
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
    return this.statusSeverity.getOrderStatusSeverity(status);
  }

  getStatusLabel(status: string): string {
    // Use translation service for status labels
    return this.translateService.instant(`orders.status.${status}`);
  }

  getUnitDisplay(unit: string): string {
    return this.unitsService.getUnitDisplay(unit);
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