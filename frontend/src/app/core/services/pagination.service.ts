import { Injectable } from '@angular/core';
import { PAGINATION } from '../constants/app.constants';

export interface PaginationState {
  page: number;
  pageSize: number;
  totalRecords: number;
}

/**
 * Simple service to handle common pagination logic
 * Reduces duplicate pagination code across components
 */
@Injectable({
  providedIn: 'root'
})
export class PaginationService {
  
  /**
   * Get default pagination state
   */
  getDefaultState(): PaginationState {
    return {
      page: PAGINATION.DEFAULT_PAGE,
      pageSize: PAGINATION.DEFAULT_PAGE_SIZE,
      totalRecords: 0
    };
  }

  /**
   * Get page size options
   */
  getPageSizeOptions(): number[] {
    return PAGINATION.PAGE_SIZE_OPTIONS;
  }

  /**
   * Calculate paginated items
   * @param items - All items
   * @param page - Current page (1-based)
   * @param pageSize - Items per page
   * @returns Paginated items
   */
  paginate<T>(items: T[], page: number, pageSize: number): T[] {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return items.slice(startIndex, endIndex);
  }

  /**
   * Get pagination info for display
   * @param state - Current pagination state
   * @returns Object with pagination display info
   */
  getPaginationInfo(state: PaginationState) {
    const start = (state.page - 1) * state.pageSize + 1;
    const end = Math.min(state.page * state.pageSize, state.totalRecords);
    const totalPages = Math.ceil(state.totalRecords / state.pageSize);

    return {
      start,
      end,
      total: state.totalRecords,
      currentPage: state.page,
      totalPages,
      hasNext: state.page < totalPages,
      hasPrevious: state.page > 1
    };
  }

  /**
   * Handle page change
   * @param currentState - Current pagination state
   * @param newPage - New page number
   * @returns Updated pagination state
   */
  changePage(currentState: PaginationState, newPage: number): PaginationState {
    return {
      ...currentState,
      page: newPage
    };
  }

  /**
   * Handle page size change
   * @param currentState - Current pagination state
   * @param newPageSize - New page size
   * @returns Updated pagination state (resets to page 1)
   */
  changePageSize(currentState: PaginationState, newPageSize: number): PaginationState {
    return {
      ...currentState,
      pageSize: newPageSize,
      page: 1 // Reset to first page when changing page size
    };
  }

  /**
   * Update total records
   * @param currentState - Current pagination state
   * @param totalRecords - New total records count
   * @returns Updated pagination state
   */
  updateTotalRecords(currentState: PaginationState, totalRecords: number): PaginationState {
    const totalPages = Math.ceil(totalRecords / currentState.pageSize);
    const page = currentState.page > totalPages ? 1 : currentState.page;

    return {
      ...currentState,
      totalRecords,
      page
    };
  }
}