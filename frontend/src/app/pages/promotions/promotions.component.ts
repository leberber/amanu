import { Component, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { PromotionService } from '../../services/promotion.service';
import { CrossSellPromotionService } from '../../services/cross-sell-promotion.service';
import { VolumeDiscountService } from '../../services/volume-discount.service';
import { DateService } from '../../core/services/date.service';
import { CurrencyService } from '../../core/services/currency.service';
import { LightboxService } from '../../core/services/lightbox.service';
import { PackagingTypeService } from '../../core/services/packaging-type.service';
import { Promotion } from '../../models/promotion.model';
import { CrossSellPromotion } from '../../models/cross-sell-promotion.model';
import { VolumeDiscount } from '../../models/volume-discount.model';
import { ROUTES } from '../../core/constants/routes.constants';
import { SCOPE_LABELS, SCOPE_SEVERITIES, ScopeType } from '../../core/constants/promotion.constants';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ImageLightboxComponent } from '../../shared/components/image-lightbox/image-lightbox.component';
import { CurrencyPipe } from '../../shared/pipes/currency.pipe';

@Component({
  selector: 'app-promotions',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    TranslateModule,
    TagModule,
    SkeletonModule,
    PageLayoutComponent,
    EmptyStateComponent,
    ImageLightboxComponent
  ],
  templateUrl: './promotions.component.html',
  styleUrl: './promotions.component.scss'
})
export class PromotionsComponent implements OnInit {
  private promotionService = inject(PromotionService);
  private crossSellService = inject(CrossSellPromotionService);
  private volumeDiscountService = inject(VolumeDiscountService);
  private dateService = inject(DateService);
  private currencyService = inject(CurrencyService);
  private packagingTypeService = inject(PackagingTypeService);
  private translateService = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  readonly lightboxService = inject(LightboxService);

  readonly routes = ROUTES;

  promotions = signal<Promotion[]>([]);
  crossSellPromotions = signal<CrossSellPromotion[]>([]);
  volumeDiscounts = signal<VolumeDiscount[]>([]);
  loading = signal(true);
  error = signal(false);

  ngOnInit(): void {
    this.loadPromotions();
  }

  loadPromotions(): void {
    this.loading.set(true);
    this.error.set(false);

    forkJoin({
      promos: this.promotionService.getActivePromotions(),
      crossSell: this.crossSellService.getActivePromotionsCached(),
      volume: this.volumeDiscountService.getActiveCached()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ promos, crossSell, volume }) => {
          this.promotions.set(promos);
          this.crossSellPromotions.set(crossSell);
          this.volumeDiscounts.set(volume);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        }
      });
  }

  hasNoPromotions(): boolean {
    return this.promotions().length === 0 && this.crossSellPromotions().length === 0 && this.volumeDiscounts().length === 0;
  }

  getScopeLabel(scope: string): string {
    return SCOPE_LABELS[scope as ScopeType] || scope;
  }

  getScopeSeverity(scope: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' | undefined {
    return SCOPE_SEVERITIES[scope as ScopeType];
  }

  getDaysRemaining(endDate: string): number {
    return this.dateService.getDaysRemaining(endDate);
  }

  copyCode(code: string): void {
    navigator.clipboard.writeText(code);
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }

  openLightbox(imageUrl: string | undefined, name: string): void {
    if (imageUrl) {
      this.lightboxService.openSimple(imageUrl, name);
    }
  }

  getPromoImage(promo: Promotion): string | null {
    switch (promo.scope) {
      case 'category':
        return promo.category_image || null;
      case 'brand':
        return promo.brand_image || null;
      case 'product':
        return promo.product_image || null;
      default:
        return null;
    }
  }

  getPromoEntityName(promo: Promotion): string {
    switch (promo.scope) {
      case 'category':
        return promo.category_name || '';
      case 'brand':
        return promo.brand_name || '';
      case 'product':
        return promo.product_name || '';
      default:
        return '';
    }
  }

  getCrossSellDiscountLabel(deal: CrossSellPromotion): string {
    if (deal.discount_type === 'percentage') {
      return `-${deal.discount_value}%`;
    }
    const piecesPerBox = deal.target_product_pieces_per_box || 1;
    const totalDiscount = deal.discount_value * piecesPerBox;
    return `-${this.currencyService.formatCurrency(totalDiscount)}`;
  }

  getPromoDiscountLabel(promo: Promotion, withMinus = false): string {
    const prefix = withMinus ? '-' : '';
    if (promo.discount_type === 'percentage') {
      return `${prefix}${promo.discount_value}%`;
    }
    // Only show per-carton for product-scoped promotions
    if (promo.scope === 'product' && promo.product_pieces_per_box) {
      const totalDiscount = promo.discount_value * promo.product_pieces_per_box;
      return `${prefix}${this.currencyService.formatCurrency(totalDiscount)}`;
    }
    return `${prefix}${this.currencyService.formatCurrency(promo.discount_value)}`;
  }

  getPromoPerUnitLabel(promo: Promotion): string {
    // For percentage discounts, no per-unit label needed
    if (promo.discount_type === 'percentage') {
      return '';
    }

    // For product-scoped promotions, show "per carton/box/etc"
    if (promo.scope === 'product' && promo.product_packaging_type) {
      const packagingType = this.packagingTypeService.getPackagingTypeTranslated(promo.product_packaging_type);
      return this.translateService.instant('promotions_page.per_unit', { unit: packagingType });
    }

    // For global/category/brand promotions, show "per piece"
    return this.translateService.instant('promotions_page.per_piece');
  }

  getVolumeDiscountLabel(discount: VolumeDiscount): string {
    const packagingType = discount.product_packaging_type
      ? this.packagingTypeService.getPackagingTypeForCount(discount.product_packaging_type, discount.min_quantity)
      : this.translateService.instant('common.cartons');

    switch (discount.discount_type) {
      case 'percentage':
        return this.translateService.instant('promotions_page.volume.percentage', {
          qty: discount.min_quantity,
          unit: packagingType,
          percent: discount.discount_value
        });
      case 'fixed_amount':
        return this.translateService.instant('promotions_page.volume.fixed_amount', {
          qty: discount.min_quantity,
          unit: packagingType,
          amount: this.currencyService.formatCurrency(discount.discount_value)
        });
      case 'free_units':
        return this.translateService.instant('promotions_page.volume.free_units', {
          qty: discount.min_quantity,
          free: discount.discount_value,
          unit: packagingType
        });
      default:
        return '';
    }
  }

  getVolumeDiscountBadge(discount: VolumeDiscount): string {
    switch (discount.discount_type) {
      case 'percentage':
        return `-${discount.discount_value}%`;
      case 'fixed_amount':
        return `-${this.currencyService.formatCurrency(discount.discount_value)}`;
      case 'free_units':
        return `+${discount.discount_value}`;
      default:
        return '';
    }
  }
}
