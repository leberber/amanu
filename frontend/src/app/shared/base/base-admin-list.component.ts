// src/app/shared/base/base-admin-list.component.ts
import { inject, Directive } from '@angular/core';
import { DateService } from '../../core/services/date.service';
import { SearchDebounceService } from '../../core/services/search-debounce.service';

/**
 * Abstract base class for admin list components.
 * Provides common pagination, search debounce, and date formatting logic.
 *
 * Usage:
 * 1. Extend this class in your admin list component
 * 2. Implement the abstract methods: filterItems(), updatePaginatedItems(), getSearchDebounceKey()
 * 3. Call super.onSearchInput() or use the inherited onSearchInput() directly
 */
@Directive()
export abstract class BaseAdminListComponent {
  // Common state
  loading = true;
  searchQuery = '';

  // Pagination state
  first = 0;
  rows = 10;

  // Injected services
  protected dateService = inject(DateService);
  protected searchDebounce = inject(SearchDebounceService);

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

  // Abstract methods - must be implemented by child classes

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
