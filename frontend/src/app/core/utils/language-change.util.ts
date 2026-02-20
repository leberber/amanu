/**
 * Utility for handling language change subscriptions.
 * Provides a standardized way to subscribe to language changes with proper cleanup.
 */

import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';

/**
 * Subscribe to language changes with automatic cleanup.
 * Uses Angular's DestroyRef for automatic subscription cleanup.
 *
 * Usage in component:
 * ```typescript
 * export class MyComponent {
 *   constructor() {
 *     onLanguageChange(() => {
 *       this.filterItems();
 *     });
 *   }
 * }
 * ```
 */
export function onLanguageChange(callback: () => void): void {
  const translateService = inject(TranslateService);
  const destroyRef = inject(DestroyRef);

  translateService.onLangChange
    .pipe(takeUntilDestroyed(destroyRef))
    .subscribe(() => callback());
}

/**
 * Alternative: Creates a language change subscription that needs manual cleanup.
 * Use when you need more control over the subscription.
 *
 * Usage:
 * ```typescript
 * private langChangeSub?: Subscription;
 *
 * ngOnInit() {
 *   this.langChangeSub = subscribeToLanguageChange(this.translateService, () => {
 *     this.filterItems();
 *   });
 * }
 *
 * ngOnDestroy() {
 *   this.langChangeSub?.unsubscribe();
 * }
 * ```
 */
export function subscribeToLanguageChange(
  translateService: TranslateService,
  callback: () => void
) {
  return translateService.onLangChange.subscribe(() => callback());
}
