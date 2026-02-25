// src/app/pages/orders/order-detail/order-detail.component.ts
import { Component, OnInit, computed, inject, signal, DestroyRef } from '@angular/core';
import { NgClass } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap, catchError, map } from 'rxjs/operators';
import { of, forkJoin } from 'rxjs';

import { ToastModule } from 'primeng/toast';
import { TimelineModule } from 'primeng/timeline';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ORDER_STATUS, TIMELINE_COLORS } from '../../../core/constants/app.constants';
import { ROUTES } from '../../../core/constants/routes.constants';
import { OrderService } from '../../../services/order.service';
import { ProductService } from '../../../services/product.service';
import { TranslationService } from '../../../services/translation.service';
import { LightboxService } from '../../../core/services/lightbox.service';
import { DateService } from '../../../core/services/date.service';
import { Order, OrderItem } from '../../../models/order.model';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { ImageLightboxComponent } from '../../../shared/components/image-lightbox/image-lightbox.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { CurrencyPipe } from '../../../shared/pipes/currency.pipe';
import { DateFormatPipe } from '../../../shared/pipes/date-format.pipe';
import { StatusPipe } from '../../../shared/pipes/status.pipe';
import { ImageFallbackDirective } from '../../../shared/directives/image-fallback.directive';
import { getOrderCartonDisplay } from '../../../shared/utils/quantity.utils';

