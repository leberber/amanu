import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { UNIT_CONFIGS, UnitConfig } from '../constants/product.constants';

@Injectable({
  providedIn: 'root'
})
export class UnitsService {
  private translateService = inject(TranslateService);

  // Build Map from constants
  private units = new Map<string, UnitConfig & { translationKey: string }>(
    UNIT_CONFIGS.map(config => [config.key, {
      ...config,
      translationKey: `units.${config.key}`
    }])
  );

  /**
   * Get display name for a unit (returns translated version)
   */
  getUnitDisplay(unit: string, useShort = true): string {
    return this.getUnitTranslated(unit, useShort);
  }

  /**
   * Get translated unit name
   */
  getUnitTranslated(unit: string, useShort = true): string {
    const unitConfig = this.units.get(unit?.toLowerCase());

    if (!unitConfig) {
      return unit || '';
    }

    const translationKey = useShort
      ? `${unitConfig.translationKey}_short`
      : unitConfig.translationKey;

    const translated = this.translateService.instant(translationKey);

    // If translation not found, fallback to display value
    if (translated === translationKey) {
      return useShort ? unitConfig.displayShort : unitConfig.display;
    }

    return translated;
  }

  /**
   * Get translation key for a unit
   */
  getUnitTranslationKey(unit: string): string {
    const unitConfig = this.units.get(unit?.toLowerCase());
    return unitConfig?.translationKey || `units.${unit}`;
  }

  /**
   * Get all available units
   */
  getAllUnits(): UnitConfig[] {
    return UNIT_CONFIGS;
  }

  /**
   * Get units for dropdown/select options
   */
  getUnitOptions(translated = false): Array<{label: string, value: string}> {
    return UNIT_CONFIGS.map(unit => ({
      label: translated
        ? this.getUnitTranslated(unit.key, false)
        : unit.display,
      value: unit.key
    }));
  }

  /**
   * Check if a unit exists
   */
  hasUnit(unit: string): boolean {
    return this.units.has(unit?.toLowerCase());
  }

  /**
   * Convert between units (if conversion factor exists)
   */
  convertUnit(value: number, fromUnit: string, toUnit: string): number | null {
    const from = this.units.get(fromUnit?.toLowerCase());
    const to = this.units.get(toUnit?.toLowerCase());

    if (!from || !to) {
      return null;
    }

    if (fromUnit === toUnit) {
      return value;
    }

    // Convert to base unit (kg) then to target
    if (from.factor && to.factor) {
      const inKg = value * from.factor;
      return inKg / to.factor;
    }

    return null;
  }

  /**
   * Format quantity with unit
   */
  formatQuantityWithUnit(quantity: number, unit: string, useShort = true): string {
    const unitDisplay = this.getUnitDisplay(unit, useShort);
    return `${quantity} ${unitDisplay}`;
  }
}
