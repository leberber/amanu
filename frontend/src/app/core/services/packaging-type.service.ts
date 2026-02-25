import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export interface PackagingTypeConfig {
  key: string;
  display: string;
  translationKey: string;
}

@Injectable({
  providedIn: 'root'
})
export class PackagingTypeService {
  private translateService = inject(TranslateService);

  // Configurable packaging types registry (lowercase to match backend)
  private packagingTypes: Map<string, PackagingTypeConfig> = new Map([
    ['box', {
      key: 'box',
      display: 'Box',
      translationKey: 'products.product.packaging_types.box'
    }],
    ['carton', {
      key: 'carton',
      display: 'Carton',
      translationKey: 'products.product.packaging_types.carton'
    }],
    ['crate', {
      key: 'crate',
      display: 'Crate',
      translationKey: 'products.product.packaging_types.crate'
    }],
    ['pack', {
      key: 'pack',
      display: 'Pack',
      translationKey: 'products.product.packaging_types.pack'
    }],
    ['bag', {
      key: 'bag',
      display: 'Bag',
      translationKey: 'products.product.packaging_types.bag'
    }],
    ['bundle', {
      key: 'bundle',
      display: 'Bundle',
      translationKey: 'products.product.packaging_types.bundle'
    }]
  ]);

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
