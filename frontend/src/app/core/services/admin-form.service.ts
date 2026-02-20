import { Injectable, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ToastMessageService } from './toast-message.service';
import { TranslationService } from '../../services/translation.service';
import { ANIMATION, VALIDATION } from '../constants/app.constants';

export interface FormSuccessConfig {
  message: string;
  redirectUrl?: string;
  redirectDelay?: number;
}

export interface FormErrorConfig {
  createMessage?: string;
  updateMessage?: string;
  genericMessage?: string;
}

export interface TranslationObject {
  [key: string]: string;
}

export interface TranslationFieldConfig {
  name: string;
  required?: boolean;
  minLength?: number;
}

export interface EntityWithTranslations {
  name?: string;
  description?: string;
  name_translations?: { [key: string]: string };
  description_translations?: { [key: string]: string };
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class AdminFormService {
  private toast = inject(ToastMessageService);
  private translateService = inject(TranslateService);
  private translationService = inject(TranslationService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  private get LANGUAGES(): string[] {
    return this.translationService.availableLanguages.map(lang => lang.code);
  }

  /**
   * Handle form submission success with optional redirect
   * @param config - Success configuration
   */
  handleSuccess(config: FormSuccessConfig): void {
    // Show success message
    this.toast.showSuccess(config.message);

    // Handle redirect if specified
    if (config.redirectUrl) {
      const delay = config.redirectDelay ?? ANIMATION.VERY_SLOW;
      setTimeout(() => {
        this.router.navigate([config.redirectUrl]);
      }, delay);
    }
  }

  /**
   * Handle form submission error
   * @param operation - Operation type ('create' or 'update')
   * @param error - Error object
   * @param config - Error configuration
   */
  handleError(operation: 'create' | 'update', error: any, config?: FormErrorConfig): void {
    console.error(`Error ${operation}ing:`, error);

    // Determine fallback key
    let fallbackKey = 'common.operation_failed';
    if (config) {
      if (operation === 'create' && config.createMessage) {
        fallbackKey = config.createMessage;
      } else if (operation === 'update' && config.updateMessage) {
        fallbackKey = config.updateMessage;
      } else if (config.genericMessage) {
        fallbackKey = config.genericMessage;
      }
    }

    // Show error message using toast service
    this.toast.showApiError(error, fallbackKey);
  }

  /**
   * Create a translation object from form values
   * @param formValues - Form values containing language fields
   * @param fieldName - Base field name (e.g., 'name', 'description')
   * @returns Translation object
   */
  createTranslationObject(formValues: any, fieldName: string): TranslationObject {
    const translations: TranslationObject = {};
    this.LANGUAGES.forEach(lang => {
      translations[lang] = formValues[`${fieldName}_${lang}`] || '';
    });
    return translations;
  }

  /**
   * Build form data with translation objects
   * @param formValues - Raw form values
   * @param translationFields - Array of field names that need translation objects
   * @param additionalData - Additional data to merge
   * @returns Formatted data object
   */
  buildFormDataWithTranslations(
    formValues: any, 
    translationFields: string[], 
    additionalData?: any
  ): any {
    const data: any = { ...additionalData };
    
    // Process translation fields
    translationFields.forEach(fieldName => {
      // Use English as primary field value
      data[fieldName] = formValues[`${fieldName}_en`] || '';
      
      // Create translation object
      data[`${fieldName}_translations`] = this.createTranslationObject(formValues, fieldName);
    });
    
    // Copy non-translation fields
    Object.keys(formValues).forEach(key => {
      // Skip if it's a translation field (ends with _en, _fr, _ar)
      if (!key.match(/_(?:en|fr|ar)$/)) {
        data[key] = formValues[key];
      }
    });
    
    return data;
  }

  /**
   * Reset form with default values
   * @param form - Form to reset
   * @param defaults - Default values
   * @param translationFields - Fields that need translation defaults
   */
  resetFormWithDefaults(form: any, defaults: any = {}, translationFields: string[] = []): void {
    const resetValues: any = { ...defaults };

    // Set empty strings for translation fields
    translationFields.forEach(fieldName => {
      this.LANGUAGES.forEach(lang => {
        resetValues[`${fieldName}_${lang}`] = '';
      });
    });

    form.reset(resetValues);
  }

  /**
   * Extract validation errors from form
   * @param form - Form with errors
   * @returns Object with field names and error messages
   */
  getFormValidationErrors(form: any): Record<string, string[]> {
    const errors: Record<string, string[]> = {};
    
    Object.keys(form.controls).forEach(key => {
      const control = form.get(key);
      if (control && control.errors && control.touched) {
        const fieldErrors: string[] = [];
        
        Object.keys(control.errors).forEach(errorKey => {
          let message = '';
          
          switch (errorKey) {
            case 'required':
              message = this.translateService.instant('validation.field_required');
              break;
            case 'minlength':
              message = this.translateService.instant('validation.min_length', 
                { length: control.errors![errorKey].requiredLength });
              break;
            case 'maxlength':
              message = this.translateService.instant('validation.max_length', 
                { length: control.errors![errorKey].requiredLength });
              break;
            case 'email':
              message = this.translateService.instant('validation.invalid_email');
              break;
            case 'pattern':
              message = this.translateService.instant('validation.invalid_format');
              break;
            case 'min':
              message = this.translateService.instant('validation.min_value', 
                { value: control.errors![errorKey].min });
              break;
            case 'max':
              message = this.translateService.instant('validation.max_value', 
                { value: control.errors![errorKey].max });
              break;
            default:
              message = this.translateService.instant('validation.field_invalid');
          }
          
          fieldErrors.push(message);
        });
        
        if (fieldErrors.length > 0) {
          errors[key] = fieldErrors;
        }
      }
    });
    
    return errors;
  }

  /**
   * Show form validation errors
   * @param form - Form with validation errors
   */
  showFormValidationErrors(form: any): void {
    const errors = this.getFormValidationErrors(form);

    if (Object.keys(errors).length > 0) {
      this.toast.showError('validation.form_errors');
    }
  }

  // ===== TRANSLATION FORM BUILDERS =====

  /**
   * Build a form group with multi-language translation fields.
   * Creates fields like name_en, name_fr, name_ar for each translation field.
   *
   * @param translationFields - Array of field configs for translation fields
   * @param additionalFields - Additional non-translation fields to add
   * @returns FormGroup with all fields
   *
   * @example
   * this.form = this.adminFormService.buildTranslationFormGroup(
   *   [
   *     { name: 'name', required: true, minLength: 2 },
   *     { name: 'description', required: false }
   *   ],
   *   { image_url: [''], is_active: [true] }
   * );
   */
  buildTranslationFormGroup(
    translationFields: TranslationFieldConfig[],
    additionalFields: { [key: string]: any } = {}
  ): FormGroup {
    const formConfig: { [key: string]: any } = {};

    // Build translation fields for each language
    translationFields.forEach(field => {
      this.LANGUAGES.forEach(lang => {
        const validators = [];
        if (field.required) {
          validators.push(Validators.required);
        }
        if (field.minLength) {
          validators.push(Validators.minLength(field.minLength));
        }
        formConfig[`${field.name}_${lang}`] = ['', validators];
      });
    });

    // Add additional fields
    Object.keys(additionalFields).forEach(key => {
      formConfig[key] = additionalFields[key];
    });

    return this.fb.group(formConfig);
  }

  /**
   * Populate form with entity data including translations.
   * Handles both entities with translation objects and legacy entities.
   *
   * @param form - FormGroup to populate
   * @param entity - Entity with possible translations
   * @param translationFields - Fields that have translations (e.g., ['name', 'description'])
   * @param additionalMappings - Additional field mappings
   *
   * @example
   * this.adminFormService.populateFormWithTranslations(
   *   this.categoryForm,
   *   category,
   *   ['name', 'description'],
   *   { image_url: category.image_url || '', is_active: category.is_active }
   * );
   */
  populateFormWithTranslations(
    form: FormGroup,
    entity: EntityWithTranslations,
    translationFields: string[],
    additionalMappings: { [key: string]: any } = {}
  ): void {
    const patchValues: { [key: string]: any } = {};

    // Populate translation fields
    translationFields.forEach(fieldName => {
      const translationsKey = `${fieldName}_translations`;
      const translations = entity[translationsKey] as { [key: string]: string } | undefined;
      const fallbackValue = entity[fieldName] || '';

      this.LANGUAGES.forEach(lang => {
        patchValues[`${fieldName}_${lang}`] = translations?.[lang] || fallbackValue;
      });
    });

    // Add additional mappings
    Object.keys(additionalMappings).forEach(key => {
      patchValues[key] = additionalMappings[key];
    });

    form.patchValue(patchValues);
  }

  /**
   * Get reset values for a translation form.
   *
   * @param translationFields - Fields that have translations
   * @param additionalDefaults - Additional default values
   * @returns Object with reset values
   */
  getTranslationFormResetValues(
    translationFields: string[],
    additionalDefaults: { [key: string]: any } = {}
  ): { [key: string]: any } {
    const resetValues: { [key: string]: any } = {};

    translationFields.forEach(fieldName => {
      this.LANGUAGES.forEach(lang => {
        resetValues[`${fieldName}_${lang}`] = '';
      });
    });

    return { ...resetValues, ...additionalDefaults };
  }

  /**
   * Standard navigation after successful form submission.
   * Shows success message and navigates to specified URL.
   *
   * @param successMessage - Translation key for success message
   * @param redirectUrl - URL to navigate to
   * @param delay - Delay before navigation (default: 1500ms)
   */
  handleSuccessWithRedirect(
    successMessage: string,
    redirectUrl: string,
    delay: number = 1500
  ): void {
    this.toast.showSuccess(successMessage);
    setTimeout(() => {
      this.router.navigate([redirectUrl]);
    }, delay);
  }
}