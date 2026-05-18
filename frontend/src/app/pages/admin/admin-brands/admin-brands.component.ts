import { Component, OnInit, inject, DestroyRef, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConfirmationService } from 'primeng/api';
import { PopoverModule } from 'primeng/popover';
import { TranslateService } from '@ngx-translate/core';

import { ADMIN_LIST_IMPORTS, ADMIN_DIALOG_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { InlineEditState } from '../../../shared/utils/inline-edit-state';
import { TableSkeletonComponent, SkeletonColumn } from '../../../shared/components/table-skeleton/table-skeleton.component';
import { TableLoadingRowsComponent, LoadingColumn } from '../../../shared/components/table-loading-rows/table-loading-rows.component';
import { InfiniteScrollDirective } from '../../../shared/directives/infinite-scroll.directive';
import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { BreakpointService } from '../../../core/services/breakpoint.service';
import { onLanguageChange } from '../../../core/utils/language-change.util';
import { BrandService } from '../../../core/services/brand.service';
import { ProductService } from '../../../services/product.service';
import { TranslationHelperService } from '../../../core/services/translation-helper.service';
import { Brand } from '../../../models/brand.model';
import { ConfirmationDialogService } from '../../../core/services/confirmation-dialog.service';
import { BaseAdminListComponent, ColumnOption } from '../../../shared/base/base-admin-list.component';

@Component({
  selector: 'app-admin-brands',
  standalone: true,
  imports: [
    ...ADMIN_LIST_IMPORTS,
    ...ADMIN_DIALOG_IMPORTS,
    PopoverModule,
    TableSkeletonComponent,
    TableLoadingRowsComponent,
    InfiniteScrollDirective,
    AgroclikPageContainerComponent
  ],
  providers: [ConfirmationService],
  templateUrl: './admin-brands.component.html',
  styleUrl: './admin-brands.component.scss'
})
export class AdminBrandsComponent extends BaseAdminListComponent implements OnInit {
  // Infinite scroll configuration
  private readonly BATCH_SIZE = 100;

  // Data signals
  allBrands = signal<Brand[]>([]);
  brands = signal<Brand[]>([]);
  displayedBrands = signal<Brand[]>([]);
  loadingMore = signal(false);
  hasMore = computed(() => this.displayedBrands().length < this.brands().length);

  // Product counts per brand
  brandProductCounts = signal<{ [brandId: number]: number }>({});

  // Computed counts
  activeCount = computed(() => this.allBrands().filter(b => b.is_active).length);
  inactiveCount = computed(() => this.allBrands().filter(b => !b.is_active).length);

  // Skeleton configuration
  skeletonColumns: SkeletonColumn[] = [
    { width: '8%', type: 'image', headerWidth: '0' },
    { width: '30%', type: 'text-multi', headerWidth: '100px' },
    { width: '15%', type: 'pill', headerWidth: '80px' },
    { width: '15%', type: 'toggle', headerWidth: '60px' },
    { width: '15%', type: 'text', headerWidth: '70px' },
    { width: '17%', type: 'actions', headerWidth: '60px' }
  ];

  // Column visibility options
  // MOBILE COLUMN VISIBILITY: On mobile, only show essential columns (name, products, status)
  // Other columns can be toggled back from table options menu
  override columnOptions: ColumnOption[] = [];

  private getInitialColumnOptions(): ColumnOption[] {
    const isMobile = this.breakpoint.isMobile();

    return [
      { field: 'logo', label: 'admin.brands.table.logo', visible: !isMobile },
      { field: 'name', label: 'admin.brands.table.name', visible: true },
      { field: 'products', label: 'admin.brands.table.products', visible: true },
      { field: 'status', label: 'admin.brands.table.status', visible: true },
      { field: 'created', label: 'admin.brands.table.created', visible: !isMobile },
      { field: 'actions', label: 'admin.brands.table.actions', visible: !isMobile }
    ];
  }

  // Inline editing state
  statusEdit = new InlineEditState<boolean>(true);

  // Services
  private brandService = inject(BrandService);
  private productService = inject(ProductService);
  private confirmationService = inject(ConfirmationService);
  private confirmDialog = inject(ConfirmationDialogService);
  private translationHelper = inject(TranslationHelperService);
  private translateService = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private readonly breakpoint = inject(BreakpointService);

  ngOnInit() {
    this.columnOptions = this.getInitialColumnOptions();
    this.loadAllBrands();
    onLanguageChange(this.translateService, this.destroyRef, () => this.filterItems());
  }

  hasActiveFilters(): boolean {
    return !!(this.searchQuery?.trim()) || this.statusFilter !== 'all';
  }

  loadAllBrands(): void {
    this.loading = true;
    this.brandService.getBrands(false)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (brands) => {
          const sorted = this.sortByCreatedAt(brands);
          this.allBrands.set(sorted);
          this.brands.set(sorted);
          this.displayedBrands.set(sorted.slice(0, this.BATCH_SIZE));
          this.loadProductCounts();
          this.loading = false;
          this.markTableInitialized();
        },
        error: () => {
          this.allBrands.set([]);
          this.brands.set([]);
          this.displayedBrands.set([]);
          this.loading = false;
          this.baseToast.showError('admin.brands.load_error');
        }
      });
  }

  loadProductCounts(): void {
    this.allBrands().forEach(brand => {
      this.productService.getProductsByBrand(brand.id, false)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (products) => {
            this.brandProductCounts.update(counts => ({
              ...counts,
              [brand.id]: products.length
            }));
          },
          error: () => {
            this.brandProductCounts.update(counts => ({
              ...counts,
              [brand.id]: 0
            }));
          }
        });
    });
  }

  // Abstract method implementations
  filterItems(): void {
    // Apply status filter using base class helper
    let filtered = this.filterByActiveStatus(this.allBrands());

    // Apply search filter
    if (this.hasSearchQuery()) {
      const search = this.searchQuery.toLowerCase();
      filtered = filtered.filter(brand =>
        this.getBrandName(brand).toLowerCase().includes(search) ||
        this.getBrandDescription(brand).toLowerCase().includes(search)
      );
    }

    this.brands.set(filtered);
    this.displayedBrands.set(filtered.slice(0, this.BATCH_SIZE));
  }

  updatePaginatedItems(): void {
    this.displayedBrands.set(this.brands().slice(0, this.BATCH_SIZE));
  }

  /** Called by InfiniteScrollDirective when user scrolls near bottom */
  loadMoreBrands(): void {
    if (this.loadingMore() || !this.hasMore()) return;

    this.loadingMore.set(true);
    const current = this.displayedBrands().length;
    const next = this.brands().slice(current, current + this.BATCH_SIZE);

    // Small delay to show loading state
    setTimeout(() => {
      this.displayedBrands.update(brands => [...brands, ...next]);
      this.loadingMore.set(false);
    }, 300);
  }

  getLoadingColumns(): LoadingColumn[] {
    return this.columnOptions
      .filter(col => col.visible)
      .map(col => ({ type: col.field === 'logo' ? 'image' as const : 'text' as const }));
  }

  getSearchDebounceKey(): string {
    return 'brands-search';
  }

  // Component-specific methods
  getBrandProductCount(brandId: number): number {
    return this.brandProductCounts()[brandId] || 0;
  }

  override clearFilters() {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.filterItems();
  }

  createNewBrand() {
    this.baseRouter.navigate([ROUTES.ADMIN.ADD_BRAND]);
  }

  editBrand(brand: Brand) {
    this.baseRouter.navigate([RouteHelpers.adminEditBrand(brand.id)]);
  }

  confirmDeleteBrand(brand: Brand) {
    this.confirmDialog.confirmDelete(
      this.confirmationService,
      this.getBrandName(brand),
      () => this.deleteBrand(brand)
    );
  }

  deleteBrand(brand: Brand): void {
    this.handleDeleteWithSignal(
      () => this.brandService.deleteBrand(brand.id),
      this.allBrands,
      brand.id,
      'admin.brands.delete_success',
      'admin.brands.delete_failed'
    );
  }

  refreshBrandData() {
    this.loadAllBrands();
  }

  // Inline status editing (using base class helpers)
  startEditStatus(brand: Brand): void {
    this.startStatusEdit(this.statusEdit, brand);
  }

  cancelEditStatus(): void {
    this.cancelStatusEdit(this.statusEdit);
  }

  isEditingStatus(brandId: number): boolean {
    return this.isEditingStatusFor(this.statusEdit, brandId);
  }

  toggleEditingStatus(): void {
    this.toggleStatusEditValue(this.statusEdit);
  }

  saveStatus(brand: Brand): void {
    this.saveStatusChange(
      this.statusEdit,
      brand,
      (id, data) => this.brandService.updateBrand(id, data),
      this.allBrands,
      'admin.brands.status_activated',
      'admin.brands.status_deactivated',
      'admin.brands.status_update_failed'
    );
  }

  getBrandName(brand: Brand): string {
    return this.translationHelper.getBrandName(brand);
  }

  getBrandDescription(brand: Brand): string {
    return this.translationHelper.getBrandDescription(brand);
  }
}
