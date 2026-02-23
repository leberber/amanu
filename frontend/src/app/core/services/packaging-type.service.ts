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

  // Configurable packaging types registry
  private packagingTypes: Map<string, PackagingTypeConfig> = new Map([
    ['BOX', {
      key: 'BOX',
      display: 'Box',
      translationKey: 'products.product.packaging_types.box'
    }],
    ['CARTON', {
      key: 'CARTON',
      display: 'Carton',
      translationKey: 'products.product.packaging_types.carton'
    }],
    ['CRATE', {
      key: 'CRATE',
      display: 'Crate',
      translationKey: 'products.product.packaging_types.crate'
    }],
    ['PACK', {
      key: 'PACK',
      display: 'Pack',
      translationKey: 'products.product.packaging_types.pack'
    }],
    ['BAG', {
      key: 'BAG',
      display: 'Bag',
      translationKey: 'products.product.packaging_types.bag'
    }],
    ['BUNDLE', {
      key: 'BUNDLE',
      display: 'Bundle',
      translationKey: 'products.product.packaging_types.bundle'
    }]
  ]);

  /**
   * Get translated packaging type name
   * @param type - Packaging type key
   * @returns Translated name
   */
  getPackagingTypeTranslated(type: string): string {
    const config = this.packagingTypes.get(type?.toUpperCase());

    if (!config) {
      return type || '';
    }

    const translated = this.translateService.instant(config.translationKey);

    // If translation not found, fallback to display value
    if (translated === config.translationKey) {
      return config.display;
    }

    return translated;
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
    return this.packagingTypes.has(type?.toUpperCase());
  }
}
