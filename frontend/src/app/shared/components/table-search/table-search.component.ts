import { Component, input, output, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

/**
 * TableSearchComponent - Reusable search input for admin tables
 *
 * Features:
 * - Two-way binding with query model
 * - Clear button when query is present
 * - Emits search event on input
 * - Emits clear event on clear button click
 *
 * Uses global styles from _table.scss:
 * - .table-search (container)
 * - .search-icon (icon wrapper)
 * - .clear-search (clear button)
 */
@Component({
  selector: 'app-table-search',
  standalone: true,
  imports: [FormsModule, TranslateModule],
  template: `
    <div class="table-search">
      <div class="search-icon">
        <i class="pi pi-search"></i>
      </div>
      <input
        type="text"
        [(ngModel)]="query"
        (input)="onInput()"
        [placeholder]="placeholder() | translate">
      @if (query()) {
        <button class="clear-search" (click)="onClear()">
          <i class="pi pi-times"></i>
        </button>
      }
    </div>
  `
})
export class TableSearchComponent {
  query = model('');
  placeholder = input('common.search_simple');
  search = output<void>();
  clear = output<void>();

  onInput(): void {
    this.search.emit();
  }

  onClear(): void {
    this.query.set('');
    this.clear.emit();
  }
}
