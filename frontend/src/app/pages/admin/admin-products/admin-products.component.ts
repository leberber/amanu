import { Component, OnInit, inject, DestroyRef, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { ConfirmationService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import { PopoverModule } from 'primeng/popover';
import { DrawerModule } from 'primeng/drawer';
import { TranslateService } from '@ngx-translate/core';

import { ADMIN_LIST_IMPORTS, ADMIN_DIALOG_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { TableSkeletonComponent, SkeletonColumn } from '../../../shared/components/table-skeleton/table-skeleton.component';
import { TableLoadingRowsComponent, LoadingColumn } from '../../../shared/components/table-loading-rows/table-loading-rows.component';
import { InfiniteScrollDirective } from '../../../shared/directives/infinite-scroll.directive';
import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { onLanguageChange } from '../../../core/utils/language-change.util';
import { ProductService } from '../../../services/product.service';
import { BrandService } from '../../../core/services/brand.service';
import { SupplierService } from '../../../core/services/supplier.service';
import { PurchaseOrderService, PriceTier, ProductPurchaseLot } from '../../../services/purchase-order.service';
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
    DrawerModule,
    TableSkeletonComponent,
    TableLoadingRowsComponent,
    InfiniteScrollDirective,
    AgroclikPageContainerComponent
  ],
  providers: [ConfirmationService],
  templateUrl: './admin-products.component.html',
  styleUrl: './admin-products.component.scss'
})
export class AdminProductsComponent extends BaseAdminListComponent implements OnInit {
  // Infinite scroll configuration
  private readonly BATCH_SIZE = 100;

  // Data signals - products loaded from server
  displayedProducts = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  brands = signal<Brand[]>([]);

  // Server-side pagination state
  totalProducts = signal(0);
  serverActiveCount = signal(0);
  serverInactiveCount = signal(0);
  currentSkip = signal(0);
  loadingMore = signal(false);

  // Computed: has more products to load from server
  hasMore = computed(() => this.displayedProducts().length < this.totalProducts());

  // Category filter
  categoryFilter: number | null = null;

  // Brand filter
  brandFilter: number | null = null;

  // Computed counts from server
  activeCount = computed(() => this.serverActiveCount());
  inactiveCount = computed(() => this.serverInactiveCount());
  allProductsCount = computed(() => this.serverActiveCount() + this.serverInactiveCount());

  // Computed category options
  categoryOptions = computed(() => {
    const allLabel = this.translateService.instant('admin.products.filters.all_categories');
    return [
      { label: allLabel, value: null as number | null },
      ...this.categories().map(cat => ({
        label: this.getCategoryName(cat.id),
        value: cat.id as number | null
      }))
    ];
  });

  // Computed brand options
  brandOptions = computed(() => {
    const allLabel = this.translateService.instant('admin.products.filters.all_brands');
    return [
      { label: allLabel, value: null as number | null },
      ...this.brands().map(brand => ({
        label: brand.name,
        value: brand.id as number | null
      }))
    ];
  });

  // CMUP (weighted average cost) per product
  cmupMap = signal<Record<number, number>>({});
  priceTiersMap = signal<Record<number, PriceTier[]>>({});
  lifecycleMap = signal<Record<number, { made_date: string; expiry_date: string }[]>>({});

  // Lots drawer
  lotsProduct = signal<Product | null>(null);
  lots = signal<ProductPurchaseLot[]>([]);
  lotsLoading = signal(false);
  drawerExiting = signal(false);

  // Inline editing state
  priceEdit = new InlineEditState<number>(0);
  cmupEdit = new InlineEditState<number>(0);
  stockEdit = new InlineEditState<number>(0);
  statusEdit = new InlineEditState<boolean>(true);

  // Stock edit mode (cartons or units)
  stockEditMode: 'cartons' | 'units' = 'cartons';
  stockEditProduct: Product | null = null;

