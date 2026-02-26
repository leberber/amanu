import { Component, OnInit, inject, DestroyRef, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, Router } from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { TranslateService } from '@ngx-translate/core';

import { ADMIN_CORE_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { ROUTES } from '../../../core/constants/routes.constants';
import { onLanguageChange } from '../../../core/utils/language-change.util';
import { AdminService } from '../../../services/admin.service';
import { DashboardStats } from '../../../models/admin.model';
import { ProductService } from '../../../services/product.service';
import { BrandService } from '../../../core/services/brand.service';
import { TranslationHelperService } from '../../../core/services/translation-helper.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { CurrencyService } from '../../../core/services/currency.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    ...ADMIN_CORE_IMPORTS,
    RouterLink,
    ChartModule
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss'
})
export class AdminDashboardComponent implements OnInit {
  // Data signals
  stats = signal<DashboardStats | null>(null);
  loading = signal(true);
  products = signal<any[]>([]);
  categories = signal<any[]>([]);
  brands = signal<any[]>([]);

  // UI state signals
  tableInitialized = signal(false);

  // Chart data signals
  categoryChartData = signal<any>(null);
  categoryChartOptions = signal<any>(null);
  brandChartData = signal<any>(null);
  brandChartOptions = signal<any>(null);

  // Tab state
  activeTab = signal<'analytics' | 'top-products' | 'insights'>('analytics');

  // Computed values
  hasStats = computed(() => this.stats() !== null);

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
    this.loadDashboardStats();
    this.loadProductsAndCategories();
    this.loadBrands();
    onLanguageChange(this.translateService, this.destroyRef, () => this.prepareChartData());
  }

  loadProductsAndCategories() {
    this.productService.getProducts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (products) => {
          this.products.set(products || []);
          if (this.stats()) {
            this.prepareChartData();
          }
        }
      });

    this.productService.getCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories: any) => {
          this.categories.set(categories || []);
          if (this.stats()) {
            this.prepareChartData();
          }
        }
      });
  }

  loadBrands() {
    this.brandService.getBrands()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (brands) => {
          this.brands.set(brands || []);
          if (this.stats()) {
            this.prepareChartData();
          }
        }
      });
  }

  loadDashboardStats() {
    this.loading.set(true);
    this.adminService.getDashboardStats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (stats) => {
          this.stats.set(stats);
          this.loading.set(false);
          this.prepareChartData();
          setTimeout(() => this.tableInitialized.set(true), 100);
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

    this.prepareCategoryChart(currentStats);
    this.prepareBrandChart(currentStats);
  }

  private prepareCategoryChart(stats: DashboardStats) {
    const categoryLabels = stats.sales_by_category.map(item => this.getCategoryName(item));
    const categorySales = stats.sales_by_category.map(item => item.total_sales);

    this.categoryChartData.set({
      labels: categoryLabels,
      datasets: [{
        label: this.translateService.instant('admin.dashboard.sales_by_category'),
        data: categorySales,
        backgroundColor: [
          '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
          '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6'
        ],
        hoverBackgroundColor: [
          '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6',
          '#fb7185', '#fb923c', '#facc15', '#4ade80', '#2dd4bf'
        ],
        borderWidth: 0,
        hoverOffset: 8
      }]
    });

    this.categoryChartOptions.set(this.getChartOptions());
  }

  private prepareBrandChart(stats: DashboardStats) {
    const brandLabels = stats.sales_by_brand.map(item => this.getBrandName(item));
    const brandSales = stats.sales_by_brand.map(item => item.total_sales);

    this.brandChartData.set({
      labels: brandLabels,
      datasets: [{
        label: this.translateService.instant('admin.dashboard.sales_by_brand'),
        data: brandSales,
        backgroundColor: [
          '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#22c55e',
          '#84cc16', '#eab308', '#f59e0b', '#f97316', '#ef4444'
        ],
        hoverBackgroundColor: [
          '#38bdf8', '#22d3ee', '#2dd4bf', '#34d399', '#4ade80',
          '#a3e635', '#facc15', '#fbbf24', '#fb923c', '#f87171'
        ],
        borderWidth: 0,
        hoverOffset: 8
      }]
    });

    this.brandChartOptions.set(this.getChartOptions());
  }

  private getChartOptions(): any {
    return {
      cutout: '55%',
      radius: '85%',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 20,
            font: {
              size: 12,
              weight: '500'
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleFont: { size: 14, weight: 'bold' },
          bodyFont: { size: 13 },
          padding: 12,
          cornerRadius: 8,
          displayColors: true,
          boxPadding: 6,
          callbacks: {
            label: (context: any) => {
              const label = context.label || '';
              const value = context.raw || 0;
              const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${label}: ${this.currencyService.formatCurrency(value)} (${percentage}%)`;
            }
          }
        }
      },
      animation: {
        animateRotate: true,
        animateScale: true
      },
      locale: this.translateService.currentLang === 'ar' ? 'ar-SA' : this.translateService.currentLang
    };
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

  // Translation helpers
  getCategoryName(category: any): string {
    if (category.name_translations || category.name) {
      return this.translationHelper.getCategoryName(category);
    }

    if (category.category_id && this.categories().length > 0) {
      const fullCategory = this.categories().find(c => c.id === category.category_id);
      if (fullCategory) {
        return this.translationHelper.getCategoryName(fullCategory);
      }
    }

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

    return category.name || category;
  }

  getBrandName(brand: any): string {
    if (brand.name_translations || brand.name) {
      return this.translationHelper.getBrandName(brand);
    }

    if (brand.brand_id && this.brands().length > 0) {
      const fullBrand = this.brands().find(b => b.id === brand.brand_id);
      if (fullBrand) {
        return this.translationHelper.getBrandName(fullBrand);
      }
    }

    return brand.name || brand;
  }

  getProductName(product: any): string {
    if (product.name_translations || product.name) {
      return this.translationHelper.getProductName(product);
    }

    if (product.product_id && this.products().length > 0) {
      const fullProduct = this.products().find(p => p.id === product.product_id);
      if (fullProduct) {
        return this.translationHelper.getProductName(fullProduct);
      }
    }

    return product.product_name || product.name;
  }

  formatCurrency(value: number): string {
    return this.currencyService.formatCurrency(value);
  }
}
