import { Component, OnInit, inject, DestroyRef, signal } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { SelectModule } from 'primeng/select';
import { BadgeModule } from 'primeng/badge';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { PopoverModule } from 'primeng/popover';
import { TranslateService } from '@ngx-translate/core';

import { delay } from 'rxjs'; // TODO: Remove - for testing skeleton
import { ADMIN_LIST_IMPORTS, ADMIN_DIALOG_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { TableSkeletonComponent, SkeletonColumn } from '../../../shared/components/table-skeleton/table-skeleton.component';
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
    OverlayBadgeModule,
    PopoverModule,
    TableSkeletonComponent
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
  categoryOptions: { label: string; value: number | null; count: number }[] = [];

  // Brand filter
  brandFilter: number | null = null;
  brandOptions: { label: string; value: number | null; count: number }[] = [];

  // Inline editing state
  priceEdit = new InlineEditState<number>(0);
  stockEdit = new InlineEditState<number>(0);

  // Stock edit mode (cartons or units)
  stockEditMode: 'cartons' | 'units' = 'cartons';
  stockEditProduct: Product | null = null;

  // Fullscreen mode
  isFullscreen = false;

  // Animation state
  tableInitialized = signal(false);

  // Table options
  rowsPerPageOptions = [10, 20, 25, 50];
  columnOptions = [
    { field: 'image', label: 'admin.products.table.image', visible: true },
    { field: 'name', label: 'admin.products.table.product_name', visible: true },
    { field: 'category', label: 'admin.products.table.category', visible: true },
    { field: 'brand', label: 'admin.products.table.brand', visible: true },
    { field: 'price', label: 'admin.products.table.price', visible: true },
    { field: 'stock', label: 'admin.products.table.stock', visible: true },
    { field: 'status', label: 'admin.products.table.status', visible: true },
    { field: 'actions', label: 'admin.products.table.actions', visible: true }
  ];

  // Skeleton configuration
  skeletonColumns: SkeletonColumn[] = [
    { width: '5%', type: 'image' },
    { width: '22%', type: 'text-multi', headerWidth: '100px' },
    { width: '12%', type: 'pill', headerWidth: '70px' },
    { width: '10%', type: 'pill-sm', headerWidth: '50px' },
    { width: '12%', type: 'price', headerWidth: '50px' },
    { width: '15%', type: 'stock', headerWidth: '50px' },
    { width: '12%', type: 'toggle', headerWidth: '60px' },
    { width: '12%', type: 'actions', headerWidth: '60px' }
  ];

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
    // Set rows to 20 on mobile
    if (window.innerWidth <= 768) {
      this.rows = 20;
    }

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
  onCategoryChange(event: any): void {
    this.first = 0;
    this.filterItems();
  }

  getCategoryProductCount(categoryId: number): number {
    return this.getCountByPredicate(this.allProducts, p => p.category_id === categoryId);
  }

  // Brand filter methods
  onBrandChange(event: any): void {
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

  toggleProductStatus(product: Product) {
    const newStatus = !product.is_active;
    this.handleInlineUpdate(
      () => this.productService.updateProduct(product.id, { is_active: newStatus }),
      this.allProducts,
      this.products,
      product.id,
      'is_active',
      newStatus,
      newStatus ? 'admin.products.status_activated' : 'admin.products.status_deactivated',
      'admin.products.status_update_failed',
      () => {}
    );
  }

  toggleFullscreen() {
    this.isFullscreen = !this.isFullscreen;
    if (this.isFullscreen) {
      document.body.classList.add('fullscreen-active');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.classList.remove('fullscreen-active');
      document.body.style.overflow = '';
    }
  }

  setRowsPerPage(rows: number) {
    this.rows = rows;
    this.first = 0;
    this.updatePaginatedItems();
  }

  toggleColumn(field: string) {
    const col = this.columnOptions.find(c => c.field === field);
    if (col) {
      col.visible = !col.visible;
    }
  }

  isColumnVisible(field: string): boolean {
    const col = this.columnOptions.find(c => c.field === field);
    return col ? col.visible : true;
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
      (categories) => {
        this.categories = categories;
        this.buildCategoryOptions();
      }
    );
  }

  private loadBrands() {
    this.loadDataSilent(
      () => this.brandService.getBrands(false),
      (brands) => {
        this.brands = brands;
        this.buildBrandOptions();
      }
    );
  }

  private loadAllProducts() {
    // TODO: Remove delay(3000) - for testing skeleton only
    this.loading = true;
    this.productService.getProducts({ active_only: false }).pipe(
      delay(3000)
    ).subscribe({
      next: (products) => {
        this.allProducts = products;
        this.products = products;
        this.updatePaginatedItems();
        this.buildCategoryOptions();
        this.buildBrandOptions();
        this.loading = false;
        setTimeout(() => this.tableInitialized.set(true), 100);
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  private buildCategoryOptions() {
    const allLabel = this.translateService.instant('admin.products.filters.all_categories');
    this.categoryOptions = [
      { label: allLabel, value: null, count: this.allProducts.length },
      ...this.categories.map(cat => ({
        label: this.getCategoryName(cat.id),
        value: cat.id,
        count: this.getCategoryProductCount(cat.id)
      }))
    ];
  }

  private buildBrandOptions() {
    const allLabel = this.translateService.instant('admin.products.filters.all_brands');
    this.brandOptions = [
      { label: allLabel, value: null, count: this.allProducts.length },
      ...this.brands.map(brand => ({
        label: brand.name,
        value: brand.id,
        count: this.getBrandProductCount(brand.id)
      }))
    ];
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
