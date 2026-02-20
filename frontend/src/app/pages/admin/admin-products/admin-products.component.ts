import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { SelectModule } from 'primeng/select';
import { BadgeModule } from 'primeng/badge';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { TranslateService } from '@ngx-translate/core';

import { ADMIN_LIST_IMPORTS, ADMIN_DIALOG_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { onLanguageChange } from '../../../core/utils/language-change.util';
import { ProductService } from '../../../services/product.service';
import { BrandService } from '../../../core/services/brand.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { TranslationHelperService } from '../../../core/services/translation-helper.service';
import { UnitsService } from '../../../core/services/units.service';
import { StockStatusService } from '../../../core/services/stock-status.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { ConfirmationDialogService } from '../../../core/services/confirmation-dialog.service';
import { BaseAdminListComponent } from '../../../shared/base/base-admin-list.component';
import { InlineEditState } from '../../../shared/utils/inline-edit-state';
import { Product } from '../../../models/product.model';
import { Category } from '../../../models/category.model';
import { Brand } from '../../../models/brand.model';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [
    ...ADMIN_LIST_IMPORTS,
    ...ADMIN_DIALOG_IMPORTS,
    CardModule,
    SelectModule,
    BadgeModule,
    OverlayBadgeModule
  ],
  providers: [ConfirmationService],
  templateUrl: './admin-products.component.html',
  styleUrl: './admin-products.component.scss'
})
export class AdminProductsComponent extends BaseAdminListComponent implements OnInit {
  // State properties
  allProducts: Product[] = [];
  products: Product[] = [];
  paginatedProducts: Product[] = [];
  categories: Category[] = [];
  brands: Brand[] = [];

  // Status filter
  statusFilter: 'all' | 'active' | 'inactive' = 'all';

  // Category filter
  categoryFilter: number | null = null;
  showCategoryDropdown = false;

  // Brand filter
  brandFilter: number | null = null;
  showBrandDropdown = false;

  // Inline editing state
  priceEdit = new InlineEditState<number>(0);
  stockEdit = new InlineEditState<number>(0);

  // Services
  private productService = inject(ProductService);
  private brandService = inject(BrandService);
  private toast = inject(ToastMessageService);
  private router = inject(Router);
  private translateService = inject(TranslateService);
  private currencyService = inject(CurrencyService);
  private translationHelper = inject(TranslationHelperService);
  private unitsService = inject(UnitsService);
  private confirmationService = inject(ConfirmationService);
  private confirmDialog = inject(ConfirmationDialogService);
  private stockStatus = inject(StockStatusService);
  private destroyRef = inject(DestroyRef);

  // Lifecycle hooks
  ngOnInit() {
    this.loadCategories();
    this.loadBrands();
    this.loadAllProducts();
    onLanguageChange(this.translateService, this.destroyRef, () => {
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
    this.filterItems();
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
    this.filterItems();
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
    this.filterItems();
  }

  getBrandProductCount(brandId: number): number {
    return this.allProducts.filter(p => p.brand_id === brandId).length;
  }

  // === Abstract method implementations ===

  updatePaginatedItems(): void {
    this.paginatedProducts = this.products.slice(this.first, this.first + this.rows);
  }

  getSearchDebounceKey(): string {
    return 'products-search';
  }

  // === Component-specific methods ===

  clearFilters() {
    this.searchQuery = '';
    this.categoryFilter = null;
    this.brandFilter = null;
    this.statusFilter = 'all';
    this.resetPagination();
    this.filterItems();
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
    this.confirmDialog.confirmDelete(
      this.confirmationService,
      this.getProductName(product),
      () => this.deleteProduct(product)
    );
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

  getPaginationTemplate(): string {
    const showing = this.translateService.instant('admin.products.showing');
    const of = this.translateService.instant('admin.products.of');
    return `${showing} {first} - {last} ${of} {totalRecords}`;
  }

  // Inline price editing methods
  startEditPrice(product: Product): void {
    this.priceEdit.start(product.id, product.price);
  }

  cancelEditPrice(): void {
    this.priceEdit.cancel();
  }

  savePrice(product: Product): void {
    if (!this.priceEdit.hasChanged(product.price)) {
      this.priceEdit.cancel();
      return;
    }

    const newPrice = this.priceEdit.value;
    this.productService.updateProduct(product.id, { price: newPrice }).subscribe({
      next: () => {
        const index = this.allProducts.findIndex(p => p.id === product.id);
        if (index !== -1) {
          this.allProducts[index].price = newPrice;
        }
        const displayIndex = this.products.findIndex(p => p.id === product.id);
        if (displayIndex !== -1) {
          this.products[displayIndex].price = newPrice;
        }

        this.toast.showSuccess('admin.products.price_updated');
        this.priceEdit.cancel();
      },
      error: (error) => {
        console.error('Error updating price:', error);
        this.toast.showError('admin.products.price_update_failed');
      }
    });
  }

  isEditingPrice(productId: number): boolean {
    return this.priceEdit.isEditing(productId);
  }

  // Inline stock editing methods
  startEditStock(product: Product): void {
    this.stockEdit.start(product.id, product.stock_quantity);
  }

  cancelEditStock(): void {
    this.stockEdit.cancel();
  }

  saveStock(product: Product): void {
    if (!this.stockEdit.hasChanged(product.stock_quantity)) {
      this.stockEdit.cancel();
      return;
    }

    const newStock = this.stockEdit.value;
    this.productService.updateProduct(product.id, { stock_quantity: newStock }).subscribe({
      next: () => {
        const index = this.allProducts.findIndex(p => p.id === product.id);
        if (index !== -1) {
          this.allProducts[index].stock_quantity = newStock;
        }
        const displayIndex = this.products.findIndex(p => p.id === product.id);
        if (displayIndex !== -1) {
          this.products[displayIndex].stock_quantity = newStock;
        }

        this.toast.showSuccess('admin.products.stock_updated');
        this.stockEdit.cancel();
      },
      error: (error) => {
        console.error('Error updating stock:', error);
        this.toast.showError('admin.products.stock_update_failed');
      }
    });
  }

  isEditingStock(productId: number): boolean {
    return this.stockEdit.isEditing(productId);
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
        this.updatePaginatedItems();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading products:', error);
        this.loading = false;
        this.toast.showError('admin.products.load_error');
      }
    });
  }

  filterItems(): void {
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
    if (this.hasSearchQuery()) {
      const search = this.searchQuery.toLowerCase();
      filtered = filtered.filter(product =>
        this.getProductName(product).toLowerCase().includes(search) ||
        this.getProductDescription(product).toLowerCase().includes(search) ||
        this.getCategoryName(product.category_id).toLowerCase().includes(search)
      );
    }

    this.products = filtered;
    this.resetPagination();
    this.updatePaginatedItems();
  }

  private deleteProduct(product: Product) {
    this.productService.deleteProduct(product.id).subscribe({
      next: () => {
        this.toast.showSuccess('admin.products.delete_success');
        this.allProducts = this.allProducts.filter(p => p.id !== product.id);
        this.filterItems();
      },
      error: (error) => {
        console.error('Error deleting product:', error);
        this.toast.showApiError(error, 'admin.products.delete_failed');
      }
    });
  }

}