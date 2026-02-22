import { Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { SearchService } from '../../../services/search.service';

/**
 * SearchInputComponent - Reusable search input with responsive design
 *
 * Features:
 * - Integrates with SearchService for centralized state
 * - Responsive: adapts to desktop/mobile layouts
 * - Debounced input with immediate search on Enter
 * - Clear button when query is present
 * - Loading indicator during search
 */
@Component({
  selector: 'app-search-input',
  standalone: true,
  imports: [
    FormsModule,
    TranslateModule,
    InputTextModule,
    ButtonModule
  ],
  template: `
    <div class="search-input" [class.search-input--compact]="compact()">
      <i class="pi pi-search search-input__icon"></i>
      <input
        pInputText
        type="text"
        [ngModel]="searchService.query()"
        (ngModelChange)="onInputChange($event)"
        (keyup.enter)="onSearch()"
        [placeholder]="placeholder() | translate"
        class="search-input__field">
      @if (searchService.isSearching()) {
        <i class="pi pi-spin pi-spinner search-input__loading"></i>
      } @else if (searchService.query()) {
        <button
          pButton
          type="button"
          icon="pi pi-times"
          class="p-button-text p-button-rounded p-button-sm search-input__clear"
          (click)="onClear()">
        </button>
      } @else {
        <button
          pButton
          type="button"
          icon="pi pi-search"
          class="p-button-text p-button-rounded p-button-sm search-input__submit"
          (click)="onSearch()">
        </button>
      }
    </div>
  `,
  styles: [`
    .search-input {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;

      &__icon {
        position: absolute;
        inset-inline-start: 1rem;
        color: var(--text-color-secondary);
        pointer-events: none;
        z-index: 1;
      }

      &__field {
        width: 100%;
        padding: 0.875rem 3rem;
        border-radius: 12px;
        background: var(--surface-card);
        border: 1px solid var(--surface-border);
        font-size: var(--font-size-base);
        transition: all 0.2s ease;

        &:hover {
          border-color: var(--surface-400);
        }

        &:focus {
          border-color: var(--primary-color);
          outline: none;
          box-shadow: 0 0 0 3px var(--primary-50);
        }

        &::placeholder {
          color: var(--text-color-secondary);
        }
      }

      &__loading,
      &__clear,
      &__submit {
        position: absolute;
        inset-inline-end: 0.5rem;
      }

      &__loading {
        color: var(--primary-color);
      }

      &__clear,
      &__submit {
        width: 2rem !important;
        height: 2rem !important;

        &:hover {
          background: var(--primary-50) !important;
          color: var(--primary-color) !important;
        }
      }

      // Compact mode for mobile
      &--compact {
        .search-input__field {
          padding: 0.625rem 2.5rem;
          font-size: 16px; // Prevents iOS zoom
        }

        .search-input__icon {
          inset-inline-start: 0.75rem;
          font-size: 0.875rem;
        }

        .search-input__clear,
        .search-input__submit {
          inset-inline-end: 0.25rem;
          width: 1.75rem !important;
          height: 1.75rem !important;
        }
      }
    }

    // Mobile adjustments
    @media (max-width: 768px) {
      .search-input__field {
        font-size: 16px; // Prevents iOS zoom
      }

      .search-input__field:focus {
        box-shadow: 0 0 0 2px var(--primary-50);
      }
    }
  `]
})
export class SearchInputComponent {
  protected searchService = inject(SearchService);

  // Signal-based inputs/outputs
  placeholder = input('products.search.placeholder');
  compact = input(false);
  searchTriggered = output<string>();

  onInputChange(value: string): void {
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
