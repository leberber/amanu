import { Component, OnInit, inject, DestroyRef, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';

import { ADMIN_CORE_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { DoughnutChartComponent, DoughnutChartItem } from '../../../shared/components/charts';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { UI } from '../../../core/constants/ui.constants';
import { onLanguageChange } from '../../../core/utils/language-change.util';
import { AdminService } from '../../../services/admin.service';
import { DashboardStats } from '../../../models/admin.model';
import { ProductService } from '../../../services/product.service';
import { BrandService } from '../../../core/services/brand.service';
import { Product, Category } from '../../../models/product.model';
import { Brand } from '../../../models/brand.model';
import { TranslationHelperService } from '../../../core/services/translation-helper.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { ImageFallbackDirective } from '../../../shared/directives/image-fallback.directive';

// Translatable entity interface for helper functions
interface TranslatableEntity {
  id?: number;
  name?: string;
  name_translations?: { [key: string]: string };
  category_id?: number;
  brand_id?: number;
  product_id?: number;
  product_name?: string;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    ...ADMIN_CORE_IMPORTS,
    RouterLink,
    AgroclikPageContainerComponent,
    DoughnutChartComponent,
    ImageFallbackDirective
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss'
})
export class AdminDashboardComponent implements OnInit {
  // Data signals
  stats = signal<DashboardStats | null>(null);
  loading = signal(true);
  products = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  brands = signal<Brand[]>([]);

  // UI state signals
  tableInitialized = signal(false);

  // Chart data signals (simplified for reusable components)
  categoryChartData = signal<DoughnutChartItem[]>([]);
  brandChartData = signal<DoughnutChartItem[]>([]);

  // Tab state
  activeTab = signal<'analytics' | 'top-products' | 'insights'>('analytics');

  // Computed values
  hasStats = computed(() => this.stats() !== null);

  // Route helpers
  readonly RouteHelpers = RouteHelpers;

  // Services
  private adminService = inject(AdminService);
  private router = inject(Router);
  private toast = inject(ToastMessageService);
  private translateService = inject(TranslateService);
  private productService = inject(ProductService);
  private brandService = inject(BrandService);
  private translationHelper = inject(TranslationHelperService);
  private currencyService = inject(CurrencyService);
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    this.loadAllData();
    onLanguageChange(this.translateService, this.destroyRef, () => this.prepareChartData());
  }

  loadAllData() {
    this.loading.set(true);

    forkJoin({
      stats: this.adminService.getDashboardStats(),
      products: this.productService.getProducts(),
      categories: this.productService.getCategories(),
      brands: this.brandService.getBrands()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.stats.set(result.stats);
          this.products.set(result.products || []);
          this.categories.set(result.categories || []);
          this.brands.set(result.brands || []);
          this.loading.set(false);
          this.prepareChartData();
          setTimeout(() => this.tableInitialized.set(true), UI.TABLE_INIT_DELAY);
        },
        error: (error) => {
          this.loading.set(false);
          if (error.status === 403) {
            this.toast.showPermissionDenied();
            this.router.navigate([ROUTES.HOME]);
          } else {
            this.toast.showError('admin.dashboard.load_error');
          }
        }
      });
  }

  prepareChartData() {
    const currentStats = this.stats();
    if (!currentStats) return;

    // Prepare category chart data
    this.categoryChartData.set(
      currentStats.sales_by_category.map(item => ({
        label: this.getCategoryName(item),
        value: item.total_sales
      }))
    );

    // Prepare brand chart data
    this.brandChartData.set(
      currentStats.sales_by_brand.map(item => ({
        label: this.getBrandName(item),
        value: item.total_sales
      }))
    );
  }

  // Navigation methods
  navigateToOrders() {
    this.router.navigate([ROUTES.ADMIN.ORDERS]);
  }

  navigateToUsers() {
    this.router.navigate([ROUTES.ADMIN.USERS]);
  }

  navigateToProducts() {
    this.router.navigate([ROUTES.ADMIN.PRODUCTS]);
  }

  navigateToCategories() {
    this.router.navigate([ROUTES.ADMIN.CATEGORIES]);
  }

  navigateToBrands() {
    this.router.navigate([ROUTES.ADMIN.BRANDS]);
  }

  // Tab navigation
  setActiveTab(tab: 'analytics' | 'top-products' | 'insights') {
    this.activeTab.set(tab);
  }

  // Translation helpers - handle various entity shapes from dashboard stats
  getCategoryName(category: TranslatableEntity | string): string {
    if (typeof category === 'string') {
      if (this.categories().length > 0) {
        const fullCategory = this.categories().find(c => c.name === category);
        if (fullCategory) {
          return this.translationHelper.getCategoryName(fullCategory);
        }
        const matchingCategory = this.categories().find(c => {
          if (c.name_translations) {
            return Object.values(c.name_translations).includes(category);
          }
          return false;
        });
        if (matchingCategory) {
          return this.translationHelper.getCategoryName(matchingCategory);
        }
      }
      return category;
    }

    if (category.name_translations || category.name) {
      return this.translationHelper.getCategoryName(category as Category);
    }

    if (category.category_id && this.categories().length > 0) {
      const fullCategory = this.categories().find(c => c.id === category.category_id);
      if (fullCategory) {
        return this.translationHelper.getCategoryName(fullCategory);
      }
    }

    return category.name || '';
  }

  getBrandName(brand: TranslatableEntity): string {
    if (brand.name_translations || brand.name) {
      return this.translationHelper.getBrandName(brand as Brand);
    }

    if (brand.brand_id && this.brands().length > 0) {
      const fullBrand = this.brands().find(b => b.id === brand.brand_id);
      if (fullBrand) {
        return this.translationHelper.getBrandName(fullBrand);
      }
    }

    return brand.name || '';
  }

  getProductName(product: TranslatableEntity): string {
    if (product.name_translations || (product.name && !product.product_id)) {
      return this.translationHelper.getProductName(product as Product);
    }

    if (product.product_id && this.products().length > 0) {
      const fullProduct = this.products().find(p => p.id === product.product_id);
      if (fullProduct) {
        return this.translationHelper.getProductName(fullProduct);
      }
    }

    return product.product_name || product.name || '';
  }

  formatCurrency(value: number): string {
    return this.currencyService.formatCurrency(value);
  }
}
