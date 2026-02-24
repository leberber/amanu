// src/app/pages/admin/admin-dashboard/admin-dashboard.component.ts
import { Component, OnInit, inject, DestroyRef, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ChartModule } from 'primeng/chart';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { InputTextModule } from 'primeng/inputtext';
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
    CardModule,
    TableModule,
    ChartModule,
    TagModule,
    ProgressSpinnerModule,
    InputTextModule
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
          '#42A5F5', '#66BB6A', '#FFA726', '#26C6DA', '#7E57C2',
          '#EC407A', '#AB47BC', '#5C6BC0', '#29B6F6', '#26A69A'
        ],
        hoverBackgroundColor: [
          '#64B5F6', '#81C784', '#FFB74D', '#4DD0E1', '#9575CD',
          '#F06292', '#BA68C8', '#7986CB', '#4FC3F7', '#4DB6AC'
        ]
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
          '#7E57C2', '#EC407A', '#26C6DA', '#66BB6A', '#FFA726',
          '#42A5F5', '#AB47BC', '#5C6BC0', '#29B6F6', '#26A69A'
        ],
        hoverBackgroundColor: [
          '#9575CD', '#F06292', '#4DD0E1', '#81C784', '#FFB74D',
          '#64B5F6', '#BA68C8', '#7986CB', '#4FC3F7', '#4DB6AC'
        ]
      }]
    });

    this.brandChartOptions.set(this.getChartOptions());
  }

  private getChartOptions(): any {
    return {
      plugins: {
        legend: {
          position: 'right',
          labels: {
            usePointStyle: true,
            padding: 15
          }
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const label = context.label || '';
              const value = context.raw || 0;
              return `${label}: ${this.currencyService.formatCurrency(value)}`;
            }
          }
        }
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
