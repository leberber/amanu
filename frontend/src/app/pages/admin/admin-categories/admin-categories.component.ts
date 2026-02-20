// src/app/pages/admin/admin-categories/admin-categories.component.ts
import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { CardModule } from 'primeng/card';

import { TranslateService } from '@ngx-translate/core';
import { ADMIN_LIST_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { onLanguageChange } from '../../../core/utils/language-change.util';
import { ProductService } from '../../../services/product.service';
import { TranslationHelperService } from '../../../core/services/translation-helper.service';
import { Category } from '../../../models/category.model';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { ConfirmationDialogService } from '../../../core/services/confirmation-dialog.service';
import { BaseAdminListComponent } from '../../../shared/base/base-admin-list.component';

@Component({
  selector: 'app-admin-categories',
  standalone: true,
  imports: [
    ...ADMIN_LIST_IMPORTS,
    CardModule
  ],
  providers: [ConfirmationService],
  templateUrl: './admin-categories.component.html',
  styleUrl: './admin-categories.component.scss'
})
export class AdminCategoriesComponent extends BaseAdminListComponent implements OnInit {
  allCategories: Category[] = [];
  categories: Category[] = [];
  paginatedCategories: Category[] = [];

  // Override default rows
  override rows = 12;

  // Status filter
  statusFilter: 'all' | 'active' | 'inactive' = 'all';

  // Store product counts for each category
  categoryProductCounts: { [categoryId: number]: number } = {};

  // Services
  private productService = inject(ProductService);
  private toast = inject(ToastMessageService);
  private confirmationService = inject(ConfirmationService);
  private confirmDialog = inject(ConfirmationDialogService);
  private router = inject(Router);
  private translationHelper = inject(TranslationHelperService);
  private translateService = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    this.loadAllCategories();
    onLanguageChange(this.translateService, this.destroyRef, () => this.filterItems());
  }

  hasActiveFilters(): boolean {
    return !!(this.searchQuery?.trim()) || this.statusFilter !== 'all';
  }

  // Load all categories once on page load
  loadAllCategories() {
    this.loading = true;

    this.productService.getCategories(false).subscribe({ // false = include inactive
      next: (categories) => {
        this.allCategories = categories; // Store all categories
        this.categories = categories;    // Initially display all categories
        this.loadProductCounts(); // Load product counts for each category
        this.updatePaginatedItems();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading categories:', error);
        this.loading = false;
        this.toast.showError('admin.categories.load_error');
      }
    });
  }

  // NEW: Load product counts for all categories
  loadProductCounts() {
    this.allCategories.forEach(category => {
      this.productService.getProductsByCategory(category.id, false).subscribe({
        next: (products) => {
          this.categoryProductCounts[category.id] = products.length;
        },
        error: (error) => {
          console.error(`Error loading products for category ${category.id}:`, error);
          this.categoryProductCounts[category.id] = 0;
        }
      });
    });
  }

  // === Abstract method implementations ===

  filterItems(): void {
    let filtered = [...this.allCategories];

    // Apply status filter
    if (this.statusFilter === 'active') {
      filtered = filtered.filter(category => category.is_active);
    } else if (this.statusFilter === 'inactive') {
      filtered = filtered.filter(category => !category.is_active);
    }

    // Apply search filter
    if (this.hasSearchQuery()) {
      const search = this.searchQuery.toLowerCase();
      filtered = filtered.filter(category =>
        this.getCategoryName(category).toLowerCase().includes(search) ||
        this.getCategoryDescription(category).toLowerCase().includes(search)
      );
    }

    this.categories = filtered;
    this.resetPagination();
    this.updatePaginatedItems();
  }

  updatePaginatedItems(): void {
    this.paginatedCategories = this.categories.slice(this.first, this.first + this.rows);
  }

  getSearchDebounceKey(): string {
    return 'categories-search';
  }

  // === Component-specific methods ===

  onStatusFilterChange(status: 'all' | 'active' | 'inactive') {
    this.statusFilter = status;
    this.filterItems();
  }

  clearFilters() {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.filterItems();
  }

  // Navigation methods
  createNewCategory() {
    this.router.navigate([ROUTES.ADMIN.ADD_CATEGORY]);
  }

  editCategory(category: Category) {
    this.router.navigate([RouteHelpers.adminEditCategory(category.id)]);
  }

  // Delete confirmation
  confirmDeleteCategory(category: Category) {
    this.confirmDialog.confirmDelete(
      this.confirmationService,
      this.getCategoryName(category),
      () => this.deleteCategory(category)
    );
  }

  // After delete, remove from local array and refresh filters
  deleteCategory(category: Category) {
    this.productService.deleteCategory(category.id).subscribe({
      next: () => {
        this.toast.showSuccess('admin.categories.delete_success');
        // Remove deleted category from allCategories array
        this.allCategories = this.allCategories.filter(c => c.id !== category.id);
        // Reapply current filters
        this.filterItems();
      },
      error: (error) => {
        console.error('Error deleting category:', error);
        this.toast.showApiError(error, 'admin.categories.delete_failed');
      }
    });
  }

  // Method to refresh data after adding/editing categories
  refreshCategoryData() {
    this.loadAllCategories();
  }

  getCategoryProductCount(categoryId: number): number {
    // Return the actual count from our loaded data
    return this.categoryProductCounts[categoryId] || 0;
  }

  getCategoryName(category: Category): string {
    return this.translationHelper.getCategoryName(category);
  }

  getCategoryDescription(category: Category): string {
    return this.translationHelper.getCategoryDescription(category);
  }

  getActiveCount(): number {
    return this.allCategories.filter(c => c.is_active).length;
  }

  getInactiveCount(): number {
    return this.allCategories.filter(c => !c.is_active).length;
  }
}