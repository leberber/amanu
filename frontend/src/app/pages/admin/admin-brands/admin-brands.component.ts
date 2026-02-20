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
import { DateService } from '../../../core/services/date.service';
import { SearchDebounceService } from '../../../core/services/search-debounce.service';
import { Brand } from '../../../models/brand.model';
import { ToastMessageService } from '../../../core/services/toast-message.service';

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
export class AdminBrandsComponent implements OnInit {
  allBrands: Brand[] = [];
  brands: Brand[] = [];
  paginatedBrands: Brand[] = [];
  loading = true;
  searchQuery = '';

  // Pagination
  first = 0;
  rows = 12;

  // Status filter
  statusFilter: 'all' | 'active' | 'inactive' = 'all';

  // Product counts per brand
  brandProductCounts: { [brandId: number]: number } = {};

  private brandService = inject(BrandService);
  private productService = inject(ProductService);
  private toast = inject(ToastMessageService);
  private confirmationService = inject(ConfirmationService);
  private router = inject(Router);
  private translateService = inject(TranslateService);
  private translationHelper = inject(TranslationHelperService);
  private dateService = inject(DateService);
  private searchDebounce = inject(SearchDebounceService);

  ngOnInit() {
    this.loadAllBrands();

    this.translateService.onLangChange.subscribe(() => {
      this.filterBrands();
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
        this.updatePaginatedBrands();
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

  filterBrands() {
    let filtered = [...this.allBrands];

    // Apply status filter
    if (this.statusFilter === 'active') {
      filtered = filtered.filter(brand => brand.is_active);
    } else if (this.statusFilter === 'inactive') {
      filtered = filtered.filter(brand => !brand.is_active);
    }

    // Apply search filter
    if (this.searchQuery?.trim()) {
      const search = this.searchQuery.toLowerCase();
      filtered = filtered.filter(brand =>
        this.getBrandName(brand).toLowerCase().includes(search) ||
        this.getBrandDescription(brand).toLowerCase().includes(search)
      );
    }

    this.brands = filtered;
    this.first = 0; // Reset to first page when filtering
    this.updatePaginatedBrands();
  }

  onStatusFilterChange(status: 'all' | 'active' | 'inactive') {
    this.statusFilter = status;
    this.filterBrands();
  }

  updatePaginatedBrands() {
    this.paginatedBrands = this.brands.slice(this.first, this.first + this.rows);
  }

  onPageChange(event: any) {
    this.first = event.first;
    this.rows = event.rows;
    this.updatePaginatedBrands();
  }

  getBrandProductCount(brandId: number): number {
    return this.brandProductCounts[brandId] || 0;
  }

  onSearchInput() {
    this.searchDebounce.debounce('brands-search', () => {
      this.filterBrands();
    });
  }

  onSearch() {
    this.filterBrands();
  }

  clearFilters() {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.filterBrands();
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
        this.filterBrands();
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

  formatDate(dateString: string): string {
    return this.dateService.formatDate(dateString);
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
