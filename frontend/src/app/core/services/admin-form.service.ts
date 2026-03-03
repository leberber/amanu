import { Injectable, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ToastMessageService } from './toast-message.service';
import { TranslationService } from '../../services/translation.service';
import { ANIMATION, UI_DELAY } from '../constants/ui.constants';
import { VALIDATION } from '../constants/validation.constants';

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

  handleSuccess(config: FormSuccessConfig): void {
    // Show success message
    this.toast.showSuccess(config.message);


    if (config.redirectUrl) {
      const delay = config.redirectDelay ?? ANIMATION.VERY_SLOW;
      setTimeout(() => {
        this.router.navigate([config.redirectUrl]);
      }, delay);
    }
  }

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

  createTranslationObject(formValues: any, fieldName: string): TranslationObject {
    const translations: TranslationObject = {};
    this.LANGUAGES.forEach(lang => {
      translations[lang] = formValues[`${fieldName}_${lang}`] || '';
    });
    return translations;
  }

  buildFormDataWithTranslations(
    formValues: any, 
    translationFields: string[], 
    additionalData?: any
  ): any {
    const data: any = { ...additionalData };
    
    translationFields.forEach(fieldName => {

      data[fieldName] = formValues[`${fieldName}_en`] || '';
      
      // Create translation object
      data[`${fieldName}_translations`] = this.createTranslationObject(formValues, fieldName);
    });
    
    // Copy non-translation fields
    Object.keys(formValues).forEach(key => {
      
      if (!key.match(/_(?:en|fr|ar)$/)) {
        data[key] = formValues[key];
      }
    });
    
    return data;
  }

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

  showFormValidationErrors(form: any): void {
    const errors = this.getFormValidationErrors(form);

    if (Object.keys(errors).length > 0) {
      this.toast.showError('validation.form_errors');
    }
  }

  // Translation form builders
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

  handleSuccessWithRedirect(
    successMessage: string,
    redirectUrl: string,
    delay: number = UI_DELAY.TOAST_BEFORE_NAVIGATE
  ): void {
    this.toast.showSuccess(successMessage);
    setTimeout(() => {
      this.router.navigate([redirectUrl]);
    }, delay);
  }
}