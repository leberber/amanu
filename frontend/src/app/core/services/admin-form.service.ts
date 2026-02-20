import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ToastMessageService } from './toast-message.service';
import { ANIMATION } from '../constants/app.constants';

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
  en: string;
  fr: string;
  ar: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminFormService {
  private toast = inject(ToastMessageService);
  private translateService = inject(TranslateService);
  private router = inject(Router);

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
    return {
      en: formValues[`${fieldName}_en`] || '',
      fr: formValues[`${fieldName}_fr`] || '',
      ar: formValues[`${fieldName}_ar`] || ''
    };
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
      resetValues[`${fieldName}_en`] = '';
      resetValues[`${fieldName}_fr`] = '';
      resetValues[`${fieldName}_ar`] = '';
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
}