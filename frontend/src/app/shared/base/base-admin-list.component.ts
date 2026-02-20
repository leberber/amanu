// src/app/shared/base/base-admin-list.component.ts
import { inject, Directive } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { DateService } from '../../core/services/date.service';
import { SearchDebounceService } from '../../core/services/search-debounce.service';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { ROUTES } from '../../core/constants/routes.constants';

/**
 * Abstract base class for admin list components.
 * Provides common pagination, search debounce, date formatting, status filtering,
 * data loading, and CRUD operation helpers.
 *
 * Usage:
 * 1. Extend this class in your admin list component
 * 2. Implement the abstract methods: filterItems(), updatePaginatedItems(), getSearchDebounceKey()
 * 3. Use helper methods for common operations
 */
@Directive()
export abstract class BaseAdminListComponent {
  // Common state
  loading = true;
  searchQuery = '';

  // Pagination state
  first = 0;
  rows = 10;

  // Status filter state (optional - use if component has status filtering)
  statusFilter: string = 'all';

  // Injected services
  protected dateService = inject(DateService);
  protected searchDebounce = inject(SearchDebounceService);
  protected baseToast = inject(ToastMessageService);
  protected baseRouter = inject(Router);

  /**
   * Handle pagination change event from p-paginator
   */
  onPageChange(event: { first?: number; rows?: number }): void {
    this.first = event.first ?? 0;
    this.rows = event.rows ?? this.rows;
    this.updatePaginatedItems();
  }

  /**
   * Handle search input with debounce
   */
  onSearchInput(): void {
    this.searchDebounce.debounce(this.getSearchDebounceKey(), () => {
      this.filterItems();
    });
  }

  /**
   * Format date string using DateService
   */
  formatDate(dateString: string): string {
    return this.dateService.formatDate(dateString);
  }

  /**
   * Reset pagination to first page
   */
  protected resetPagination(): void {
    this.first = 0;
  }

  /**
   * Check if search query has content
   */
  protected hasSearchQuery(): boolean {
    return !!(this.searchQuery?.trim());
  }

  // ===== STATUS FILTER HELPERS =====

  /**
   * Handle status filter change. Call this from your component's status filter handler.
   * Resets pagination and triggers filterItems().
   */
  onStatusFilterChange(status: string): void {
    this.statusFilter = status;
    this.first = 0;
    this.filterItems();
  }

  /**
   * Get count of items matching a predicate.
   * Usage: getCountByPredicate(this.allItems, item => item.is_active)
   */
  protected getCountByPredicate<T>(items: T[], predicate: (item: T) => boolean): number {
    return items.filter(predicate).length;
  }

  /**
   * Filter items by active status. Use in filterItems() implementation.
   * Returns filtered array based on current statusFilter ('all', 'active', 'inactive').
   */
  protected filterByActiveStatus<T extends { is_active: boolean }>(items: T[]): T[] {
    if (this.statusFilter === 'active') {
      return items.filter(item => item.is_active);
    } else if (this.statusFilter === 'inactive') {
      return items.filter(item => !item.is_active);
    }
    return items;
  }

  // ===== DATA LOADING HELPERS =====

  /**
   * Generic data loading helper with standardized error handling.
   * Handles loading state, permission errors (403), and toast notifications.
   *
   * Usage:
   * this.loadData(
   *   () => this.productService.getProducts(),
   *   (products) => {
   *     this.allProducts = products;
   *     this.products = products;
   *     this.updatePaginatedItems();
   *   },
   *   'admin.products.load_error'
   * );
   */
  protected loadData<T>(
    loadFn: () => Observable<T>,
    onSuccess: (data: T) => void,
    errorMessageKey: string
  ): void {
    this.loading = true;
    loadFn().subscribe({
      next: (data) => {
        onSuccess(data);
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading data:', error);
        this.loading = false;
        if (error.status === 403) {
          this.baseToast.showPermissionDenied();
          this.baseRouter.navigate([ROUTES.HOME]);
        } else {
          this.baseToast.showError(errorMessageKey);
        }
      }
    });
  }

  /**
   * Load data silently (no loading state change, no permission redirect).
   * Useful for secondary data loads like product counts.
   */
  protected loadDataSilent<T>(
    loadFn: () => Observable<T>,
    onSuccess: (data: T) => void,
    onError?: (error: any) => void
  ): void {
    loadFn().subscribe({
      next: onSuccess,
      error: (error) => {
        console.error('Error loading data:', error);
        onError?.(error);
      }
    });
  }

  // ===== DELETE OPERATION HELPERS =====

  /**
   * Handle delete operation with standardized success/error handling.
   * Updates the local array and triggers filterItems().
   *
   * Usage:
   * this.handleDelete(
   *   () => this.productService.deleteProduct(product.id),
   *   this.allProducts,
   *   product.id,
   *   (updatedArray) => { this.allProducts = updatedArray; },
   *   'admin.products.delete_success',
   *   'admin.products.delete_failed'
   * );
   */
  protected handleDelete<T extends { id: number }>(
    deleteFn: () => Observable<any>,
    allItems: T[],
    itemId: number,
    updateArray: (items: T[]) => void,
    successMessageKey: string,
    errorMessageKey: string
  ): void {
    deleteFn().subscribe({
      next: () => {
        this.baseToast.showSuccess(successMessageKey);
        const updatedItems = allItems.filter(item => item.id !== itemId);
        updateArray(updatedItems);
        this.filterItems();
      },
      error: (error) => {
        console.error('Error deleting item:', error);
        this.baseToast.showApiError(error, errorMessageKey);
      }
    });
  }

  // ===== ABSTRACT METHODS =====

  /**
   * Filter the items based on current filter state.
   * Should update the filtered items array and call updatePaginatedItems().
   */
  abstract filterItems(): void;

  /**
   * Update the paginated items array based on current pagination state.
   * Typically: this.paginatedItems = this.items.slice(this.first, this.first + this.rows)
   */
  abstract updatePaginatedItems(): void;

  /**
   * Return a unique key for search debounce.
   * Example: 'users-search', 'products-search'
   */
  abstract getSearchDebounceKey(): string;
}
