import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';

import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { CurrencyService } from '../../core/services/currency.service';
import { PackagingTypeService } from '../../core/services/packaging-type.service';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { OverlayService } from '../../core/services/overlay.service';
import { CrossSellNotificationService } from '../../core/services/cross-sell-notification.service';
import { TranslationService } from '../../services/translation.service';
import { Product } from '../../models/product.model';
import {
  ProductCardComponent,
  AddToCartEvent,
  QuantitySelectorEvent
} from '../products/components/product-card/product-card.component';
import { CurrencyDisplayComponent } from '../../shared/components/currency-display/currency-display.component';
import { UnitPipe } from '../../shared/pipes/unit.pipe';
import { ImageFallbackDirective } from '../../shared/directives/image-fallback.directive';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ANIMATION, UI } from '../../core/constants/ui.constants';
import { DEFAULTS } from '../../core/constants/app.constants';
import { getEffectivePrice as calcEffectivePrice } from '../../shared/utils/discount.utils';
import { generateBoxOptions, BoxOption } from '../../shared/utils/box-options.utils';

@Component({
  selector: 'app-new-arrivals',
  standalone: true,
  imports: [
    TranslateModule,
    ProductCardComponent,
    CurrencyDisplayComponent,
    UnitPipe,
    ImageFallbackDirective,
    PageLayoutComponent,
    EmptyStateComponent
  ],
  templateUrl: './new-arrivals.component.html',
  styleUrl: './new-arrivals.component.scss'
})
export class NewArrivalsComponent implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly cartService = inject(CartService);
  protected readonly currencyService = inject(CurrencyService);
  private readonly packagingTypeService = inject(PackagingTypeService);
  private readonly toast = inject(ToastMessageService);
  private readonly overlayService = inject(OverlayService);
  private readonly crossSellNotification = inject(CrossSellNotificationService);
  private readonly translationService = inject(TranslationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly animationDelayMs = ANIMATION.STAGGER_DELAY;
  readonly skeletonGridItems = Array.from({ length: UI.SKELETON_GRID_COUNT }, (_, i) => i + 1);

  products = signal<Product[]>([]);
  loading = signal(true);
  error = signal(false);
  selectedBoxOptions: Record<number, BoxOption | null> = {};
  showQuantitySelector = signal(false);
  activeProduct = signal<Product | null>(null);

  ngOnInit(): void {
    // BehaviorSubject emits immediately on subscribe, so no separate load call needed
    this.translationService.currentLanguage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadProducts());
  }

  loadProducts(): void {
    this.loading.set(true);
    this.error.set(false);
    this.productService.getProducts({ new_only: true, active_only: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (products) => {
          this.products.set(products);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        }
      });
  }

  onAddToCart(event: AddToCartEvent): void {
    const result = this.cartService.setQuantity(event.product, event.quantity);
    if (result) {
      this.crossSellNotification.checkAndNotify(event.product.id, event.product.name);
    } else {
      this.toast.showError('products.cart.error');
    }
  }

  onQuantitySelectorOpen(event: QuantitySelectorEvent): void {
    this.activeProduct.set(event.product);
    this.showQuantitySelector.set(true);
    this.overlayService.open('quantity-overlay-open');
    this.initializeBoxOption(event.product, this.cartService.getQuantity(event.product.id));
  }

  getSelectedBoxOption(productId: number): BoxOption | null {
    if (!this.selectedBoxOptions[productId]) {
      const product = this.products().find(p => p.id === productId);
      if (product) {
        this.initializeBoxOption(product, this.cartService.getQuantity(productId));
      }
    }
    return this.selectedBoxOptions[productId] ?? null;
  }

  private initializeBoxOption(product: Product, cartQuantity = 0): void {
    const options = this.getBoxOptions(product);
    if (options.length === 0) return;
    if (cartQuantity > 0) {
      const matchingOption = options.find(opt => opt.pieces === cartQuantity);
      this.selectedBoxOptions[product.id] = matchingOption ?? options[0];
    } else if (!this.selectedBoxOptions[product.id]) {
      this.selectedBoxOptions[product.id] = options[0];
    }
  }

  closeQuantitySelector(): void {
    this.showQuantitySelector.set(false);
    this.activeProduct.set(null);
    this.overlayService.close('quantity-overlay-open');
  }

  selectBoxOption(option: BoxOption): void {
    const product = this.activeProduct();
    if (product) {
      this.selectedBoxOptions[product.id] = option;
    }
  }

  confirmQuantitySelection(): void {
    const product = this.activeProduct();
    const option = product ? this.selectedBoxOptions[product.id] : null;
    this.closeQuantitySelector();
    if (product && option) {
      const result = this.cartService.setQuantity(product, option.pieces);
      if (result) {
        this.crossSellNotification.checkAndNotify(product.id, product.name);
      } else {
        this.toast.showError('products.cart.error');
      }
    }
  }

  getBoxOptions(product: Product): BoxOption[] {
    return generateBoxOptions(product, this.currencyService);
  }

  getPackagingTypeForCount(product: Product, count: number): string {
    return this.packagingTypeService.getPackagingTypeForCount(product.packaging_type ?? 'carton', count);
  }

  getEffectivePrice(product: Product): number {
    return calcEffectivePrice(product.price, product.promotion);
  }

  getProductImageUrl(product: Product): string {
    return product.image_url ?? DEFAULTS.PLACEHOLDER_IMAGE;
  }

  getPiecesLabel(count: number): string {
    return count === 1
      ? 'products.product.quantity_selector.piece'
      : 'products.product.quantity_selector.pieces';
  }
}
