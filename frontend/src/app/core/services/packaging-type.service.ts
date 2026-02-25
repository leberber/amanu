import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { PACKAGING_TYPES, PackagingType } from '../constants/product.constants';

export interface PackagingTypeConfig {
  key: PackagingType;
  display: string;
  translationKey: string;
}

@Injectable({
  providedIn: 'root'
})
export class PackagingTypeService {
  private translateService = inject(TranslateService);

  // Auto-generate config from constants
  private packagingTypes = new Map<string, PackagingTypeConfig>(
    PACKAGING_TYPES.map(key => [key, {
      key,
      display: key.charAt(0).toUpperCase() + key.slice(1),
      translationKey: `products.product.packaging_types.${key}`
    }])
  );

  /**
   * Get translated packaging type name
   * @param type - Packaging type key
   * @param plural - Whether to use plural form
   * @returns Translated name
   */
  getPackagingTypeTranslated(type: string, plural = false): string {
    const config = this.packagingTypes.get(type?.toLowerCase());

    if (!config) {
      return type || '';
    }

    const translationKey = plural
      ? `${config.translationKey}_plural`
      : config.translationKey;
    const translated = this.translateService.instant(translationKey);

    // If translation not found, fallback to display value
    if (translated === translationKey) {
      return config.display;
    }

    return translated;
  }

  /**
   * Get packaging type label based on count (singular or plural)
   * @param type - Packaging type key
   * @param count - Quantity to determine singular/plural
   * @returns Translated name in correct form
   */
  getPackagingTypeForCount(type: string, count: number): string {
    return this.getPackagingTypeTranslated(type, count !== 1);
  }

  /**
   * Get all available packaging types
   * @returns Array of packaging type configurations
   */
  getAllPackagingTypes(): PackagingTypeConfig[] {
    return Array.from(this.packagingTypes.values());
  }

  /**
   * Get packaging types for dropdown/select options
   * @param translated - Whether to use translated names
   * @returns Array of options
   */
  getPackagingTypeOptions(translated = false): Array<{label: string, value: string}> {
    return this.getAllPackagingTypes().map(type => ({
      label: translated
        ? this.getPackagingTypeTranslated(type.key)
        : type.display,
      value: type.key
    }));
  }

  /**
   * Check if a packaging type exists
   * @param type - Packaging type key
   * @returns boolean
   */
  hasPackagingType(type: string): boolean {
    return this.packagingTypes.has(type?.toLowerCase());
  }
}
