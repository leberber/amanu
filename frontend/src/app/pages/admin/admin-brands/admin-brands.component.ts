// src/app/pages/admin/admin-brands/admin-brands.component.ts
import { Component, OnInit, inject, DestroyRef, signal } from '@angular/core';
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
  allBrands: Brand[] = [];
  brands: Brand[] = [];
  paginatedBrands: Brand[] = [];

  // Animation state
  tableInitialized = signal(false);

  // Fullscreen mode
  isFullscreen = false;

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

  // Product counts per brand
  brandProductCounts: { [brandId: number]: number } = {};

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

  loadAllBrands() {
    this.loading = true;
    this.brandService.getBrands(false).subscribe({
      next: (brands) => {
        this.allBrands = brands;
        this.brands = brands;
        this.loadProductCounts();
        this.updatePaginatedItems();
        this.loading = false;
        setTimeout(() => this.tableInitialized.set(true), 100);
      },
      error: () => {
        this.loading = false;
        this.baseToast.showError('admin.brands.load_error');
      }
    });
  }

  loadProductCounts() {
    this.allBrands.forEach(brand => {
      this.loadDataSilent(
        () => this.productService.getProductsByBrand(brand.id, false),
        (products) => { this.brandProductCounts[brand.id] = products.length; },
        () => { this.brandProductCounts[brand.id] = 0; }
      );
    });
  }

  // === Abstract method implementations ===

  filterItems(): void {
    // Apply status filter using base class helper
    let filtered = this.filterByActiveStatus(this.allBrands);

    // Apply search filter
    if (this.hasSearchQuery()) {
      const search = this.searchQuery.toLowerCase();
      filtered = filtered.filter(brand =>
        this.getBrandName(brand).toLowerCase().includes(search) ||
        this.getBrandDescription(brand).toLowerCase().includes(search)
      );
    }

    this.brands = filtered;
    this.resetPagination();
    this.updatePaginatedItems();
  }

  updatePaginatedItems(): void {
    this.paginatedBrands = this.brands.slice(this.first, this.first + this.rows);
  }

  getSearchDebounceKey(): string {
    return 'brands-search';
  }

  // === Component-specific methods ===

  getBrandProductCount(brandId: number): number {
    return this.brandProductCounts[brandId] || 0;
  }

  override clearFilters() {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.filterItems();
  }

  toggleFullscreen(): void {
    this.isFullscreen = !this.isFullscreen;
    if (this.isFullscreen) {
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

  deleteBrand(brand: Brand) {
    this.handleDelete(
      () => this.brandService.deleteBrand(brand.id),
      this.allBrands,
      brand.id,
      (updated) => { this.allBrands = updated; },
      'admin.brands.delete_success',
      'admin.brands.delete_failed'
    );
  }

  refreshBrandData() {
    this.loadAllBrands();
  }

  // ===== INLINE STATUS EDITING =====

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

    this.handleInlineUpdate(
      () => this.brandService.updateBrand(brand.id, { is_active: newStatus }),
      this.allBrands,
      this.brands,
      brand.id,
      'is_active',
      newStatus,
      newStatus ? 'admin.brands.status_activated' : 'admin.brands.status_deactivated',
      'admin.brands.status_update_failed',
      () => this.statusEdit.cancel()
    );
  }

  getBrandName(brand: Brand): string {
    return this.translationHelper.getBrandName(brand);
  }

  getBrandDescription(brand: Brand): string {
    return this.translationHelper.getBrandDescription(brand);
  }

  getActiveCount(): number {
    return this.getCountByPredicate(this.allBrands, b => b.is_active);
  }

  getInactiveCount(): number {
    return this.getCountByPredicate(this.allBrands, b => !b.is_active);
  }
}
