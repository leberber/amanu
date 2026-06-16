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
import { Order, OrderItem, AuditLogEntry, DiffDisplayItem } from '../../../models/order.model';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { ImageLightboxComponent } from '../../../shared/components/image-lightbox/image-lightbox.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { CurrencyDisplayComponent } from '../../../shared/components/currency-display/currency-display.component';
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
    CurrencyDisplayComponent,
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
  auditLog = signal<AuditLogEntry[]>([]);

  // Computed
  totalAmount = computed(() => this.order()?.total_amount || 0);
  itemsSubtotal = computed(() => {
    const items = this.order()?.items ?? [];
    return items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  });
  discountAmount = computed(() => {
    const order = this.order();
    const items = order?.items ?? [];
    const groupDiscount = items.reduce((sum, item) =>
      item.custom_unit_price && item.custom_unit_price < item.unit_price
        ? sum + (item.unit_price - item.custom_unit_price) * item.quantity
        : sum
    , 0);
    return groupDiscount
      + (order?.discount_amount ?? 0)
      + (order?.cross_sell_discount_amount ?? 0)
      + (order?.volume_discount_amount ?? 0);
  });
  shippingCost = computed(() => this.order()?.shipping_cost ?? 0);
  originalShippingCost = computed(() => this.order()?.original_shipping_cost ?? null);
  shippingDiscountAmount = computed(() => {
    const orig = this.originalShippingCost();
    if (!orig) return 0;
    return Math.round((orig - this.shippingCost()) * 100) / 100;
  });
  shippingDiscountPercent = computed(() => {
    const orig = this.originalShippingCost();
    if (!orig) return 0;
    return Math.round(this.shippingDiscountAmount() / orig * 100);
  });
  grandTotal = computed(() => this.itemsSubtotal() - this.discountAmount() + this.shippingCost());
  showBreakdown = computed(() => this.discountAmount() > 0 || this.shippingCost() > 0);
  canCancelOrder = computed(() => this.order()?.status === ORDER_STATUS.PENDING);
  totalPaid = computed(() =>
    (this.order()?.payments ?? []).reduce((sum, p) => sum + p.amount, 0)
  );
  balance = computed(() => this.grandTotal() - this.totalPaid());
  lastPaymentDate = computed(() => {
    const payments = this.order()?.payments;
    if (!payments?.length) return null;
    return payments[payments.length - 1].recorded_at;
  });
  adminModifiedAt = computed(() => {
    const d = this.order()?.admin_modified_at;
    return d ? this.dateService.formatDate(d) : null;
  });

  displayItems = computed((): DiffDisplayItem[] => {
    const order = this.order();
    if (!order?.items?.length) return [];

    const modifiedAt = order.admin_modified_at;
    if (!modifiedAt) return order.items.map(item => ({ kind: 'normal', item }));

    const audit = this.auditLog();
    if (!audit.length) return order.items.map(item => ({ kind: 'normal', item }));

    const modTime = new Date(modifiedAt).getTime();
    const batch = audit.filter(e => {
      const t = new Date(e.created_at).getTime();
      return t >= modTime - 30_000 && t <= modTime + 5_000;
    });
    if (!batch.length) return order.items.map(item => ({ kind: 'normal', item }));

    const addedIds = new Set<number>();
    const removedEntries = new Map<number, AuditLogEntry>();
    const changedEntries = new Map<number, AuditLogEntry>();
    for (const e of batch) {
      const pid = e.details?.product_id;
      if (pid == null) continue;
      if (e.action === 'item_added') addedIds.add(pid);
      else if (e.action === 'item_removed') removedEntries.set(pid, e);
      else if (e.action === 'item_quantity_changed') changedEntries.set(pid, e);
    }

    const result: DiffDisplayItem[] = [];
    for (const item of order.items) {
      if (addedIds.has(item.product_id)) {
        result.push({ kind: 'added', item });
      } else if (changedEntries.has(item.product_id)) {
        result.push({ kind: 'changed', item, old_quantity: changedEntries.get(item.product_id)!.details?.old_quantity });
      } else {
        result.push({ kind: 'normal', item });
      }
    }
    for (const [, e] of removedEntries) {
      const d = e.details!;
      result.push({ kind: 'removed', item: { id: -1, product_id: d.product_id ?? 0, product_name: d.product_name ?? '', unit_price: d.unit_price ?? 0, quantity: d.quantity ?? 0, product_unit: '' } });
    }
    return result;
  });

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

  getCartonDisplay(item: OrderItem, compact = false): string {
    const packagingLabel = item.packaging_type
      ? this.translateService.instant(`products.product.packaging_types.${item.packaging_type}`)
      : undefined;
    const unitLabel = item.product_unit
      ? this.translateService.instant(`units.${item.product_unit}_short`)
      : undefined;
    return getOrderCartonDisplay(item.quantity, item.pieces_per_box, packagingLabel, unitLabel, compact);
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
        if (orderData.admin_modified_at) {
          this.loadAuditLog(orderData.id);
        }
      }
    });
  }

  private loadAuditLog(orderId: number): void {
    this.orderService.getOrderAuditLog(orderId).subscribe(logs => {
      this.auditLog.set(logs);
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
