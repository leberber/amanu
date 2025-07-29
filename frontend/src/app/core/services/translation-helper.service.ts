import { Injectable, inject } from '@angular/core';
import { TranslationService } from '../../services/translation.service';

@Injectable({
  providedIn: 'root'
})
export class TranslationHelperService {
  private translationService = inject(TranslationService);

  /**
   * Get translated field from an object containing translations
   * @param obj - Object containing translations (e.g., product, category)
   * @param fieldName - Base field name (e.g., 'name', 'description')
   * @param fallbackToDefault - Whether to fallback to default field if translation not found
   * @returns Translated value or fallback
   */
  getTranslatedField(obj: any, fieldName: string, fallbackToDefault = true): string {
    if (!obj) return '';
    
    const currentLang = this.translationService.getCurrentLanguage();
    const translationFieldName = `${fieldName}_translations`;
    
    // Check if translations exist
    if (obj[translationFieldName] && obj[translationFieldName][currentLang]) {
      return obj[translationFieldName][currentLang];
    }
    
    // Fallback to English if current language not found
    if (obj[translationFieldName] && obj[translationFieldName]['en']) {
      return obj[translationFieldName]['en'];
    }
    
    // Fallback to French if English not found
    if (obj[translationFieldName] && obj[translationFieldName]['fr']) {
      return obj[translationFieldName]['fr'];
    }
    
    // Fallback to base field if requested
    if (fallbackToDefault && obj[fieldName]) {
      return obj[fieldName];
    }
    
    return '';
  }

  /**
   * Get product name with proper translation fallback
   * @param product - Product object
   * @returns Translated product name
   */
  getProductName(product: any): string {
    return this.getTranslatedField(product, 'name', true);
  }

  /**
   * Get product description with proper translation fallback
   * @param product - Product object
   * @returns Translated product description
   */
  getProductDescription(product: any): string {
    return this.getTranslatedField(product, 'description', true);
  }

  /**
   * Get category name with proper translation fallback
   * @param category - Category object
   * @returns Translated category name
   */
  getCategoryName(category: any): string {
    return this.getTranslatedField(category, 'name', true);
  }

  /**
   * Get all available translations for a field
   * @param obj - Object containing translations
   * @param fieldName - Base field name
   * @returns Object with all translations
   */
  getAllTranslations(obj: any, fieldName: string): Record<string, string> {
    if (!obj) return {};
    
    const translationFieldName = `${fieldName}_translations`;
    return obj[translationFieldName] || {};
  }

  /**
   * Check if translation exists for current language
   * @param obj - Object containing translations
   * @param fieldName - Base field name
   * @returns boolean
   */
  hasTranslation(obj: any, fieldName: string): boolean {
    if (!obj) return false;
    
    const currentLang = this.translationService.getCurrentLanguage();
    const translationFieldName = `${fieldName}_translations`;
    
    return !!(obj[translationFieldName] && obj[translationFieldName][currentLang]);
  }

  /**
   * Get translated value with parameter replacement
   * @param key - Translation key
   * @param params - Parameters to replace in translation
   * @returns Translated string
   */
  translate(key: string, params?: any): string {
    return this.translationService.getTranslation(key, params);
  }

  /**
   * Get current language code
   * @returns Current language code
   */
  getCurrentLanguage(): string {
    return this.translationService.getCurrentLanguage();
  }

  /**
   * Check if current language is RTL
   * @returns boolean
   */
  isRTL(): boolean {
    return this.translationService.isRTL();
  }
}