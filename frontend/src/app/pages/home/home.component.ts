// frontend/src/app/pages/home/home.component.ts
import { Component, inject, OnInit, OnDestroy, signal, DestroyRef, HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { TranslateModule } from '@ngx-translate/core';
import { ProductService } from '../../services/product.service';
import { BrandService } from '../../core/services/brand.service';
import { SegmentService } from '../../core/services/segment.service';
import { TranslationService } from '../../services/translation.service';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { TranslationHelperService } from '../../core/services/translation-helper.service';
import { AuthService } from '../../services/auth.service';
import { HomeScrollService } from '../../core/services/home-scroll.service';
import { Category, Product } from '../../models/product.model';
import { Brand } from '../../models/brand.model';
import { Segment } from '../../models/segment.model';
import { ROUTES } from '../../core/constants/routes.constants';
import { ImageFallbackDirective } from '../../shared/directives/image-fallback.directive';
import { RevealDirective } from '../../shared/directives/reveal.directive';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, ButtonModule, TranslateModule, ImageFallbackDirective, RevealDirective, DecimalPipe],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, OnDestroy {
  readonly authService = inject(AuthService);
  private homeScroll = inject(HomeScrollService);
  private productService = inject(ProductService);
  private brandService = inject(BrandService);
  private segmentService = inject(SegmentService);
  private translationService = inject(TranslationService);
  private translationHelper = inject(TranslationHelperService);
  private toast = inject(ToastMessageService);
  private destroyRef = inject(DestroyRef);

  readonly ROUTES = ROUTES;
  readonly currentYear = new Date().getFullYear();

  private readonly segmentVisuals: Record<string, { emoji?: string; icon?: string; colorFrom: string; colorTo: string; lightBg: string; iconColor: string }> = {
    cafeteria:    { emoji: '☕', colorFrom: '#92400e', colorTo: '#d97706', lightBg: '#fef3c7', iconColor: '#d97706' },
    restaurant:   { emoji: '🍽️', colorFrom: '#991b1b', colorTo: '#ef4444', lightBg: '#fee2e2', iconColor: '#ef4444' },
    fastfood:     { emoji: '🍔', colorFrom: '#c2410c', colorTo: '#f97316', lightBg: '#ffedd5', iconColor: '#f97316' },
    boulangerie:  { emoji: '🥖', colorFrom: '#78350f', colorTo: '#f59e0b', lightBg: '#fef3c7', iconColor: '#f59e0b' },
    patisserie:   { emoji: '🧁', colorFrom: '#9d174d', colorTo: '#ec4899', lightBg: '#fce7f3', iconColor: '#ec4899' },
    alimentation: { icon: 'pi pi-shopping-bag', colorFrom: '#166534', colorTo: '#22c55e', lightBg: '#dcfce7', iconColor: '#16a34a' },
    librairie:    { icon: 'pi pi-book', colorFrom: '#1e3a8a', colorTo: '#3b82f6', lightBg: '#dbeafe', iconColor: '#3b82f6' },
    salle_fetes:  { emoji: '🎊', colorFrom: '#4c1d95', colorTo: '#8b5cf6', lightBg: '#ede9fe', iconColor: '#8b5cf6' },
  };
  private readonly defaultVisuals = { icon: 'pi pi-tag', colorFrom: '#581c87', colorTo: '#a855f7', lightBg: '#f3e8ff', iconColor: '#9333ea' };

  segments = signal<Segment[]>([]);

  promoProducts = signal<Product[]>([]);
  newProducts = signal<Product[]>([]);
  private rawCategories = signal<Category[]>([]);

  categories = signal<Array<{
    id: number;
    name: string;
    image: string;
  }>>([]);

  brands = signal<Brand[]>([]);

  getSegmentVisuals(name: string) {
    return this.segmentVisuals[name] ?? this.defaultVisuals;
  }

  ngOnInit(): void {
    this.loadCategories();
    this.loadBrands();
    this.loadNewProducts();
    this.loadPromoProducts();
    this.loadSegments();

    this.translationService.currentLanguage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.transformCategories());
  }

  private loadSegments(): void {
    this.segmentService.getSegments()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (s) => this.segments.set(s), error: () => {} });
  }

  private loadPromoProducts(): void {
    this.productService.getProducts({ active_only: true, limit: 50 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (products) => this.promoProducts.set(products.filter(p => p.promotion).slice(0, 10)),
        error: () => {}
      });
  }

  private loadNewProducts(): void {
    this.productService.getProducts({ new_only: true, limit: 10, active_only: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (p) => this.newProducts.set(p), error: () => {} });
  }

  private loadCategories(): void {
    this.productService.getCategories(true).subscribe({
      next: (apiCategories: Category[]) => {
        this.rawCategories.set(apiCategories);
        this.transformCategories();
      },
      error: (error) => {
        this.toast.showApiError(error, 'errors.load_categories_failed');
      }
    });
  }

  private loadBrands(): void {
    this.brandService.getBrands(true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (brands) => this.brands.set(brands),
        error: () => {}
      });
  }

  private transformCategories(): void {
    const transformed = this.rawCategories().map(category => ({
      id: category.id,
      name: this.translationHelper.getCategoryName(category),
      image: category.image_url || ''
    }));
    this.categories.set(transformed);
  }

  @HostListener('scroll', ['$event.target'])
  onScroll(el: HTMLElement): void {
    this.homeScroll.scrolledDown.set(el.scrollTop > 150);
    this.homeScroll.nearFooter.set(
      el.scrollTop + el.clientHeight > el.scrollHeight - 280
    );
  }

  ngOnDestroy(): void {
    this.homeScroll.reset();
  }
}
