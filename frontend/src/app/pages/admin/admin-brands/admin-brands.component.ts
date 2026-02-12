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
import { MessageService } from 'primeng/api';
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
import { TranslationHelperService } from '../../../core/services/translation-helper.service';
import { DateService } from '../../../core/services/date.service';
import { SearchDebounceService } from '../../../core/services/search-debounce.service';
import { Brand } from '../../../models/brand.model';

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
  providers: [MessageService, ConfirmationService],
  templateUrl: './admin-brands.component.html',
  styles: [`
    :host ::ng-deep .p-datatable-header {
      padding-left: 0 !important;
      padding-right: 0 !important;
    }
  `]
})
export class AdminBrandsComponent implements OnInit {
  allBrands: Brand[] = [];
  brands: Brand[] = [];
  loading = true;
  searchQuery = '';

  private brandService = inject(BrandService);
  private messageService = inject(MessageService);
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
    return !!(this.searchQuery?.trim());
  }

  loadAllBrands() {
    this.loading = true;

    this.brandService.getBrands(false).subscribe({
      next: (brands) => {
        this.allBrands = brands;
        this.brands = brands;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading brands:', error);
        this.loading = false;

        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: this.translateService.instant('admin.brands.load_error')
        });
      }
    });
  }

  filterBrands() {
    let filtered = [...this.allBrands];

    if (this.searchQuery?.trim()) {
      const search = this.searchQuery.toLowerCase();
      filtered = filtered.filter(brand =>
        this.getBrandName(brand).toLowerCase().includes(search) ||
        this.getBrandDescription(brand).toLowerCase().includes(search)
      );
    }

    this.brands = filtered;
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
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('common.success'),
          detail: this.translateService.instant('admin.brands.delete_success')
        });

        this.allBrands = this.allBrands.filter(b => b.id !== brand.id);
        this.filterBrands();
      },
      error: (error) => {
        console.error('Error deleting brand:', error);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: error.error?.detail || this.translateService.instant('admin.brands.delete_failed')
        });
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
}
