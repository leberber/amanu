// frontend/src/app/pages/home/home.component.ts
import { Component, inject, OnInit, OnDestroy, signal, DestroyRef, HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { TranslateModule } from '@ngx-translate/core';
import { ProductService } from '../../services/product.service';
import { BrandService } from '../../core/services/brand.service';
import { TranslationService } from '../../services/translation.service';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { TranslationHelperService } from '../../core/services/translation-helper.service';
import { AuthService } from '../../services/auth.service';
import { HomeScrollService } from '../../core/services/home-scroll.service';
import { Category, Product } from '../../models/product.model';
import { Brand } from '../../models/brand.model';
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
  private translationService = inject(TranslationService);
  private translationHelper = inject(TranslationHelperService);
  private toast = inject(ToastMessageService);
  private destroyRef = inject(DestroyRef);

  readonly ROUTES = ROUTES;
  readonly currentYear = new Date().getFullYear();

  readonly segments = [
    {
      label: 'Cafétéria',
      description: 'Boissons, snacks et consommables pour votre espace café',
      icon: '',
      emoji: '☕',
      colorFrom: '#92400e',
      colorTo: '#d97706',
      lightBg: '#fef3c7',
      iconColor: '#d97706',
    },
    {
      label: 'Librairie',
      description: 'Fournitures scolaires, papeterie et articles de bureau',
      icon: 'pi pi-book',
      colorFrom: '#1e3a8a',
      colorTo: '#3b82f6',
      lightBg: '#dbeafe',
      iconColor: '#3b82f6',
    },
    {
      label: 'Alimentation',
      description: 'Épicerie, conserves, produits secs et frais',
      icon: 'pi pi-shopping-bag',
      colorFrom: '#166534',
      colorTo: '#22c55e',
      lightBg: '#dcfce7',
      iconColor: '#16a34a',
    },
    {
      label: 'Général',
      description: 'Tous les produits disponibles dans notre catalogue',
      icon: 'pi pi-shopping-cart',
      colorFrom: '#581c87',
      colorTo: '#a855f7',
      lightBg: '#f3e8ff',
      iconColor: '#9333ea',
    },
  ];

  promoProducts = signal<Product[]>([]);
  newProducts = signal<Product[]>([]);
  private rawCategories = signal<Category[]>([]);

  categories = signal<Array<{
    id: number;
    name: string;
    image: string;
  }>>([]);

  brands = signal<Brand[]>([]);

  ngOnInit(): void {
    this.loadCategories();
    this.loadBrands();
    this.loadNewProducts();
    this.loadPromoProducts();

    this.translationService.currentLanguage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.transformCategories());
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