  // ---------------------------------------------------------------------------
  // MOBILE COLUMN VISIBILITY
  // ---------------------------------------------------------------------------
  // Sets default column visibility based on screen size.
  // - Desktop: all columns visible
  // - Mobile: only essential columns (set visible: true)
  // Users can toggle columns via table options menu.
  // ---------------------------------------------------------------------------
  override columnOptions: ColumnOption[] = [];

  private getInitialColumnOptions(): ColumnOption[] {
    const isMobile = this.breakpoint.isMobile();

    return [
      { field: 'image', label: 'admin.products.table.image', visible: !isMobile },
      { field: 'name', label: 'admin.products.table.product_name', visible: true },
      { field: 'category', label: 'admin.products.table.category', visible: false },
      { field: 'brand', label: 'admin.products.table.brand', visible: !isMobile },
      { field: 'volume', label: 'admin.products.table.volume', visible: false },
      { field: 'weight', label: 'admin.products.table.weight', visible: false },
      { field: 'tva', label: 'admin.products.table.tva', visible: false },
      { field: 'purchase_price', label: 'admin.products.table.purchase_price', visible: !isMobile },
      { field: 'price', label: 'admin.products.table.price', visible: true },
      { field: 'profit', label: 'admin.products.table.profit', visible: !isMobile },
      { field: 'stock', label: 'admin.products.table.stock', visible: true },
      { field: 'lifecycle', label: 'admin.products.table.lifecycle', visible: !isMobile },
      { field: 'status', label: 'admin.products.table.status', visible: !isMobile },
      { field: 'actions', label: 'admin.products.table.actions', visible: !isMobile }
    ];
  }

  // Skeleton configuration for initial load
  skeletonColumns: SkeletonColumn[] = [
    { width: '5%', type: 'image' },
    { width: '18%', type: 'text-multi', headerWidth: '100px' },
    { width: '10%', type: 'pill', headerWidth: '70px' },
    { width: '8%', type: 'pill-sm', headerWidth: '50px' },
    { width: '6%', type: 'text', headerWidth: '50px' },
    { width: '6%', type: 'text', headerWidth: '50px' },
    { width: '5%', type: 'text', headerWidth: '40px' },
    { width: '10%', type: 'price', headerWidth: '50px' },
    { width: '13%', type: 'stock', headerWidth: '50px' },
    { width: '10%', type: 'toggle', headerWidth: '60px' },
    { width: '10%', type: 'actions', headerWidth: '60px' }
  ];

  // Loading rows configuration for infinite scroll - computed based on visible columns
  getLoadingColumns(): LoadingColumn[] {
    return [
      { type: 'image', visible: this.isColumnVisible('image') },
      { type: 'text-multi', visible: this.isColumnVisible('name') },
      { type: 'pill', visible: this.isColumnVisible('category') },
      { type: 'pill-sm', visible: this.isColumnVisible('brand') },
      { type: 'text-sm', visible: this.isColumnVisible('volume') },
      { type: 'text-sm', visible: this.isColumnVisible('weight') },
      { type: 'text-sm', visible: this.isColumnVisible('tva') },
      { type: 'text-sm', visible: this.isColumnVisible('price') },
      { type: 'stock', visible: this.isColumnVisible('stock') },
      { type: 'toggle', visible: this.isColumnVisible('status') },
      { type: 'actions', visible: this.isColumnVisible('actions') }
    ];
  }

