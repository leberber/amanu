import { Component, OnInit, inject, DestroyRef, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConfirmationService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import { PopoverModule } from 'primeng/popover';
import { TranslateService } from '@ngx-translate/core';

import { ADMIN_LIST_IMPORTS, ADMIN_DIALOG_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { TableSkeletonComponent, SkeletonColumn } from '../../../shared/components/table-skeleton/table-skeleton.component';
import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { onLanguageChange } from '../../../core/utils/language-change.util';
import { ProductService } from '../../../services/product.service';
import { BrandService } from '../../../core/services/brand.service';
import { TranslationHelperService } from '../../../core/services/translation-helper.service';
import { UnitsService } from '../../../core/services/units.service';
import { StockStatusService } from '../../../core/services/stock-status.service';
import { ConfirmationDialogService } from '../../../core/services/confirmation-dialog.service';
import { BaseAdminListComponent, ColumnOption } from '../../../shared/base/base-admin-list.component';
import { InlineEditState } from '../../../shared/utils/inline-edit-state';
import { Product } from '../../../models/product.model';
import { Category } from '../../../models/category.model';
import { Brand } from '../../../models/brand.model';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { BreakpointService } from '../../../core/services/breakpoint.service';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [
    ...ADMIN_LIST_IMPORTS,
    ...ADMIN_DIALOG_IMPORTS,
    SelectModule,
    PopoverModule,
    TableSkeletonComponent,
    AgroclikPageContainerComponent
  ],
  providers: [ConfirmationService],
  templateUrl: './admin-products.component.html',
  styleUrl: './admin-products.component.scss'
})
export class AdminProductsComponent extends BaseAdminListComponent implements OnInit {
  // Data signals
  allProducts = signal<Product[]>([]);
  products = signal<Product[]>([]);
  paginatedProducts = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  brands = signal<Brand[]>([]);

  // Category filter
  categoryFilter: number | null = null;

  // Brand filter
  brandFilter: number | null = null;

  // Computed counts
  activeCount = computed(() => this.allProducts().filter(p => p.is_active).length);
  inactiveCount = computed(() => this.allProducts().filter(p => !p.is_active).length);

  // Computed category options
  categoryOptions = computed(() => {
    const allLabel = this.translateService.instant('admin.products.filters.all_categories');
    return [
      { label: allLabel, value: null as number | null, count: this.allProducts().length },
      ...this.categories().map(cat => ({
        label: this.getCategoryName(cat.id),
        value: cat.id as number | null,
        count: this.allProducts().filter(p => p.category_id === cat.id).length
      }))
    ];
  });

  // Computed brand options
  brandOptions = computed(() => {
    const allLabel = this.translateService.instant('admin.products.filters.all_brands');
    return [
      { label: allLabel, value: null as number | null, count: this.allProducts().length },
      ...this.brands().map(brand => ({
        label: brand.name,
        value: brand.id as number | null,
        count: this.allProducts().filter(p => p.brand_id === brand.id).length
      }))
    ];
  });

  // Inline editing state
  priceEdit = new InlineEditState<number>(0);
  stockEdit = new InlineEditState<number>(0);
  statusEdit = new InlineEditState<boolean>(true);

  // Stock edit mode (cartons or units)
  stockEditMode: 'cartons' | 'units' = 'cartons';
  stockEditProduct: Product | null = null;

  // UI state signals
  isFullscreen = signal(false);
  tableInitialized = signal(false);

  // ---------------------------------------------------------------------------
  // MOBILE COLUMN VISIBILITY
  // ---------------------------------------------------------------------------
  // Sets default column visibility based on screen size.
  // - Desktop: all columns visible
  // - Mobile: only essential columns (set visible: true)
  // Users can toggle columns via table options menu.
  // ---------------------------------------------------------------------------
  override columnOptions: ColumnOption[] = this.getInitialColumnOptions();

  private getInitialColumnOptions(): ColumnOption[] {
    const isMobile = this.breakpoint.isMobile();

    return [
      { field: 'image', label: 'admin.products.table.image', visible: !isMobile },
      { field: 'name', label: 'admin.products.table.product_name', visible: true },
      { field: 'category', label: 'admin.products.table.category', visible: !isMobile },
      { field: 'brand', label: 'admin.products.table.brand', visible: !isMobile },
      { field: 'price', label: 'admin.products.table.price', visible: true },
      { field: 'stock', label: 'admin.products.table.stock', visible: true },
      { field: 'status', label: 'admin.products.table.status', visible: !isMobile },
      { field: 'actions', label: 'admin.products.table.actions', visible: !isMobile }
    ];
  }

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
  private translationHelper = inject(TranslationHelperService);
  private unitsService = inject(UnitsService);
  private confirmationService = inject(ConfirmationService);
  private confirmDialog = inject(ConfirmationDialogService);
  private stockStatus = inject(StockStatusService);
  private destroyRef = inject(DestroyRef);
  private readonly breakpoint = inject(BreakpointService);

