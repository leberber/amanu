// src/app/pages/admin/admin-brands/admin-brands.component.ts
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
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { BrandService } from '../../../core/services/brand.service';
import { ProductService } from '../../../services/product.service';
import { TranslationHelperService } from '../../../core/services/translation-helper.service';
import { Brand } from '../../../models/brand.model';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { BaseAdminListComponent } from '../../../shared/base/base-admin-list.component';

@Component({
  selector: 'app-admin-brands',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    ToastModule,
    TagModule,
    PaginatorModule,
    ConfirmDialogModule,
    IconFieldModule,
    InputIconModule,
    TooltipModule,
    ProgressSpinnerModule,
    TranslateModule
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

  // Status filter
  statusFilter: 'all' | 'active' | 'inactive' = 'all';

  // Product counts per brand
  brandProductCounts: { [brandId: number]: number } = {};

  // Services
  private brandService = inject(BrandService);
  private productService = inject(ProductService);
  private toast = inject(ToastMessageService);
  private confirmationService = inject(ConfirmationService);
  private router = inject(Router);
  private translateService = inject(TranslateService);
  private translationHelper = inject(TranslationHelperService);

  ngOnInit() {
    this.loadAllBrands();

    this.translateService.onLangChange.subscribe(() => {
      this.filterItems();
    });
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
      },
      error: (error) => {
        console.error('Error loading brands:', error);
        this.loading = false;
        this.toast.showError('admin.brands.load_error');
      }
    });
  }

  loadProductCounts() {
    this.allBrands.forEach(brand => {
      this.productService.getProductsByBrand(brand.id, false).subscribe({
        next: (products) => {
          this.brandProductCounts[brand.id] = products.length;
        },
        error: (error) => {
          console.error(`Error loading products for brand ${brand.id}:`, error);
          this.brandProductCounts[brand.id] = 0;
        }
      });
    });
  }

  // === Abstract method implementations ===

  filterItems(): void {
    let filtered = [...this.allBrands];

    // Apply status filter
    if (this.statusFilter === 'active') {
      filtered = filtered.filter(brand => brand.is_active);
    } else if (this.statusFilter === 'inactive') {
      filtered = filtered.filter(brand => !brand.is_active);
    }

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

  onStatusFilterChange(status: 'all' | 'active' | 'inactive') {
    this.statusFilter = status;
    this.filterItems();
  }

  getBrandProductCount(brandId: number): number {
    return this.brandProductCounts[brandId] || 0;
  }

  clearFilters() {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.filterItems();
  }

  createNewBrand() {
    this.router.navigate(['/admin/brands/add']);
  }

  editBrand(brand: Brand) {
    this.router.navigate(['/admin/brands/edit', brand.id]);
  }

  confirmDeleteBrand(brand: Brand) {
    const brandName = this.getBrandName(brand);
    this.confirmationService.confirm({
      message: this.translateService.instant('common.confirm_delete_message', { item: brandName }),
      header: this.translateService.instant('common.confirm_delete'),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      acceptLabel: this.translateService.instant('common.delete'),
      rejectLabel: this.translateService.instant('common.cancel'),
      accept: () => this.deleteBrand(brand)
    });
  }

  deleteBrand(brand: Brand) {
    this.brandService.deleteBrand(brand.id).subscribe({
      next: () => {
        this.toast.showSuccess('admin.brands.delete_success');
        this.allBrands = this.allBrands.filter(b => b.id !== brand.id);
        this.filterItems();
      },
      error: (error) => {
        console.error('Error deleting brand:', error);
        this.toast.showApiError(error, 'admin.brands.delete_failed');
      }
    });
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
    return this.allBrands.filter(b => b.is_active).length;
  }

  getInactiveCount(): number {
    return this.allBrands.filter(b => !b.is_active).length;
  }
}
