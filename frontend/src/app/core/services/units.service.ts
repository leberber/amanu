import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export interface UnitConfig {
  key: string;
  display: string;
  displayShort: string;
  translationKey: string;
  factor?: number; // For conversion if needed
}

@Injectable({
  providedIn: 'root'
})
export class UnitsService {
  private translateService = inject(TranslateService);

  // Configurable units registry
  private units: Map<string, UnitConfig> = new Map([
    ['kg', {
      key: 'kg',
      display: 'Kilogram',
      displayShort: 'Kg',
      translationKey: 'units.kg'
    }],
    ['gram', {
      key: 'gram',
      display: 'Gram',
      displayShort: 'g',
      translationKey: 'units.gram'
    }],
    ['piece', {
      key: 'piece',
      display: 'Piece',
      displayShort: 'Piece',
      translationKey: 'units.piece'
    }],
    ['bunch', {
      key: 'bunch',
      display: 'Bunch',
      displayShort: 'Bunch',
      translationKey: 'units.bunch'
    }],
    ['dozen', {
      key: 'dozen',
      display: 'Dozen',
      displayShort: 'Dozen',
      translationKey: 'units.dozen'
    }],
    ['pound', {
      key: 'pound',
      display: 'Pound',
      displayShort: 'lb',
      translationKey: 'units.pound',
      factor: 0.453592 // to kg
    }],
    ['liter', {
      key: 'liter',
      display: 'Liter',
      displayShort: 'L',
      translationKey: 'units.liter'
    }],
    ['ml', {
      key: 'ml',
      display: 'Milliliter',
      displayShort: 'ml',
      translationKey: 'units.ml'
    }],
    ['box', {
      key: 'box',
      display: 'Box',
      displayShort: 'Box',
      translationKey: 'units.box'
    }],
    ['pack', {
      key: 'pack',
      display: 'Pack',
      displayShort: 'Pack',
      translationKey: 'units.pack'
    }]
  ]);

  /**
   * Get display name for a unit
   * @param unit - Unit key
   * @param useShort - Whether to use short form
   * @returns Display name
   */
  getUnitDisplay(unit: string, useShort = true): string {
    const unitConfig = this.units.get(unit?.toLowerCase());
    
    if (!unitConfig) {
      // Fallback to the unit key itself
      return unit || '';
    }

    return useShort ? unitConfig.displayShort : unitConfig.display;
  }

  /**
   * Get translated unit name
   * @param unit - Unit key
   * @param useShort - Whether to use short form
   * @returns Translated unit name
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
    
    // If translation not found, fallback to display
    return translated === translationKey 
      ? this.getUnitDisplay(unit, useShort)
      : translated;
  }

  /**
   * Get translation key for a unit
   * @param unit - Unit key
   * @returns Translation key
   */
  getUnitTranslationKey(unit: string): string {
    const unitConfig = this.units.get(unit?.toLowerCase());
    return unitConfig?.translationKey || `units.${unit}`;
  }

  /**
   * Get all available units
   * @returns Array of unit configurations
   */
  getAllUnits(): UnitConfig[] {
    return Array.from(this.units.values());
  }

  /**
   * Get units for dropdown/select options
   * @param translated - Whether to use translated names
   * @returns Array of options
   */
  getUnitOptions(translated = false): Array<{label: string, value: string}> {
    return this.getAllUnits().map(unit => ({
      label: translated 
        ? this.getUnitTranslated(unit.key, false)
        : unit.display,
      value: unit.key
    }));
  }

  /**
   * Add a new unit to the registry
   * @param unit - Unit configuration
   */
  addUnit(unit: UnitConfig): void {
    this.units.set(unit.key.toLowerCase(), unit);
  }

  /**
   * Check if a unit exists
   * @param unit - Unit key
   * @returns boolean
   */
  hasUnit(unit: string): boolean {
    return this.units.has(unit?.toLowerCase());
  }

  /**
   * Convert between units (if conversion factor exists)
   * @param value - Value to convert
   * @param fromUnit - Source unit
   * @param toUnit - Target unit
   * @returns Converted value or null if conversion not possible
   */
  convertUnit(value: number, fromUnit: string, toUnit: string): number | null {
    const from = this.units.get(fromUnit?.toLowerCase());
    const to = this.units.get(toUnit?.toLowerCase());

    if (!from || !to) {
      return null;
    }

    // Simple conversion logic - can be extended
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
   * @param quantity - Quantity value
   * @param unit - Unit key
   * @param useShort - Whether to use short form
   * @returns Formatted string
   */
  formatQuantityWithUnit(quantity: number, unit: string, useShort = true): string {
    const unitDisplay = this.getUnitDisplay(unit, useShort);
    return `${quantity} ${unitDisplay}`;
  }
}