import { inject, Directive } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { DateService } from '../../core/services/date.service';
import { SearchDebounceService } from '../../core/services/search-debounce.service';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { ROUTES } from '../../core/constants/routes.constants';

export interface ColumnOption {
  field: string;
  label: string;
  visible: boolean;
}

@Directive()
export abstract class BaseAdminListComponent {
  // Common state
  loading = true;
  searchQuery = '';

  // Pagination state
  first = 0;
  rows = 10;
  rowsPerPageOptions = [10, 20, 25, 50];

  // Column visibility (override in child class with specific columns)
  columnOptions: ColumnOption[] = [];

  // Status filter state (optional - use if component has status filtering)
  statusFilter: string = 'all';

  // Injected services
  protected dateService = inject(DateService);
  protected searchDebounce = inject(SearchDebounceService);
  protected baseToast = inject(ToastMessageService);
  protected baseRouter = inject(Router);

  // Pagination
  onPageChange(event: { first?: number; rows?: number }): void {
    this.first = event.first ?? 0;
    this.rows = event.rows ?? this.rows;
    this.updatePaginatedItems();
  }

  setRowsPerPage(rows: number): void {
    this.rows = rows;
    this.first = 0;
    this.updatePaginatedItems();
  }

  // Column visibility
  toggleColumn(field: string): void {
    const col = this.columnOptions.find(c => c.field === field);
    if (col) {
      col.visible = !col.visible;
    }
  }

  isColumnVisible(field: string): boolean {
    const col = this.columnOptions.find(c => c.field === field);
    return col ? col.visible : true;
  }

  // Search
  onSearchInput(): void {
    this.searchDebounce.debounce(this.getSearchDebounceKey(), () => {
      this.filterItems();
    });
  }

  // Date formatting
  formatDate(dateString: string): string {
    return this.dateService.formatDate(dateString);
  }

  protected resetPagination(): void {
    this.first = 0;
  }

  protected hasSearchQuery(): boolean {
    return !!(this.searchQuery?.trim());
  }

  // Status filter helpers
  onStatusFilterChange(status: string): void {
    this.statusFilter = status;
    this.first = 0;
    this.filterItems();
  }

  protected getCountByPredicate<T>(items: T[], predicate: (item: T) => boolean): number {
    return items.filter(predicate).length;
  }

  protected filterByActiveStatus<T extends { is_active: boolean }>(items: T[]): T[] {
    if (this.statusFilter === 'active') {
      return items.filter(item => item.is_active);
    } else if (this.statusFilter === 'inactive') {
      return items.filter(item => !item.is_active);
    }
    return items;
  }

  // Data loading helpers
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

  protected loadDataSilent<T>(
    loadFn: () => Observable<T>,
    onSuccess: (data: T) => void,
    onError?: (error: any) => void
  ): void {
    loadFn().subscribe({
      next: onSuccess,
      error: (error) => {
        onError?.(error);
      }
    });
  }

  // Delete operation helpers
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
        this.baseToast.showApiError(error, errorMessageKey);
      }
    });
  }

  // Filter helpers
  clearFilters(): void {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.resetPagination();
    this.filterItems();
  }

  // Inline update helpers
  protected handleInlineUpdate<T extends { id: number }, V>(
    updateFn: () => Observable<any>,
    allItems: T[],
    displayItems: T[],
    itemId: number,
    fieldName: keyof T,
    newValue: V,
    successMessageKey: string,
    errorMessageKey: string,
    onComplete?: () => void
  ): void {
    updateFn().subscribe({
      next: () => {
        // Update in allItems
        const allIndex = allItems.findIndex(item => item.id === itemId);
        if (allIndex !== -1) {
          (allItems[allIndex] as any)[fieldName] = newValue;
        }
        // Update in displayItems
        const displayIndex = displayItems.findIndex(item => item.id === itemId);
        if (displayIndex !== -1) {
          (displayItems[displayIndex] as any)[fieldName] = newValue;
        }

        this.baseToast.showSuccess(successMessageKey);
        onComplete?.();
      },
      error: (error) => {
        this.baseToast.showError(errorMessageKey);
      }
    });
  }

  // Abstract methods
  abstract filterItems(): void;
  abstract updatePaginatedItems(): void;
  abstract getSearchDebounceKey(): string;
}
