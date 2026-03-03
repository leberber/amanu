/**
 * Utility for detecting edit mode from route parameters.
 * Provides a standardized way to check if a form is in add or edit mode.
 */

import { DestroyRef, WritableSignal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/**
 * Detect edit mode from route data and params.
 * Sets isEditMode and editId signals, then calls onEditMode callback if in edit mode.
 *
 * Usage in component:
 * ```typescript
 * export class AdminAddCategoryComponent {
 *   private route = inject(ActivatedRoute);
 *   private destroyRef = inject(DestroyRef);
 *
 *   readonly isEditMode = signal(false);
 *   private readonly editCategoryId = signal<number | null>(null);
 *
 *   ngOnInit() {
 *     detectEditMode(
 *       this.route,
 *       this.destroyRef,
 *       this.isEditMode,
 *       this.editCategoryId,
 *       () => this.loadCategoryForEdit()
 *     );
 *   }
 * }
 * ```
 */
export function detectEditMode(
  route: ActivatedRoute,
  destroyRef: DestroyRef,
  isEditMode: WritableSignal<boolean>,
  editId: WritableSignal<number | null>,
  onEditMode: () => void
): void {
  // Check route data for edit mode
  const routeData = route.snapshot.data;
  if (routeData['mode'] === 'edit') {
    isEditMode.set(true);
  }

  // Subscribe to param changes
  route.paramMap
    .pipe(takeUntilDestroyed(destroyRef))
    .subscribe(params => {
      const id = params.get('id');
      if (id) {
        editId.set(parseInt(id, 10));
        isEditMode.set(true);
        onEditMode();
      }
    });
}
