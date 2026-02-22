// src/app/shared/pipes/status.pipe.ts
import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/**
 * Pipe to display translated order status labels.
 *
 * Usage:
 * {{ 'pending' | appStatus }}         -> 'Pending' (or translated equivalent)
 * {{ order.status | appStatus }}      -> Translated status label
 */
@Pipe({
  name: 'appStatus',
  standalone: true,
  pure: false // Needed to react to language changes
})
export class StatusPipe implements PipeTransform {
  private translateService = inject(TranslateService);

  transform(status: string): string {
    if (!status) return '';
    return this.translateService.instant(`orders.status.${status}`);
  }
}
