// src/app/pages/admin/admin-brands/admin-brands.component.ts
import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { CardModule } from 'primeng/card';

import { TranslateService } from '@ngx-translate/core';
import { ADMIN_LIST_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { onLanguageChange } from '../../../core/utils/language-change.util';
import { BrandService } from '../../../core/services/brand.service';
import { ProductService } from '../../../services/product.service';
import { TranslationHelperService } from '../../../core/services/translation-helper.service';
import { Brand } from '../../../models/brand.model';
import { ConfirmationDialogService } from '../../../core/services/confirmation-dialog.service';
import { BaseAdminListComponent } from '../../../shared/base/base-admin-list.component';

@Component({
  selector: 'app-admin-brands',
  standalone: true,
  imports: [
    ...ADMIN_LIST_IMPORTS,
    CardModule
  ],
  providers: [ConfirmationService],
  templateUrl: './admin-brands.component.html',
  styleUrl: './admin-brands.component.scss'
})
export class AdminBrandsComponent extends BaseAdminListComponent implements OnInit {
  allBrands: Brand[] = [];
  brands: Brand[] = [];
  paginatedBrands: Brand[] = [];

  // Override default rows
  override rows = 12;

  // Product counts per brand
  brandProductCounts: { [brandId: number]: number } = {};

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
    this.loadData(
      () => this.brandService.getBrands(false),
      (brands) => {
        this.allBrands = brands;
        this.brands = brands;
        this.loadProductCounts();
        this.updatePaginatedItems();
      },
      'admin.brands.load_error'
    );
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
