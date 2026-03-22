import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type SkeletonColumnType =
  | 'image'
  | 'text'
  | 'text-multi'
  | 'text-sm'
  | 'pill'
  | 'pill-sm'
  | 'toggle'
  | 'actions'
  | 'price'
  | 'stock';

export interface LoadingColumn {
  type: SkeletonColumnType;
  visible?: boolean;
  width?: string;
}

/**
 * Displays skeleton loading rows for tables during infinite scroll.
 *
 * Usage:
 * ```html
 * <app-table-loading-rows
 *   [columns]="[
 *     { type: 'image', visible: true },
 *     { type: 'text-multi', visible: true },
 *     { type: 'pill', visible: true },
 *     { type: 'actions', visible: true }
 *   ]"
 *   [rowCount]="3"
 * />
 * ```
 */
@Component({
  selector: 'app-table-loading-rows',
  standalone: true,
  imports: [CommonModule],
  template: `
    @for (row of rows; track row) {
      <tr class="skeleton-row">
        @for (col of visibleColumns; track $index) {
          <td [class.text-center]="col.type !== 'text' && col.type !== 'text-multi'">
            @switch (col.type) {
              @case ('image') {
                <div class="skeleton skeleton-image"></div>
              }
              @case ('text') {
                <div class="skeleton skeleton-text"></div>
              }
              @case ('text-multi') {
                <div>
                  <div class="skeleton skeleton-text" style="width: 80%"></div>
                  <div class="skeleton skeleton-text short"></div>
                </div>
              }
              @case ('text-sm') {
                <div class="skeleton skeleton-text-sm"></div>
              }
              @case ('pill') {
                <div class="skeleton skeleton-pill"></div>
              }
              @case ('pill-sm') {
                <div class="skeleton skeleton-pill-sm"></div>
              }
              @case ('price') {
                <div class="skeleton skeleton-text-sm"></div>
              }
              @case ('stock') {
                <div class="skeleton skeleton-text"></div>
              }
              @case ('toggle') {
                <div class="skeleton skeleton-toggle"></div>
              }
              @case ('actions') {
                <div class="skeleton-actions">
                  @for (btn of actionButtons; track btn) {
                    <div class="skeleton skeleton-btn"></div>
                  }
                </div>
              }
            }
          </td>
        }
      </tr>
    }
  `,
  styles: [`
    .skeleton-row td {
      padding: 1rem 0.75rem;
    }

    .skeleton {
      background: linear-gradient(90deg, var(--surface-200) 25%, var(--surface-100) 50%, var(--surface-200) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
    }

    .skeleton-image {
      width: 40px;
      height: 40px;
      border-radius: 8px;
    }

    .skeleton-text {
      height: 14px;
      width: 100%;

      &.short {
        width: 60%;
        margin-top: 0.5rem;
      }
    }

    .skeleton-text-sm {
      height: 14px;
      width: 50px;
      margin: 0 auto;
    }

    .skeleton-pill {
      height: 24px;
      width: 80px;
      border-radius: 12px;
      margin: 0 auto;
    }

    .skeleton-pill-sm {
      height: 22px;
      width: 60px;
      border-radius: 11px;
      margin: 0 auto;
    }

    .skeleton-toggle {
      height: 24px;
      width: 70px;
      border-radius: 12px;
      margin: 0 auto;
    }

    .skeleton-btn {
      width: 28px;
      height: 28px;
      border-radius: 6px;
    }

    .skeleton-actions {
      display: flex;
      justify-content: center;
      gap: 0.5rem;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `]
})
export class TableLoadingRowsComponent {
  @Input() columns: LoadingColumn[] = [];
  @Input() rowCount = 3;
  @Input() actionCount = 3;

  get rows(): number[] {
    return Array.from({ length: this.rowCount }, (_, i) => i);
  }

  get visibleColumns(): LoadingColumn[] {
    return this.columns.filter(col => col.visible !== false);
  }

  get actionButtons(): number[] {
    return Array.from({ length: this.actionCount }, (_, i) => i);
  }
}
