import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { PaginatorModule } from 'primeng/paginator';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { SelectModule } from 'primeng/select';

import { ProductService } from '../../../services/product.service';
import { BrandService } from '../../../core/services/brand.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { TranslationHelperService } from '../../../core/services/translation-helper.service';
import { UnitsService } from '../../../core/services/units.service';
import { SearchDebounceService } from '../../../core/services/search-debounce.service';
import { DateService } from '../../../core/services/date.service';
import { StockStatusService } from '../../../core/services/stock-status.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { Product } from '../../../models/product.model';
import { Category } from '../../../models/category.model';
import { Brand } from '../../../models/brand.model';
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
  providers: [ConfirmationService],
  templateUrl: './admin-products.component.html',
  styleUrl: './admin-products.component.scss'
})
export class AdminProductsComponent implements OnInit {
  // State properties
  allProducts: Product[] = [];
  products: Product[] = [];
  paginatedProducts: Product[] = [];
  categories: Category[] = [];
  brands: Brand[] = [];
  loading = true;
  searchQuery = '';

  // Pagination
  first = 0;
  rows = 10;

  // Status filter
  statusFilter: 'all' | 'active' | 'inactive' = 'all';

  // Category filter
  categoryFilter: number | null = null;
  showCategoryDropdown = false;

  // Brand filter
  brandFilter: number | null = null;
  showBrandDropdown = false;

  // Inline editing state
  editingPriceProductId: number | null = null;
  editingPrice: number = 0;
  editingStockProductId: number | null = null;
  editingStock: number = 0;
  
  // Services
  private productService = inject(ProductService);
  private brandService = inject(BrandService);
  private toast = inject(ToastMessageService);
  private router = inject(Router);
  private translateService = inject(TranslateService);
  private currencyService = inject(CurrencyService);
  private translationHelper = inject(TranslationHelperService);
  private unitsService = inject(UnitsService);
  private searchDebounce = inject(SearchDebounceService);
  private confirmationService = inject(ConfirmationService);
  private dateService = inject(DateService);
  private stockStatus = inject(StockStatusService);

  // Lifecycle hooks
  ngOnInit() {
    this.loadCategories();
    this.loadBrands();
    this.loadAllProducts();

    this.translateService.onLangChange.subscribe(() => {
      this.loadCategories();
      this.loadBrands();
    });
  }


  // Public methods
  hasActiveFilters(): boolean {
    return !!(this.searchQuery?.trim() || this.categoryFilter || this.brandFilter || this.statusFilter !== 'all');
  }

  // Status filter methods
  onStatusFilterChange(status: 'all' | 'active' | 'inactive') {
    this.statusFilter = status;
    this.first = 0;
    this.filterProducts();
  }

  getActiveCount(): number {
    return this.allProducts.filter(p => p.is_active).length;
  }

  getInactiveCount(): number {
    return this.allProducts.filter(p => !p.is_active).length;
  }

  // Category filter methods
  toggleCategoryDropdown(): void {
    this.showCategoryDropdown = !this.showCategoryDropdown;
    this.showBrandDropdown = false; // Close other dropdown
  }

  selectCategory(categoryId: number | null): void {
    this.categoryFilter = categoryId;
    this.showCategoryDropdown = false;
    this.first = 0;
    this.filterProducts();
  }

  getCategoryProductCount(categoryId: number): number {
    return this.allProducts.filter(p => p.category_id === categoryId).length;
  }

  // Brand filter methods
  toggleBrandDropdown(): void {
    this.showBrandDropdown = !this.showBrandDropdown;
    this.showCategoryDropdown = false; // Close other dropdown
  }

  selectBrand(brandId: number | null): void {
    this.brandFilter = brandId;
    this.showBrandDropdown = false;
    this.first = 0;
    this.filterProducts();
  }

  getBrandProductCount(brandId: number): number {
    return this.allProducts.filter(p => p.brand_id === brandId).length;
  }

  // Pagination methods
  onPageChange(event: any) {
    this.first = event.first;
    this.rows = event.rows;
    this.updatePaginatedProducts();
  }

  updatePaginatedProducts() {
    this.paginatedProducts = this.products.slice(this.first, this.first + this.rows);
  }

  onSearchInput() {
    this.searchDebounce.debounce('products-search', () => {
      this.filterProducts();
    });
  }