  ngOnInit() {
    this.columnOptions = this.getInitialColumnOptions();
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

  // Category filter methods
  onCategoryChange(): void {
    this.first = 0;
    this.filterItems();
  }

  // Brand filter methods
  onBrandChange(): void {
    this.first = 0;
    this.filterItems();
  }

  // Abstract method implementations
  updatePaginatedItems(): void {
    this.paginatedProducts.set(this.products().slice(this.first, this.first + this.rows));
  }

  getSearchDebounceKey(): string {
    return 'products-search';
  }

  // Component-specific methods
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

  // Inline status editing
  startEditStatus(product: Product): void {
    this.priceEdit.cancel();
    this.stockEdit.cancel();
    this.statusEdit.start(product.id, product.is_active);
  }

  cancelEditStatus(): void {
    this.statusEdit.cancel();
  }

  isEditingStatus(productId: number): boolean {
    return this.statusEdit.isEditing(productId);
  }

  toggleEditingStatus(): void {
    this.statusEdit.value = !this.statusEdit.value;
  }

  saveStatus(product: Product): void {
    if (!this.statusEdit.hasChanged(product.is_active)) {
      this.statusEdit.cancel();
      return;
    }

    const newStatus = this.statusEdit.value;
    this.productService.updateProduct(product.id, { is_active: newStatus })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.allProducts.update(products =>
            products.map(p => p.id === product.id ? { ...p, is_active: newStatus } : p)
          );
          this.filterItems();
          this.statusEdit.cancel();
          this.baseToast.showSuccess(newStatus ? 'admin.products.status_activated' : 'admin.products.status_deactivated');
        },
        error: (error) => {
          this.statusEdit.cancel();
          this.baseToast.showApiError(error, 'admin.products.status_update_failed');
        }
      });
  }

  toggleFullscreen(): void {
    this.isFullscreen.update(v => !v);
    if (this.isFullscreen()) {
      document.body.classList.add('fullscreen-active');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.classList.remove('fullscreen-active');
      document.body.style.overflow = '';
    }
  }

  getCategoryName(categoryId: number): string {
    const category = this.categories().find(cat => cat.id === categoryId);
    if (!category) {
      return this.translateService.instant('common.unknown');
    }
    return this.translationHelper.getCategoryName(category);
  }

  getBrandName(brandId: number | undefined): string {
    if (!brandId) {
      return '-';
    }
    const brand = this.brands().find(b => b.id === brandId);
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
    this.productService.updateProduct(product.id, { price: newPrice })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.allProducts.update(products =>
            products.map(p => p.id === product.id ? { ...p, price: newPrice } : p)
          );
          this.filterItems();
          this.priceEdit.cancel();
          this.baseToast.showSuccess('admin.products.price_updated');
        },
        error: (error) => {
          this.priceEdit.cancel();
          this.baseToast.showApiError(error, 'admin.products.price_update_failed');
        }
      });
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

    this.productService.updateProduct(product.id, { stock_quantity: newStock })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.allProducts.update(products =>
            products.map(p => p.id === product.id ? { ...p, stock_quantity: newStock } : p)
          );
          this.filterItems();
          this.cancelEditStock();
          this.baseToast.showSuccess('admin.products.stock_updated');
        },
        error: (error) => {
          this.cancelEditStock();
          this.baseToast.showApiError(error, 'admin.products.stock_update_failed');
        }
      });
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

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    img.parentElement?.querySelector('i')?.classList.remove('hidden');
  }

  // Private methods
  private loadCategories(): void {
    this.productService.getCategories(true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories) => this.categories.set(categories),
        error: () => this.categories.set([])
      });
  }

  private loadBrands(): void {
    this.brandService.getBrands(false)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (brands) => this.brands.set(brands),
        error: () => this.brands.set([])
      });
  }

  private loadAllProducts(): void {
    this.loading = true;
    this.productService.getProducts({ active_only: false })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (products) => {
          // Sort by created_at descending (newest first)
          const sorted = [...products].sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          this.allProducts.set(sorted);
          this.products.set(sorted);
          this.updatePaginatedItems();
          this.loading = false;
          setTimeout(() => this.tableInitialized.set(true), 100);
        },
        error: () => {
          this.allProducts.set([]);
          this.products.set([]);
          this.loading = false;
        }
      });
  }

  filterItems(): void {
    // Apply status filter using base class helper
    let filtered = this.filterByActiveStatus(this.allProducts());

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

    this.products.set(filtered);
    this.resetPagination();
    this.updatePaginatedItems();
  }

  private deleteProduct(product: Product): void {
    this.productService.deleteProduct(product.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.allProducts.update(products => products.filter(p => p.id !== product.id));
          this.filterItems();
          this.baseToast.showSuccess('admin.products.delete_success');
        },
        error: (error) => {
          this.baseToast.showApiError(error, 'admin.products.delete_failed');
        }
      });
  }

}
