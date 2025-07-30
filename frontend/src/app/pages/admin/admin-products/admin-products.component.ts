import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TagModule } from 'primeng/tag';
import { PaginatorModule } from 'primeng/paginator';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { SelectModule } from 'primeng/select';

import { ProductService } from '../../../services/product.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { TranslationHelperService } from '../../../core/services/translation-helper.service';
import { UnitsService } from '../../../core/services/units.service';
import { SearchDebounceService } from '../../../core/services/search-debounce.service';
import { ConfirmationDialogService } from '../../../core/services/confirmation-dialog.service';
import { DateService } from '../../../core/services/date.service';
import { StockStatusService } from '../../../core/services/stock-status.service';
import { Product } from '../../../models/product.model';
import { Category } from '../../../models/category.model';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { BadgeModule } from 'primeng/badge';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { TooltipModule } from 'primeng/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';


@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [
    TooltipModule,
    CommonModule,
    FormsModule,
    BadgeModule,
    OverlayBadgeModule,
    TableModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    ToastModule,
    TagModule,
    PaginatorModule,
    DialogModule,
    ConfirmDialogModule,
    SelectModule,
    IconFieldModule,
    InputIconModule,
    ProgressSpinnerModule,
    TranslateModule
  ],
  providers: [MessageService, ConfirmationService],
    templateUrl:'./admin-products.component.html',
  styleUrl: './admin-products.component.scss',
   styles: [`
    :host ::ng-deep .p-datatable-header {
      padding-left: 0 !important;
      padding-right: 0 !important;
    }
  `]
})
export class AdminProductsComponent implements OnInit {
  // State properties
  allProducts: Product[] = [];
  products: Product[] = [];
  categories: Category[] = [];
  categoryOptions: any[] = [];
  loading = true;
  searchQuery = '';
  selectedCategory = null;
  
  // Services
  private productService = inject(ProductService);
  private messageService = inject(MessageService);
  private router = inject(Router);
  private translateService = inject(TranslateService);
  private currencyService = inject(CurrencyService);
  private translationHelper = inject(TranslationHelperService);
  private unitsService = inject(UnitsService);
  private searchDebounce = inject(SearchDebounceService);
  private confirmDialog = inject(ConfirmationDialogService);
  private dateService = inject(DateService);
  private stockStatus = inject(StockStatusService);

  // Lifecycle hooks
  ngOnInit() {
    this.loadCategories();
    this.loadAllProducts();
    
    this.translateService.onLangChange.subscribe(() => {
      this.loadCategories();
    });
  }


  // Public methods
  hasActiveFilters(): boolean {
    return !!(this.searchQuery?.trim() || this.selectedCategory);
  }

  onSearchInput() {
    this.searchDebounce.debounce('products-search', () => {
      this.filterProducts();
    });
  }

  onCategoryChange() {
    this.filterProducts();
  }

  onSearch() {
    this.filterProducts();
  }

  clearFilters() {
    this.searchQuery = '';
    this.selectedCategory = null;
    this.filterProducts();
  }

  createNewProduct() {
    this.router.navigate([ROUTES.ADMIN.ADD_PRODUCT]);
  }

  editProduct(product: Product) {
    this.router.navigate([RouteHelpers.adminEditProduct(product.id)]);
  }

  viewProduct(product: Product) {
    this.router.navigate([RouteHelpers.productDetail(product.id)]);
  }

  confirmDeleteProduct(product: Product) {
    const productName = this.getProductName(product);
    this.confirmDialog.confirmDelete(productName, () => {
      this.deleteProduct(product);
    });
  }

  refreshProductData() {
    this.loadAllProducts();
  }

  getCategoryName(categoryId: number): string {
    const category = this.categories.find(cat => cat.id === categoryId) as any;
    if (!category) {
      return this.translateService.instant('common.unknown');
    }
    return this.translationHelper.getCategoryName(category);
  }

  getProductName(product: Product): string {
    return this.translationHelper.getProductName(product);
  }

  getProductDescription(product: Product): string {
    return this.translationHelper.getProductDescription(product);
  }

  getStockSeverity(stockQuantity: number): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" {
    return this.stockStatus.getStockSeverity(stockQuantity);
  }

  getStockLabel(stockQuantity: number): string {
    return this.stockStatus.getStockLabel(stockQuantity);
  }

  getUnitDisplay(unit: string): string {
    return this.unitsService.getUnitTranslated(unit, true);
  }

  formatDate(dateString: string): string {
    return this.dateService.formatDate(dateString);
  }

  formatPrice(price: number): string {
    return this.currencyService.formatCurrency(price);
  }

  // Private methods
  private loadCategories() {
    this.productService.getCategories(true).subscribe({
      next: (categories) => {
        this.categories = categories;
        const currentLang = this.translateService.currentLang;
        const options = categories.map(cat => {
          const category = cat as any;
          return {
            label: (category.name_translations && category.name_translations[currentLang]) 
              ? category.name_translations[currentLang] 
              : category.name,
            value: category.id
          };
        });
        this.categoryOptions = [
          { label: this.translateService.instant('admin.products.filters.all_categories'), value: null },
          ...options
        ];
      },
      error: (error) => {
        console.error('Error loading categories:', error);
      }
    });
  }

  private loadAllProducts() {
    this.loading = true;
    
    const filters: any = {
      active_only: false
    };
    
    this.productService.getProducts(filters).subscribe({
      next: (products) => {
        console.log('All products loaded successfully:', products.length);
        this.allProducts = products;
        this.products = products;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading products:', error);
        this.loading = false;
        
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: this.translateService.instant('admin.products.load_error')
        });
      }
    });
  }

  private filterProducts() {
    let filtered = [...this.allProducts];

    if (this.searchQuery?.trim()) {
      const search = this.searchQuery.toLowerCase();
      filtered = filtered.filter(product => 
        this.getProductName(product).toLowerCase().includes(search) ||
        this.getProductDescription(product).toLowerCase().includes(search) ||
        this.getCategoryName(product.category_id).toLowerCase().includes(search)
      );
    }

    if (this.selectedCategory) {
      filtered = filtered.filter(product => 
        product.category_id === this.selectedCategory
      );
    }

    this.products = filtered;
    console.log(`Filtered ${filtered.length} products from ${this.allProducts.length} total`);
  }

  private deleteProduct(product: Product) {
    this.productService.deleteProduct(product.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('common.success'),
          detail: this.translateService.instant('admin.products.delete_success')
        });
        
        this.allProducts = this.allProducts.filter(p => p.id !== product.id);
        this.filterProducts();
      },
      error: (error) => {
        console.error('Error deleting product:', error);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: error.error?.detail || this.translateService.instant('admin.products.delete_failed')
        });
      }
    });
  }

}