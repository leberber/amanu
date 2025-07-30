import { Injectable, signal } from '@angular/core';

/**
 * Simple service to manage loading states
 * Avoids duplicate loading logic across components
 */
@Injectable({
  providedIn: 'root'
})
export class LoadingStateService {
  // Map to track multiple loading states
  private states = new Map<string, boolean>();
  
  /**
   * Set loading state for a specific operation
   * @param key - Unique key for this operation
   * @param isLoading - Loading state
   */
  setLoading(key: string, isLoading: boolean): void {
    if (isLoading) {
      this.states.set(key, true);
    } else {
      this.states.delete(key);
    }
  }

  /**
   * Check if a specific operation is loading
   * @param key - Key to check
   * @returns true if loading
   */
  isLoading(key: string): boolean {
    return this.states.get(key) || false;
  }

  /**
   * Check if any operation is loading
   * @returns true if any operation is loading
   */
  isAnyLoading(): boolean {
    return this.states.size > 0;
  }

  /**
   * Execute an async operation with automatic loading state management
   * @param key - Unique key for this operation
   * @param operation - Async operation to execute
   * @returns Promise with the operation result
   */
  async withLoading<T>(key: string, operation: () => Promise<T>): Promise<T> {
    try {
      this.setLoading(key, true);
      return await operation();
    } finally {
      this.setLoading(key, false);
    }
  }

  /**
   * Clear all loading states
   */
  clearAll(): void {
    this.states.clear();
  }
}