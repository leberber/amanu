import { Component, OnInit, inject, DestroyRef, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConfirmationService } from 'primeng/api';
import { PopoverModule } from 'primeng/popover';
import { TranslateService } from '@ngx-translate/core';

import { ADMIN_LIST_IMPORTS, ADMIN_DIALOG_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { InlineEditState } from '../../../shared/utils/inline-edit-state';
import { TableSkeletonComponent, SkeletonColumn } from '../../../shared/components/table-skeleton/table-skeleton.component';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
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
    TableSkeletonComponent
  ],
  providers: [ConfirmationService],
  templateUrl: './admin-brands.component.html',
  styleUrl: './admin-brands.component.scss'
})
export class AdminBrandsComponent extends BaseAdminListComponent implements OnInit {
  // Data signals
  allBrands = signal<Brand[]>([]);
  brands = signal<Brand[]>([]);
  paginatedBrands = signal<Brand[]>([]);

  // Product counts per brand
  brandProductCounts = signal<{ [brandId: number]: number }>({});

  // Computed counts
  activeCount = computed(() => this.allBrands().filter(b => b.is_active).length);
  inactiveCount = computed(() => this.allBrands().filter(b => !b.is_active).length);

  // UI state signals
  isFullscreen = signal(false);
  tableInitialized = signal(false);

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
  override columnOptions: ColumnOption[] = [
    { field: 'logo', label: 'admin.brands.table.logo', visible: true },
    { field: 'name', label: 'admin.brands.table.name', visible: true },
    { field: 'products', label: 'admin.brands.table.products', visible: true },
    { field: 'status', label: 'admin.brands.table.status', visible: true },
    { field: 'created', label: 'admin.brands.table.created', visible: true },
    { field: 'actions', label: 'admin.brands.table.actions', visible: true }
  ];

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

  ngOnInit() {
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
          // Sort by created_at descending (newest first)
          const sorted = [...brands].sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          this.allBrands.set(sorted);
          this.brands.set(sorted);
          this.loadProductCounts();
          this.updatePaginatedItems();
          this.loading = false;
          setTimeout(() => this.tableInitialized.set(true), 100);
        },
        error: () => {
          this.allBrands.set([]);
          this.brands.set([]);
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
    this.resetPagination();
    this.updatePaginatedItems();
  }

  updatePaginatedItems(): void {
    this.paginatedBrands.set(this.brands().slice(this.first, this.first + this.rows));
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
    this.brandService.deleteBrand(brand.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.allBrands.update(brands => brands.filter(b => b.id !== brand.id));
          this.filterItems();
          this.baseToast.showSuccess('admin.brands.delete_success');
        },
        error: (error) => {
          this.baseToast.showApiError(error, 'admin.brands.delete_failed');
        }
      });
  }

  refreshBrandData() {
    this.loadAllBrands();
  }

  // Inline status editing
  startEditStatus(brand: Brand): void {
    this.statusEdit.start(brand.id, brand.is_active);
  }

  cancelEditStatus(): void {
    this.statusEdit.cancel();
  }

  isEditingStatus(brandId: number): boolean {
    return this.statusEdit.isEditing(brandId);
  }

  toggleEditingStatus(): void {
    this.statusEdit.value = !this.statusEdit.value;
  }

  saveStatus(brand: Brand): void {
    if (!this.statusEdit.hasChanged(brand.is_active)) {
      this.statusEdit.cancel();
      return;
    }

    const newStatus = this.statusEdit.value;
    this.brandService.updateBrand(brand.id, { is_active: newStatus })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.allBrands.update(brands =>
            brands.map(b => b.id === brand.id ? { ...b, is_active: newStatus } : b)
          );
          this.filterItems();
          this.statusEdit.cancel();
          this.baseToast.showSuccess(newStatus ? 'admin.brands.status_activated' : 'admin.brands.status_deactivated');
        },
        error: (error) => {
          this.statusEdit.cancel();
          this.baseToast.showApiError(error, 'admin.brands.status_update_failed');
        }
      });
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    img.parentElement?.querySelector('i')?.classList.remove('hidden');
  }

  getBrandName(brand: Brand): string {
    return this.translationHelper.getBrandName(brand);
  }

  getBrandDescription(brand: Brand): string {
    return this.translationHelper.getBrandDescription(brand);
  }
}
