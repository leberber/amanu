import { Component, inject, input, output, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { SearchService } from '../../../services/search.service';

/**
 * SearchInputComponent - Reusable search input with responsive design
 *
 * Features:
 * - Integrates with SearchService for centralized state
 * - Supports variants: 'default' | 'pill'
 * - Debounced input with immediate search on Enter
 * - Clear button when query is present
 * - Loading indicator during search
 *
 * Uses global styles from _inputs.scss:
 * - .search-input (base)
 * - .search-input--pill (rounded variant)
 */
@Component({
  selector: 'app-search-input',
  standalone: true,
  imports: [FormsModule, TranslateModule],
  template: `
    <div [class]="containerClass()">
      <i class="pi pi-search search-input__icon"></i>
      <input
        type="text"
        [value]="searchService.query()"
        (input)="onInputChange($event)"
        (keyup.enter)="onSearch()"
        [placeholder]="placeholder() | translate"
        class="search-input__field">
      @if (searchService.isSearching()) {
        <i class="pi pi-spin pi-spinner search-input__loading"></i>
      } @else if (searchService.query()) {
        <button
          type="button"
          class="search-input__clear"
          (click)="onClear()">
          <i class="pi pi-times"></i>
        </button>
      }
    </div>
  `
})
export class SearchInputComponent {
  protected searchService = inject(SearchService);

  placeholder = input('products.search.placeholder');
  variant = input<'default' | 'pill'>('default');
  searchTriggered = output<string>();

  containerClass = computed(() => {
    const base = 'search-input';
    return this.variant() === 'pill' ? `${base} ${base}--pill` : base;
  });

  onInputChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchService.setQuery(value);
  }

  onSearch(): void {
    this.searchService.search();
    this.searchTriggered.emit(this.searchService.query());
  }

  onClear(): void {
    this.searchService.clear();
    this.searchTriggered.emit('');
  }
}
