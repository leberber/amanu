// src/app/pages/admin/admin-dashboard/admin-dashboard.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';

import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { ChartModule } from 'primeng/chart';
import { MessageService } from 'primeng/api';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AdminService } from '../../../services/admin.service'; 
import { DashboardStats } from '../../../models/admin.model';
import { ProductService } from '../../../services/product.service';
import { DateService } from '../../../core/services/date.service';
import { TranslationHelperService } from '../../../core/services/translation-helper.service';
import { StatusSeverityService } from '../../../core/services/status-severity.service';

// REMOVED: AdminAddProductComponent and AdminAddCategoryComponent imports
// REMOVED: ViewChild decorators and modal methods

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CardModule,
    ButtonModule,
    TableModule,
    ToastModule,
    ChartModule,
    TagModule,
    ProgressSpinnerModule,
    TranslateModule
    // REMOVED: AdminAddProductComponent, AdminAddCategoryComponent
  ],
  providers: [MessageService],
  templateUrl: './admin-dashboard.component.html'

})
export class AdminDashboardComponent implements OnInit {

  // REMOVED: ViewChild references and modal methods

  stats: DashboardStats | null = null;
  loading = true;
  salesChartData: any;
  salesChartOptions: any;
  categoryChartData: any;
  categoryChartOptions: any;
  products: any[] = [];
  categories: any[] = [];

  // Services injected using inject()
  private adminService = inject(AdminService);
  private router = inject(Router);
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService);
  private productService = inject(ProductService);
  private dateService = inject(DateService);
  private translationHelper = inject(TranslationHelperService);
  private statusSeverity = inject(StatusSeverityService);

  ngOnInit() {
    this.loadDashboardStats();
    this.loadProductsAndCategories();
    this.translateService.onLangChange.subscribe(() => {
      this.prepareChartData();
    });
  }
  
  loadProductsAndCategories() {
    // Load products to get translations
    this.productService.getProducts().subscribe({
      next: (products) => {
        this.products = products || [];
        // Re-prepare chart data after loading products
        if (this.stats) {
          this.prepareChartData();
        }
      },
      error: (error) => {
        console.error('Error loading products:', error);
      }
    });
    
    // Load categories to get translations
    this.productService.getCategories().subscribe({
      next: (categories: any) => {
        this.categories = categories || [];
        // Re-prepare chart data after loading categories
        if (this.stats) {
          this.prepareChartData();
        }
      },
      error: (error: any) => {
        console.error('Error loading categories:', error);
      }
    });
  }

  loadDashboardStats() {
    this.loading = true;
    this.adminService.getDashboardStats().subscribe({
      next: (stats) => {
        this.stats = stats;
        this.loading = false;
        this.prepareChartData();
      },
      error: (error) => {
        console.error('Error loading dashboard stats:', error);
        this.loading = false;
        
        let errorMessage = this.translateService.instant('admin.dashboard.load_error');
        if (error.status === 403) {
          errorMessage = this.translateService.instant('admin.dashboard.permission_error');
          this.router.navigate(['/']);
        }
        
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: errorMessage
        });
      }
    });
  }

  prepareChartData() {
    if (!this.stats) return;

    // Sales by category chart
    const categoryLabels = this.stats.sales_by_category.map(item => this.getCategoryName(item));
    const categorySales = this.stats.sales_by_category.map(item => item.total_sales);
    
    this.categoryChartData = {
      labels: categoryLabels,
      datasets: [
        {
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
        }
      ]
    };
    
    this.categoryChartOptions = {
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
              const currencySymbol = this.translateService.currentLang === 'ar' ? 'د.ج' : '$';
              return `${label}: ${currencySymbol}${value.toFixed(2)}`;
            }
          }
        }
      },
      locale: this.translateService.currentLang === 'ar' ? 'ar-SA' : this.translateService.currentLang
    };
  }

  getStatusSeverity(status: string): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" {
    return this.statusSeverity.getOrderStatusSeverity(status);
  }

  formatDate(dateString: string): string {
    return this.dateService.formatDate(dateString);
  }

  // UPDATED: All navigation methods now use routing instead of modals
  navigateToOrders() {
    this.router.navigate(['/admin/orders']);
  }

  navigateToUsers() {
    this.router.navigate(['/admin/users']);
  }

  navigateToProducts() {
    this.router.navigate(['/admin/products']);
  }

  // NEW: Navigate to add product page instead of opening modal
  navigateToAddProduct() {
    this.router.navigate(['/admin/products/add']);
  }

  // NEW: Navigate to add category page (you can implement this later)
  // navigateToAddCategory() {
  //   // For now, show a message. You can create a similar page for categories later
  //   this.messageService.add({
  //     severity: 'info',
  //     summary: 'Coming Soon',
  //     detail: 'Add Category page will be available soon'
  //   });
  // }

    navigateToAddCategory() {
  this.router.navigate(['/admin/categories/add']);
}
navigateToCategories() {
  this.router.navigate(['/admin/categories']);
}

  getCategoryName(category: any): string {
    // If it's already a category object with translations
    if (category.name_translations || category.name) {
      return this.translationHelper.getCategoryName(category);
    }
    
    // For sales by category, try to find the full category object
    if (category.category_id && this.categories.length > 0) {
      const fullCategory = this.categories.find(c => c.id === category.category_id);
      if (fullCategory) {
        return this.translationHelper.getCategoryName(fullCategory);
      }
    }
    
    // For top selling products, category is just a string
    if (typeof category === 'string') {
      if (this.categories.length > 0) {
        // Try to find by name
        const fullCategory = this.categories.find(c => c.name === category);
        if (fullCategory) {
          return this.translationHelper.getCategoryName(fullCategory);
        }
        // Try to match by name in any language
        const matchingCategory = this.categories.find(c => {
          if (c.name_translations) {
            return Object.values(c.name_translations).includes(category);
          }
          return false;
        });
        if (matchingCategory) {
          return this.translationHelper.getCategoryName(matchingCategory);
        }
      }
      // Return the string as is if we can't find a match
      return category;
    }
    
    return category.name || category;
  }

  getProductName(product: any): string {
    // If it's already a product object with translations
    if (product.name_translations || product.name) {
      return this.translationHelper.getProductName(product);
    }
    
    // For top selling products, try to find the full product object
    if (product.product_id && this.products.length > 0) {
      const fullProduct = this.products.find(p => p.id === product.product_id);
      if (fullProduct) {
        return this.translationHelper.getProductName(fullProduct);
      }
    }
    
    // For top selling products, the name field might be used instead of product_name
    return product.product_name || product.name;
  }
}