import { Injectable } from '@angular/core';
import { SEARCH } from '../constants/app.constants';

/**
 * Simple service to handle search debouncing
 * Keeps code DRY by centralizing the setTimeout pattern
 */
@Injectable({
  providedIn: 'root'
})
export class SearchDebounceService {
  private timeouts: Map<string, any> = new Map();

  /**
   * Debounce a search function
   * @param key - Unique key for this search (to handle multiple searches)
   * @param callback - Function to call after debounce
   * @param delay - Delay in milliseconds (default from constants)
   */
  debounce(key: string, callback: () => void, delay = SEARCH.DEBOUNCE_TIME): void {
    // Clear existing timeout for this key
    if (this.timeouts.has(key)) {
      clearTimeout(this.timeouts.get(key));
    }

    // Set new timeout
    const timeoutId = setTimeout(() => {
      callback();
      this.timeouts.delete(key);
    }, delay);

    this.timeouts.set(key, timeoutId);
  }

  /**
   * Cancel a debounced search
   * @param key - Key of the search to cancel
   */
  cancel(key: string): void {
    if (this.timeouts.has(key)) {
      clearTimeout(this.timeouts.get(key));
      this.timeouts.delete(key);
    }
  }

  /**
   * Cancel all pending searches
   */
  cancelAll(): void {
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.timeouts.clear();
  }
}