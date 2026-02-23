import { Component, OnInit, inject, DestroyRef } from '@angular/core';
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

  // Category filter
  categoryFilter: number | null = null;
  showCategoryDropdown = false;

  // Brand filter
  brandFilter: number | null = null;
  showBrandDropdown = false;

  // Inline editing state
  priceEdit = new InlineEditState<number>(0);
  stockEdit = new InlineEditState<number>(0);

  // Stock edit mode (cartons or units)
  stockEditMode: 'cartons' | 'units' = 'cartons';
  stockEditProduct: Product | null = null;

  // Fullscreen mode
  isFullscreen = false;

  // Services
  private productService = inject(ProductService);
  private brandService = inject(BrandService);
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

  getActiveCount(): number {
    return this.getCountByPredicate(this.allProducts, p => p.is_active);
  }

  getInactiveCount(): number {
    return this.getCountByPredicate(this.allProducts, p => !p.is_active);
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
    return this.getCountByPredicate(this.allProducts, p => p.category_id === categoryId);
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
    return this.getCountByPredicate(this.allProducts, p => p.brand_id === brandId);
  }

  // === Abstract method implementations ===

  updatePaginatedItems(): void {
    this.paginatedProducts = this.products.slice(this.first, this.first + this.rows);
  }

  getSearchDebounceKey(): string {
    return 'products-search';
  }

  // === Component-specific methods ===

  override clearFilters() {
    this.searchQuery = '';
    this.categoryFilter = null;
    this.brandFilter = null;
    this.statusFilter = 'all';
    this.resetPagination();
    this.filterItems();
  }

  createNewProduct() {
    this.baseRouter.navigate([ROUTES.ADMIN.ADD_PRODUCT]);
  }

  editProduct(product: Product) {
    this.baseRouter.navigate([RouteHelpers.adminEditProduct(product.id)]);
  }

  viewProduct(product: Product) {
    this.baseRouter.navigate([RouteHelpers.productDetail(product.id)]);
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

  toggleFullscreen() {
    this.isFullscreen = !this.isFullscreen;
    if (this.isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
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

  getUnitLabel(product: Product): string {
    return this.unitsService.getUnitDisplay(product.unit, false);
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
    this.handleInlineUpdate(
      () => this.productService.updateProduct(product.id, { price: newPrice }),
      this.allProducts,
      this.products,
      product.id,
      'price',
      newPrice,
      'admin.products.price_updated',
      'admin.products.price_update_failed',
      () => this.priceEdit.cancel()
    );
  }

  isEditingPrice(productId: number): boolean {
    return this.priceEdit.isEditing(productId);
  }

  // Inline stock editing methods
  startEditStock(product: Product): void {
    this.stockEditProduct = product;
    const piecesPerBox = product.pieces_per_box || 1;

    // Default to cartons mode if pieces_per_box > 1, otherwise units
    if (piecesPerBox > 1) {
      this.stockEditMode = 'cartons';
    } else {
      this.stockEditMode = 'units';
    }
    // Start with 0 - user enters amount to ADD
    this.stockEdit.start(product.id, 0);
  }

  cancelEditStock(): void {
    this.stockEdit.cancel();
    this.stockEditProduct = null;
  }

  toggleStockEditMode(): void {
    if (!this.stockEditProduct) return;

    const piecesPerBox = this.stockEditProduct.pieces_per_box || 1;
    const currentValue = this.stockEdit.value;

    if (this.stockEditMode === 'cartons') {
      // Switching to units: convert cartons to units
      this.stockEditMode = 'units';
      this.stockEdit.value = currentValue * piecesPerBox;
    } else {
      // Switching to cartons: convert units to cartons (rounded down)
      this.stockEditMode = 'cartons';
      this.stockEdit.value = Math.floor(currentValue / piecesPerBox);
    }
  }

  getStockToAdd(): number {
    if (!this.stockEditProduct) return 0;
    const piecesPerBox = this.stockEditProduct.pieces_per_box || 1;

    if (this.stockEditMode === 'cartons') {
      return this.stockEdit.value * piecesPerBox;
    }
    return this.stockEdit.value;
  }

  getNewTotalStock(): number {
    if (!this.stockEditProduct) return 0;
    return this.stockEditProduct.stock_quantity + this.getStockToAdd();
  }

  saveStock(product: Product): void {
    const stockToAdd = this.getStockToAdd();

    // If nothing to add, just cancel
    if (stockToAdd === 0) {
      this.cancelEditStock();
      return;
    }

    // Calculate new total: existing + added
    const newStock = product.stock_quantity + stockToAdd;

    this.handleInlineUpdate(
      () => this.productService.updateProduct(product.id, { stock_quantity: newStock }),
      this.allProducts,
      this.products,
      product.id,
      'stock_quantity',
      newStock,
      'admin.products.stock_updated',
      'admin.products.stock_update_failed',
      () => this.cancelEditStock()
    );
  }

  isEditingStock(productId: number): boolean {
    return this.stockEdit.isEditing(productId);
  }

  hasMultiplePiecesPerBox(product: Product): boolean {
    return (product.pieces_per_box || 1) > 1;
  }

  getCartonCount(product: Product): number {
    const piecesPerBox = product.pieces_per_box || 1;
    return Math.floor(product.stock_quantity / piecesPerBox);
  }

  // Private methods
  private loadCategories() {
    this.loadDataSilent(
      () => this.productService.getCategories(true),
      (categories) => { this.categories = categories; }
    );
  }

  private loadBrands() {
    this.loadDataSilent(
      () => this.brandService.getBrands(false),
      (brands) => { this.brands = brands; }
    );
  }

  private loadAllProducts() {
    this.loadData(
      () => this.productService.getProducts({ active_only: false }),
      (products) => {
        this.allProducts = products;
        this.products = products;
        this.updatePaginatedItems();
      },
      'admin.products.load_error'
    );
  }

  filterItems(): void {
    // Apply status filter using base class helper
    let filtered = this.filterByActiveStatus(this.allProducts);

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
    this.handleDelete(
      () => this.productService.deleteProduct(product.id),
      this.allProducts,
      product.id,
      (updated) => { this.allProducts = updated; },
      'admin.products.delete_success',
      'admin.products.delete_failed'
    );
  }

}
