// src/app/pages/admin/admin-categories/admin-categories.component.ts
import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { CardModule } from 'primeng/card';

import { TranslateService } from '@ngx-translate/core';
import { ADMIN_LIST_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { onLanguageChange } from '../../../core/utils/language-change.util';
import { ProductService } from '../../../services/product.service';
import { TranslationHelperService } from '../../../core/services/translation-helper.service';
import { Category } from '../../../models/category.model';
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

  // Store product counts for each category
  categoryProductCounts: { [categoryId: number]: number } = {};

  // Services
  private productService = inject(ProductService);
  private confirmationService = inject(ConfirmationService);
  private confirmDialog = inject(ConfirmationDialogService);
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
    this.loadData(
      () => this.productService.getCategories(false), // false = include inactive
      (categories) => {
        this.allCategories = categories;
        this.categories = categories;
        this.loadProductCounts();
        this.updatePaginatedItems();
      },
      'admin.categories.load_error'
    );
  }

  // Load product counts for all categories
  loadProductCounts() {
    this.allCategories.forEach(category => {
      this.loadDataSilent(
        () => this.productService.getProductsByCategory(category.id, false),
        (products) => { this.categoryProductCounts[category.id] = products.length; },
        () => { this.categoryProductCounts[category.id] = 0; }
      );
    });
  }

  // === Abstract method implementations ===

  filterItems(): void {
    // Apply status filter using base class helper
    let filtered = this.filterByActiveStatus(this.allCategories);

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

  clearFilters() {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.filterItems();
  }

  // Navigation methods
  createNewCategory() {
    this.baseRouter.navigate([ROUTES.ADMIN.ADD_CATEGORY]);
  }

  editCategory(category: Category) {
    this.baseRouter.navigate([RouteHelpers.adminEditCategory(category.id)]);
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
    this.handleDelete(
      () => this.productService.deleteCategory(category.id),
      this.allCategories,
      category.id,
      (updated) => { this.allCategories = updated; },
      'admin.categories.delete_success',
      'admin.categories.delete_failed'
    );
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
    return this.getCountByPredicate(this.allCategories, c => c.is_active);
  }

  getInactiveCount(): number {
    return this.getCountByPredicate(this.allCategories, c => !c.is_active);
  }
}