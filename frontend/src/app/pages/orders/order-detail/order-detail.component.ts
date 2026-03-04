import { Component, OnInit, computed, inject, signal, DestroyRef } from '@angular/core';
import { NgClass } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

import { TimelineModule } from 'primeng/timeline';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ORDER_STATUS } from '../../../core/constants/order.constants';
import { ROUTES } from '../../../core/constants/routes.constants';
import { OrderService } from '../../../services/order.service';
import { TranslationService } from '../../../services/translation.service';
import { LightboxService } from '../../../core/services/lightbox.service';
import { DateService } from '../../../core/services/date.service';
import { OrderTimelineService, TimelineStatus } from '../../../core/services/order-timeline.service';
import { OrderTranslationService } from '../../../core/services/order-translation.service';
import { Order, OrderItem } from '../../../models/order.model';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { ImageLightboxComponent } from '../../../shared/components/image-lightbox/image-lightbox.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { CurrencyPipe } from '../../../shared/pipes/currency.pipe';
import { DateFormatPipe } from '../../../shared/pipes/date-format.pipe';
import { ImageFallbackDirective } from '../../../shared/directives/image-fallback.directive';
import { getOrderCartonDisplay } from '../../../shared/utils/quantity.utils';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [
    NgClass,
    TimelineModule,
    TranslateModule,
    PageLayoutComponent,
    ImageLightboxComponent,
    ErrorStateComponent,
    CurrencyPipe,
    DateFormatPipe,
    ImageFallbackDirective
  ],
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.scss'
})
export class OrderDetailComponent implements OnInit {
  // Services
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private orderService = inject(OrderService);
  private translationService = inject(TranslationService);
  private toast = inject(ToastMessageService);
  private translateService = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private dateService = inject(DateService);
  readonly timelineService = inject(OrderTimelineService);
  private orderTranslation = inject(OrderTranslationService);
  readonly lightbox = inject(LightboxService);

  // Constants
  readonly ROUTES = ROUTES;
  readonly SKELETON_ITEMS = [1, 2, 3];
  readonly SKELETON_TIMELINE = [1, 2];

  // State
  order = signal<Order | null>(null);
  loading = signal(true);
  error = signal(false);
  orderStatuses = signal<TimelineStatus[]>([]);

  // Computed
  totalAmount = computed(() => this.order()?.total_amount || 0);
  canCancelOrder = computed(() => this.order()?.status === ORDER_STATUS.PENDING);

  private orderDate = computed(() =>
    this.order()?.created_at ? this.dateService.formatDateOnly(this.order()!.created_at) : ''
  );

  pageSubtitle = computed(() =>
    this.order() ? `#${this.order()!.id} - ${this.orderDate()}` : ''
  );

  mobilePageTitle = computed(() =>
    this.order() ? `${this.translateService.instant('common.order')} #${this.order()!.id}` : ''
  );

  mobileSubtitle = computed(() => this.orderDate());

  ngOnInit(): void {
    this.subscribeToLanguageChanges();
    this.loadOrderDetails();
  }

  cancelOrder(): void {
    const currentOrder = this.order();
    if (!currentOrder || currentOrder.status !== ORDER_STATUS.PENDING) return;

    this.orderService.cancelOrder(currentOrder.id).subscribe({
      next: (updatedOrder) => {
        this.order.set(updatedOrder);
        this.orderStatuses.set(this.timelineService.generateTimeline(updatedOrder));
        this.toast.showSuccess('orders.detail.order_cancelled_success_message');
      },
      error: (err) => this.toast.showApiError(err, 'orders.detail.cancel_error_message')
    });
  }

  goBack(): void {
    this.router.navigate([ROUTES.ORDERS]);
  }

  openImage(item: OrderItem): void {
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

  getCartonDisplay(item: { quantity: number; pieces_per_box?: number }): string {
    return getOrderCartonDisplay(item.quantity, item.pieces_per_box);
  }

  // Private methods
  private subscribeToLanguageChanges(): void {
    this.translationService.currentLanguage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadTranslatedNames();
        const currentOrder = this.order();
        if (currentOrder) {
          this.orderStatuses.set(this.timelineService.generateTimeline(currentOrder));
        }
      });
  }

  private loadOrderDetails(): void {
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
        this.orderStatuses.set(this.timelineService.generateTimeline(orderData));
        this.loadTranslatedNames();
      }
    });
  }

  private loadTranslatedNames(): void {
    const currentOrder = this.order();
    if (!currentOrder?.items?.length) return;

    this.orderTranslation.loadTranslatedItems(currentOrder.items).subscribe(updatedItems => {
      this.order.set({ ...currentOrder, items: updatedItems });
    });
  }
}