interface TimelineStatus {
  status: string;
  date: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [
    NgClass,
    ToastModule,
    TimelineModule,
    TranslateModule,
    PageLayoutComponent,
    ImageLightboxComponent,
    ErrorStateComponent,
    CurrencyPipe,
    DateFormatPipe,
    StatusPipe,
    ImageFallbackDirective
  ],
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.scss'
})
export class OrderDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private orderService = inject(OrderService);
  private productService = inject(ProductService);
  private translationService = inject(TranslationService);
  private toast = inject(ToastMessageService);
  private translateService = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  readonly lightbox = inject(LightboxService);
  private dateService = inject(DateService);

  readonly ROUTES = ROUTES;

  order = signal<Order | null>(null);
  loading = signal<boolean>(true);
  error = signal<boolean>(false);
  orderStatuses = signal<TimelineStatus[]>([]);

  // Computed values
  totalAmount = computed(() => this.order()?.total_amount || 0);
  canCancelOrder = computed(() => this.order()?.status === ORDER_STATUS.PENDING);

  // Page layout computed values
  private orderDate = computed(() => this.order()?.created_at ? this.dateService.formatDateOnly(this.order()!.created_at) : '');

  pageSubtitle = computed(() => this.order() ? `#${this.order()!.id} - ${this.orderDate()}` : '');
  mobilePageTitle = computed(() => this.order() ? `${this.translateService.instant('common.order')} #${this.order()!.id}` : '');
  mobileSubtitle = computed(() => this.orderDate());

  ngOnInit(): void {
    // Check for success parameter
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        if (params['success'] === 'true') {
          this.toast.showSuccess('orders.detail.order_placed_success_message');
        }
      });
    
    // Subscribe to language changes - automatically cleaned up on destroy
    this.translationService.currentLanguage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadTranslatedNames();
        // Regenerate timeline with new translations
        const currentOrder = this.order();
        if (currentOrder) {
          this.generateOrderStatusTimeline(currentOrder);
        }
      });
    
    // Load order details
    this.route.paramMap.pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap(params => {
        const orderId = params.get('id');
        if (!orderId) {
          this.error.set(true);
          this.loading.set(false);
          return of(null);
        }
        
        return this.orderService.getOrderDetails(Number(orderId)).pipe(
          catchError(() => {
            this.error.set(true);
            this.loading.set(false);
            this.toast.showError('orders.detail.load_error_message');
            return of(null);
          })
        );
      })
    ).subscribe(orderData => {
      this.order.set(orderData);
      this.loading.set(false);
      
      if (orderData) {
        this.generateOrderStatusTimeline(orderData);
        // Load translated names after order is loaded
        this.loadTranslatedNames();
      }
    });
  }

  private loadTranslatedNames(): void {
    const currentOrder = this.order();
    if (!currentOrder || !currentOrder.items || currentOrder.items.length === 0) {
      return;
    }

    // Create observables to fetch each product with translations
    const productObservables = currentOrder.items.map(item =>
      this.productService.getProduct(item.product_id).pipe(
        map(product => ({
          orderItemId: item.id,
          translatedName: product.name,
          imageUrl: product.image_url || ''
        })),
        catchError(() => of({
            orderItemId: item.id,
            translatedName: item.product_name,
            imageUrl: ''
          })
        )
      )
    );

    // Execute all requests in parallel
    forkJoin(productObservables).subscribe(results => {
      // Update order items with translated names and images
      const updatedOrder = { ...currentOrder };
      updatedOrder.items = currentOrder.items!.map(item => {
        const productData = results.find(r => r.orderItemId === item.id);
        if (productData) {
          return {
            ...item,
            product_name: productData.translatedName,
            product_image_url: productData.imageUrl
          };
        }
        return item;
      });

      this.order.set(updatedOrder);
    });
  }

  generateOrderStatusTimeline(order: Order): void {
    const statuses: TimelineStatus[] = [
      {
        status: this.translateService.instant('orders.detail.timeline.order_placed'),
        date: order.created_at,
        icon: 'pi pi-shopping-cart',
        color: TIMELINE_COLORS.PLACED
      }
    ];

    switch (order.status) {
      case ORDER_STATUS.CANCELLED:
        statuses.push({
          status: this.translateService.instant('orders.detail.timeline.order_cancelled'),
          date: order.updated_at || order.created_at,
          icon: 'pi pi-times',
          color: TIMELINE_COLORS.CANCELLED
        });
        break;

      case ORDER_STATUS.CONFIRMED:
      case ORDER_STATUS.SHIPPED:
      case ORDER_STATUS.DELIVERED:
        statuses.push({
          status: this.translateService.instant('orders.detail.timeline.order_confirmed'),
          date: order.updated_at || order.created_at,
          icon: 'pi pi-check-circle',
          color: TIMELINE_COLORS.CONFIRMED
        });

        if (order.status === ORDER_STATUS.SHIPPED || order.status === ORDER_STATUS.DELIVERED) {
          statuses.push({
            status: this.translateService.instant('orders.detail.timeline.order_shipped'),
            date: order.updated_at || order.created_at,
            icon: 'pi pi-truck',
            color: TIMELINE_COLORS.SHIPPED
          });

          if (order.status === ORDER_STATUS.DELIVERED) {
            statuses.push({
              status: this.translateService.instant('orders.detail.timeline.order_delivered'),
              date: order.updated_at || order.created_at,
              icon: 'pi pi-check-square',
              color: TIMELINE_COLORS.DELIVERED
            });
          }
        }
        break;
    }

    this.orderStatuses.set(statuses);
  }

  cancelOrder(): void {
    const currentOrder = this.order();
    if (!currentOrder || currentOrder.status !== ORDER_STATUS.PENDING) {
      return;
    }
    
    this.orderService.cancelOrder(currentOrder.id).subscribe({
      next: (updatedOrder) => {
        this.order.set(updatedOrder);
        this.generateOrderStatusTimeline(updatedOrder);
        this.toast.showSuccess('orders.detail.order_cancelled_success_message');
      },
      error: (err) => {
        this.toast.showApiError(err, 'orders.detail.cancel_error_message');
      }
    });
  }

  goBack(): void {
    this.router.navigate([ROUTES.ORDERS]);
  }

  openImage(item: OrderItem): void {
    // For order items, pass isOrderItem=true since quantity IS the carton count
    this.lightbox.openImage({
      product_image_url: item.product_image_url,
      product_name: item.product_name,
      product_unit: item.product_unit,
      unit_price: item.unit_price,
      quantity: item.quantity,
      pieces_per_box: item.pieces_per_box
    }, true);
  }

  closeImage(): void {
    this.lightbox.closeImage();
  }

  // Get formatted display (e.g., "1x10" for 1 unit containing 10 pieces)
  getCartonDisplay(item: { quantity: number; pieces_per_box?: number }): string {
    return getOrderCartonDisplay(item.quantity, item.pieces_per_box);
  }
}