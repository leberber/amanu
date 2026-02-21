import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { SEARCH } from '../core/constants/app.constants';

/**
 * SearchService - Centralized search state management
 *
 * Provides:
 * - Reactive search query state (signals)
 * - Debounced search with configurable delay
 * - Minimum character validation
 * - Search events for consumers to subscribe
 */
@Injectable({
  providedIn: 'root'
})
export class SearchService {
  // Core search state
  private readonly _query = signal('');
  private readonly _appliedQuery = signal('');
  private readonly _isSearching = signal(false);

  // Public readonly signals
  readonly query = this._query.asReadonly();
  readonly appliedQuery = this._appliedQuery.asReadonly();
  readonly isSearching = this._isSearching.asReadonly();

  // Computed: has active search
  readonly hasActiveSearch = computed(() => this._appliedQuery().trim().length > 0);

  // Configuration
  readonly minSearchLength = SEARCH.MIN_SEARCH_LENGTH;
  readonly debounceTime = SEARCH.DEBOUNCE_TIME;

  // Search subject for debouncing
  private readonly searchSubject = new Subject<string>();

  // Event emitter for search triggered
  private readonly _searchTriggered = new Subject<string>();
  readonly searchTriggered$ = this._searchTriggered.asObservable();

  constructor() {
    this.setupDebounce();
  }

  private setupDebounce(): void {
    this.searchSubject.pipe(
      debounceTime(this.debounceTime),
      distinctUntilChanged()
    ).subscribe(query => {
      const trimmed = query.trim();
      // Trigger search if query meets minimum length or is empty (to clear)
      if (trimmed.length >= this.minSearchLength || trimmed.length === 0) {
        this._appliedQuery.set(query);
        this._searchTriggered.next(query);
        this._isSearching.set(false);
      }
    });
  }

  /**
   * Update query with debounced search trigger
   */
  setQuery(query: string): void {
    this._query.set(query);
    this._isSearching.set(true);
    this.searchSubject.next(query);
  }

  /**
   * Immediately trigger search (e.g., on Enter key)
   */
  search(): void {
    const query = this._query();
    const trimmed = query.trim();

    if (trimmed.length >= this.minSearchLength || trimmed.length === 0) {
      this._appliedQuery.set(query);
      this._searchTriggered.next(query);
    }
    this._isSearching.set(false);
  }

  /**
   * Clear search
   */
  clear(): void {
    this._query.set('');
    this._appliedQuery.set('');
    this._isSearching.set(false);
    this._searchTriggered.next('');
  }

  /**
   * Reset service state (useful when navigating away)
   */
  reset(): void {
    this._query.set('');
    this._appliedQuery.set('');
    this._isSearching.set(false);
  }
}