  // Services
  private productService = inject(ProductService);
  private brandService = inject(BrandService);
  private supplierService = inject(SupplierService);
  private purchaseOrderService = inject(PurchaseOrderService);
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
    this.loadProducts();
    this.loadCmup();
    this.loadPriceTiers();
    this.loadLifecycles();
    // On language change, reload to get translations
    onLanguageChange(this.translateService, this.destroyRef, () => this.loadProducts());
    // Refresh lifecycle/cmup when navigating back (route is cached by RouteReuseStrategy)
    inject(Router).events.pipe(
      filter(e => e instanceof NavigationEnd),
      filter((e: NavigationEnd) => e.urlAfterRedirects.includes('/admin/products')),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.loadLifecycles();
      this.loadCmup();
    });
  }

  /** Called by InfiniteScrollDirective when user scrolls near bottom */
  loadMoreProducts(): void {
    if (this.loadingMore() || !this.hasMore()) return;

    this.loadingMore.set(true);
    const nextSkip = this.currentSkip() + this.BATCH_SIZE;

    this.productService.getProductsPaginated({
      skip: nextSkip,
      limit: this.BATCH_SIZE,
      category_id: this.categoryFilter ?? undefined,
      brand_id: this.brandFilter ?? undefined,
      status_filter: this.statusFilter as 'all' | 'active' | 'inactive',
      search: this.searchQuery || undefined
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          // Append new products to existing
          this.displayedProducts.update(products => [...products, ...response.items]);
          this.currentSkip.set(nextSkip);
          this.loadingMore.set(false);
        },
        error: () => {
          this.loadingMore.set(false);
          this.baseToast.showError('admin.products.load_error');
        }
      });
  }

  // Public methods
  hasActiveFilters(): boolean {
    return !!(this.searchQuery?.trim() || this.categoryFilter || this.brandFilter || this.statusFilter !== 'all');
  }

  onCategoryChange(): void {
    this.filterItems();
  }

  onBrandChange(): void {
    this.filterItems();
  }

  // Abstract method implementations
  updatePaginatedItems(): void {
    // Not used - using server-side pagination with infinite scroll
  }

  getSearchDebounceKey(): string {
    return 'products-search';
  }

  override clearFilters() {
    this.searchQuery = '';
    this.categoryFilter = null;
    this.brandFilter = null;
    this.statusFilter = 'all';
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
    this.loadProducts();
  }

  // Inline status editing (using base class helpers)
  startEditStatus(product: Product): void {
    this.priceEdit.cancel();
    this.stockEdit.cancel();
    this.startStatusEdit(this.statusEdit, product);
  }

  cancelEditStatus(): void {
    this.cancelStatusEdit(this.statusEdit);
  }

  isEditingStatus(productId: number): boolean {
    return this.isEditingStatusFor(this.statusEdit, productId);
  }

  toggleEditingStatus(): void {
    this.toggleStatusEditValue(this.statusEdit);
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
          // Reload to get updated counts and filtered results
          this.loadProducts();
          this.statusEdit.cancel();
          this.baseToast.showSuccess(newStatus ? 'admin.products.status_activated' : 'admin.products.status_deactivated');
        },
        error: (error) => {
          this.statusEdit.cancel();
          this.baseToast.showApiError(error, 'admin.products.status_update_failed');
        }
      });
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
          // Update in displayed products
          this.displayedProducts.update(products =>
            products.map(p => p.id === product.id ? { ...p, price: newPrice } : p)
          );
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

  // Inline CMUP editing methods
  startEditCmup(product: Product): void {
    this.cmupEdit.start(product.id, this.getCmup(product.id) ?? 0);
  }

  cancelEditCmup(): void {
    this.cmupEdit.cancel();
  }

  saveCmup(product: Product): void {
    const newCmup = this.cmupEdit.value;
    this.purchaseOrderService.updateCmup(product.id, newCmup)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.cmupMap.update(map => ({ ...map, [product.id]: newCmup }));
          this.cmupEdit.cancel();
          this.baseToast.showSuccess('admin.products.cmup_updated');
        },
        error: (error) => {
          this.cmupEdit.cancel();
          this.baseToast.showApiError(error, 'admin.products.cmup_update_failed');
        }
      });
  }

  isEditingCmup(productId: number): boolean {
    return this.cmupEdit.isEditing(productId);
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
          // Update in displayed products
          this.displayedProducts.update(products =>
            products.map(p => p.id === product.id ? { ...p, stock_quantity: newStock } : p)
          );
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

  navigateToSupplierAnalytics(product: Product, event: Event): void {
    event.stopPropagation();
    this.supplierService.getProductPriceHistory(product.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (history) => {
          const sorted = [...history]
            .filter(h => h.supplier_id != null)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const latest = sorted[0];
          if (!latest?.supplier_id) {
            this.baseToast.showError('admin.products.no_supplier_history');
            return;
          }
          this.baseRouter.navigate(
            [RouteHelpers.adminSupplierDetail(latest.supplier_id)],
            { queryParams: { product: this.getProductName(product) } }
          );
        },
        error: () => this.baseToast.showError('admin.products.no_supplier_history')
      });
  }

  hasMultiplePiecesPerBox(product: Product): boolean {
    return (product.pieces_per_box || 1) > 1;
  }

  getCartonCount(product: Product): number {
    const piecesPerBox = product.pieces_per_box || 1;
    return Math.floor(product.stock_quantity / piecesPerBox);
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

  private loadProducts(): void {
    // Only show skeleton on initial load — not on search/filter refreshes.
    // This prevents the @if(loading) block from destroying the search input and losing focus.
    if (this.displayedProducts().length === 0) {
      this.loading = true;
    }

    this.productService.getProductsPaginated({
      skip: 0,
      limit: this.BATCH_SIZE,
      category_id: this.categoryFilter ?? undefined,
      brand_id: this.brandFilter ?? undefined,
      status_filter: this.statusFilter as 'all' | 'active' | 'inactive',
      search: this.searchQuery || undefined
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.displayedProducts.set(response.items);
          this.totalProducts.set(response.total);
          this.serverActiveCount.set(response.active_count);
          this.serverInactiveCount.set(response.inactive_count);
          this.currentSkip.set(0);
          this.loading = false;
          this.markTableInitialized();
        },
        error: () => {
          this.displayedProducts.set([]);
          this.totalProducts.set(0);
          this.loading = false;
        }
      });
  }

  filterItems(): void {
    // Reload from server with current filters
    this.loadProducts();
  }

  private loadCmup(): void {
    this.purchaseOrderService.getCurrentCmup()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (data) => this.cmupMap.set(data), error: () => {} });
  }

  private loadPriceTiers(): void {
    this.purchaseOrderService.getCmupTiers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (data) => this.priceTiersMap.set(data), error: () => {} });
  }

  private loadLifecycles(): void {
    this.purchaseOrderService.getProductLifecycles()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (data) => this.lifecycleMap.set(data), error: () => {} });
  }

  getProductLifecycle(productId: number): { percentage: number; color: string; label: string; totalLabel: string }[] {
    const lots = this.lifecycleMap()[productId];
    if (!lots?.length) return [];

    const today = new Date(); today.setHours(0, 0, 0, 0);

    // Deduplicate by expiry_date
    const seen = new Set<string>();
    const result = [];

    for (const lc of lots) {
      if (seen.has(lc.expiry_date)) continue;
      seen.add(lc.expiry_date);

      const made   = new Date(lc.made_date);   made.setHours(0, 0, 0, 0);
      const expiry = new Date(lc.expiry_date); expiry.setHours(0, 0, 0, 0);

      const totalLife = expiry.getTime() - made.getTime();
      if (totalLife <= 0) continue;

      const elapsed  = today.getTime() - made.getTime();
      const pct      = Math.min(100, Math.max(0, (elapsed / totalLife) * 100));
      const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);

      let label: string;
      if (diffDays <= 0)       label = 'Expiré';
      else if (diffDays < 30)  label = `${diffDays}j restants`;
      else if (diffDays < 365) label = `${Math.floor(diffDays / 30)} mois restants`;
      else {
        const y = Math.floor(diffDays / 365);
        const m = Math.floor((diffDays % 365) / 30);
        label = m > 0 ? `${y}a ${m}m restants` : `${y} an${y > 1 ? 's' : ''} restants`;
      }

      const totalDays = Math.ceil(totalLife / 86400000);
      let totalLabel: string;
      if (totalDays < 30)       totalLabel = `${totalDays}j`;
      else if (totalDays < 365) totalLabel = `${Math.floor(totalDays / 30)} mois`;
      else {
        const y = Math.floor(totalDays / 365);
        const m = Math.floor((totalDays % 365) / 30);
        totalLabel = m > 0 ? `${y} an${y > 1 ? 's' : ''} ${m} mois` : `${y} an${y > 1 ? 's' : ''}`;
      }

      let color: string;
      if (diffDays <= 0)   color = '#ef4444';
      else if (pct >= 75)  color = '#ef4444';
      else if (pct >= 50)  color = '#f97316';
      else                 color = '#22c55e';

      result.push({ percentage: Math.round(100 - pct), color, label, totalLabel });
    }

    return result;
  }

  getCmup(productId: number): number | null {
    return this.cmupMap()[productId] ?? null;
  }

  getPriceTiers(productId: number): PriceTier[] | null {
    return this.priceTiersMap()[productId] ?? null;
  }

  getProfit(product: Product): number | null {
    const cmup = this.getCmup(product.id);
    if (cmup === null) return null;
    return product.price - cmup;
  }

  getProfitMargin(product: Product): number | null {
    const profit = this.getProfit(product);
    if (profit === null || product.price === 0) return null;
    return (profit / product.price) * 100;
  }

  openLots(product: Product, event: Event): void {
    event.stopPropagation();
    this.lotsProduct.set(product);
    this.lots.set([]);
    this.lotsLoading.set(true);
    this.purchaseOrderService.getProductLots(product.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => { this.lots.set(data); this.lotsLoading.set(false); },
        error: () => this.lotsLoading.set(false)
      });
  }

  closeLotsDrawer(): void {
    if (this.drawerExiting()) return;
    this.drawerExiting.set(true);
    setTimeout(() => {
      this.drawerExiting.set(false);
      this.lotsProduct.set(null);
    }, 220);
  }


  getTimeToExpiry(lot: ProductPurchaseLot): { label: string; color: string; percentage: number | null } | null {
    if (!lot.expiry_date) return null;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const expiry = new Date(lot.expiry_date); expiry.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);

    // Human-readable remaining time
    let label: string;
    if (diffDays < 0)       label = 'Expiré';
    else if (diffDays === 0) label = "Expire aujourd'hui";
    else if (diffDays < 30)  label = `${diffDays} jour${diffDays > 1 ? 's' : ''}`;
    else if (diffDays < 365) label = `${Math.floor(diffDays / 30)} mois`;
    else {
      const y = Math.floor(diffDays / 365);
      const m = Math.floor((diffDays % 365) / 30);
      label = m > 0 ? `${y} an${y > 1 ? 's' : ''} ${m} mois` : `${y} an${y > 1 ? 's' : ''}`;
    }

    // If we have made_date, calculate % of lifecycle consumed
    if (lot.made_date) {
      const made = new Date(lot.made_date); made.setHours(0, 0, 0, 0);
      const totalLife = expiry.getTime() - made.getTime();
      const elapsed   = today.getTime()  - made.getTime();
      const pct = totalLife > 0 ? Math.min(100, Math.max(0, (elapsed / totalLife) * 100)) : 100;

      let color: string;
      if (diffDays <= 0) color = '#ef4444';
      else if (pct >= 75) color = '#ef4444';
      else if (pct >= 50) color = '#f97316';
      else                color = '#22c55e';

      return { label, color, percentage: Math.round(100 - pct) };
    }

    // Fallback without made_date
    const color = diffDays <= 0 ? '#ef4444' : diffDays < 30 ? '#ef4444' : diffDays < 90 ? '#f97316' : '#22c55e';
    return { label, color, percentage: null };
  }

  getLotCmupTrend(index: number): 'up' | 'down' | 'same' | null {
    const prev = this.lots()[index + 1];
    if (!prev) return null;
    const diff = this.lots()[index].cmup - prev.cmup;
    if (diff > 0.01) return 'up';
    if (diff < -0.01) return 'down';
    return 'same';
  }

  private deleteProduct(product: Product): void {
    this.productService.deleteProduct(product.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.baseToast.showSuccess('admin.products.delete_success');
          // Reload to get updated counts
          this.loadProducts();
        },
        error: (error) => {
          this.baseToast.showApiError(error, 'admin.products.delete_failed');
        }
      });
  }

}