  clearFilters() {
    this.searchQuery = '';
    this.categoryFilter = null;
    this.brandFilter = null;
    this.statusFilter = 'all';
    this.first = 0;
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
    this.confirmationService.confirm({
      message: this.translateService.instant('common.confirm_delete_message', { item: productName }),
      header: this.translateService.instant('common.confirm_delete'),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      acceptLabel: this.translateService.instant('common.delete'),
      rejectLabel: this.translateService.instant('common.cancel'),
      accept: () => this.deleteProduct(product)
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

  getBrandName(brandId: number | undefined): string {
    if (!brandId) {
      return '-';
    }
    const brand = this.brands.find(b => b.id === brandId);
    if (!brand) {
      return this.translateService.instant('common.unknown');
    }
    return brand.name;
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

  getPaginationTemplate(): string {
    const showing = this.translateService.instant('admin.products.showing');
    const of = this.translateService.instant('admin.products.of');
    return `${showing} {first} - {last} ${of} {totalRecords}`;
  }

  // Inline price editing methods
  startEditPrice(product: Product): void {
    this.editingPriceProductId = product.id;
    this.editingPrice = product.price;
  }

  cancelEditPrice(): void {
    this.editingPriceProductId = null;
    this.editingPrice = 0;
  }

  savePrice(product: Product): void {
    if (this.editingPrice === product.price) {
      this.cancelEditPrice();
      return;
    }

    this.productService.updateProduct(product.id, { price: this.editingPrice }).subscribe({
      next: () => {
        const index = this.allProducts.findIndex(p => p.id === product.id);
        if (index !== -1) {
          this.allProducts[index].price = this.editingPrice;
        }
        const displayIndex = this.products.findIndex(p => p.id === product.id);
        if (displayIndex !== -1) {
          this.products[displayIndex].price = this.editingPrice;
        }

        this.toast.showSuccess('admin.products.price_updated');
        this.cancelEditPrice();
      },
      error: (error) => {
        console.error('Error updating price:', error);
        this.toast.showError('admin.products.price_update_failed');
      }
    });
  }

  isEditingPrice(productId: number): boolean {
    return this.editingPriceProductId === productId;
  }

  // Inline stock editing methods
  startEditStock(product: Product): void {
    this.editingStockProductId = product.id;
    this.editingStock = product.stock_quantity;
  }

  cancelEditStock(): void {
    this.editingStockProductId = null;
    this.editingStock = 0;
  }

  saveStock(product: Product): void {
    if (this.editingStock === product.stock_quantity) {
      this.cancelEditStock();
      return;
    }

    this.productService.updateProduct(product.id, { stock_quantity: this.editingStock }).subscribe({
      next: () => {
        const index = this.allProducts.findIndex(p => p.id === product.id);
        if (index !== -1) {
          this.allProducts[index].stock_quantity = this.editingStock;
        }
        const displayIndex = this.products.findIndex(p => p.id === product.id);
        if (displayIndex !== -1) {
          this.products[displayIndex].stock_quantity = this.editingStock;
        }

        this.toast.showSuccess('admin.products.stock_updated');
        this.cancelEditStock();
      },
      error: (error) => {
        console.error('Error updating stock:', error);
        this.toast.showError('admin.products.stock_update_failed');
      }
    });
  }

  isEditingStock(productId: number): boolean {
    return this.editingStockProductId === productId;
  }

  // Private methods
  private loadCategories() {
    this.productService.getCategories(true).subscribe({
      next: (categories) => {
        this.categories = categories;
      },
      error: (error) => {
        console.error('Error loading categories:', error);
      }
    });
  }

  private loadBrands() {
    this.brandService.getBrands(false).subscribe({
      next: (brands) => {
        this.brands = brands;
      },
      error: (error) => {
        console.error('Error loading brands:', error);
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
        this.allProducts = products;
        this.products = products;
        this.updatePaginatedProducts();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading products:', error);
        this.loading = false;
        this.toast.showError('admin.products.load_error');
      }
    });
  }

  filterProducts() {
    let filtered = [...this.allProducts];

    // Status filter
    if (this.statusFilter === 'active') {
      filtered = filtered.filter(p => p.is_active);
    } else if (this.statusFilter === 'inactive') {
      filtered = filtered.filter(p => !p.is_active);
    }

    // Category filter
    if (this.categoryFilter) {
      filtered = filtered.filter(p => p.category_id === this.categoryFilter);
    }

    // Brand filter
    if (this.brandFilter) {
      filtered = filtered.filter(p => p.brand_id === this.brandFilter);
    }

    // Search filter
    if (this.searchQuery?.trim()) {
      const search = this.searchQuery.toLowerCase();
      filtered = filtered.filter(product =>
        this.getProductName(product).toLowerCase().includes(search) ||
        this.getProductDescription(product).toLowerCase().includes(search) ||
        this.getCategoryName(product.category_id).toLowerCase().includes(search)
      );
    }

    this.products = filtered;
    this.first = 0;
    this.updatePaginatedProducts();
  }

  private deleteProduct(product: Product) {
    this.productService.deleteProduct(product.id).subscribe({
      next: () => {
        this.toast.showSuccess('admin.products.delete_success');
        this.allProducts = this.allProducts.filter(p => p.id !== product.id);
        this.filterProducts();
      },
      error: (error) => {
        console.error('Error deleting product:', error);
        this.toast.showApiError(error, 'admin.products.delete_failed');
      }
    });
  }

}