import { Pipe, PipeTransform, inject } from '@angular/core';
import { UnitsService } from '../../core/services/units.service';

/**
 * Pipe to display unit labels using UnitsService.
 *
 * Usage:
 * {{ 'kg' | appUnit }}           -> 'Kg' (short form, default)
 * {{ 'kg' | appUnit:false }}     -> 'Kilogram' (full form)
 */
@Pipe({
  name: 'appUnit',
  standalone: true
})
export class UnitPipe implements PipeTransform {
  private unitsService = inject(UnitsService);

  transform(unit: string, useShort: boolean = true): string {
    if (!unit) return '';
    return this.unitsService.getUnitDisplay(unit, useShort);
  }
}
