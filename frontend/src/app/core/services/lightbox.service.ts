import { Injectable, inject, signal, computed } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { CurrencyService } from './currency.service';
import { UnitsService } from './units.service';
import { LightboxDetails } from '../../shared/components/image-lightbox/image-lightbox.component';
import { getCartonCount } from '../../shared/utils/quantity.utils';

export interface LightboxItem {
  product_image?: string;
  product_image_url?: string;
  product_name: string;
  product_unit?: string;
  product_price?: number;
  unit_price?: number;
  quantity: number;
  pieces_per_box?: number;
  packaging_type?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LightboxService {
  private translateService = inject(TranslateService);
  private currencyService = inject(CurrencyService);
  private unitsService = inject(UnitsService);

  // Lightbox state signals
  readonly selectedImage = signal<string | null>(null);
  readonly title = signal<string | null>(null);
  readonly details = signal<LightboxDetails[]>([]);
  readonly packagingType = signal<string | null>(null);
  readonly piecesPerBox = signal<number | null>(null);
  readonly unit = signal<string | null>(null);
  readonly cartonsCount = signal<number | null>(null);

  // Computed - check if lightbox is open
  readonly isOpen = computed(() => this.selectedImage() !== null);

  /**
   * Open lightbox with item details
   * Works with both CartItem and OrderItem
   */
  openImage(item: LightboxItem, isOrderItem = false): void {
    const imageUrl = item.product_image || item.product_image_url;
    if (!imageUrl) return;

    const price = item.product_price ?? item.unit_price ?? 0;
    const cartonsQty = isOrderItem
      ? item.quantity
      : getCartonCount(item.quantity, item.pieces_per_box);

    this.selectedImage.set(imageUrl);
    this.title.set(item.product_name);
    this.packagingType.set(item.packaging_type || null);
    this.piecesPerBox.set(item.pieces_per_box || null);
    this.unit.set(item.product_unit || null);
    this.cartonsCount.set(cartonsQty);

    const details: LightboxDetails[] = [
      {
        label: this.translateService.instant('common.quantity'),
        value: `${item.quantity}`
      },
      {
        label: this.translateService.instant('common.price'),
        value: this.currencyService.formatCurrency(price)
      },
      {
        label: this.translateService.instant('common.total'),
        value: this.currencyService.formatCurrency(price * item.quantity)
      }
    ];

    this.details.set(details);
  }

  /**
   * Close lightbox and reset all state
   */
  closeImage(): void {
    this.selectedImage.set(null);
    this.title.set(null);
    this.details.set([]);
    this.packagingType.set(null);
    this.piecesPerBox.set(null);
    this.unit.set(null);
    this.cartonsCount.set(null);
  }
}
