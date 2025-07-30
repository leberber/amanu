import { Injectable, inject } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { VALIDATION } from '../constants/app.constants';

/**
 * Service to centralize form validation error messages
 * Provides consistent validation feedback across the application
 */
@Injectable({
  providedIn: 'root'
})
export class ValidationMessagesService {
  private translateService = inject(TranslateService);

  /**
   * Get validation error message for a form control
   * @param control - Form control to check
   * @param fieldName - Field name for display
   * @returns Error message or empty string
   */
  getErrorMessage(control: AbstractControl | null, fieldName: string): string {
    if (!control || !control.errors || !control.touched) {
      return '';
    }

    const errors = control.errors;
    const fieldLabel = this.translateService.instant(fieldName);

    // Check each validation error type
    if (errors['required']) {
      return this.translateService.instant('validation.required', { field: fieldLabel });
    }

    if (errors['email']) {
      return this.translateService.instant('validation.email');
    }

    if (errors['minlength']) {
      return this.translateService.instant('validation.minlength', {
        field: fieldLabel,
        min: errors['minlength'].requiredLength
      });
    }

    if (errors['maxlength']) {
      return this.translateService.instant('validation.maxlength', {
        field: fieldLabel,
        max: errors['maxlength'].requiredLength
      });
    }

    if (errors['min']) {
      return this.translateService.instant('validation.min', {
        field: fieldLabel,
        min: errors['min'].min
      });
    }

    if (errors['max']) {
      return this.translateService.instant('validation.max', {
        field: fieldLabel,
        max: errors['max'].max
      });
    }

    if (errors['pattern']) {
      return this.translateService.instant('validation.pattern', { field: fieldLabel });
    }

    if (errors['passwordMismatch']) {
      return this.translateService.instant('validation.password_mismatch');
    }

    if (errors['weakPassword']) {
      return this.translateService.instant('validation.weak_password');
    }

    // Generic error message for unknown validation errors
    return this.translateService.instant('validation.invalid', { field: fieldLabel });
  }

  /**
   * Get all error messages for a form control
   * @param control - Form control to check
   * @param fieldName - Field name for display
   * @returns Array of error messages
   */
  getAllErrorMessages(control: AbstractControl | null, fieldName: string): string[] {
    if (!control || !control.errors || !control.touched) {
      return [];
    }

    const messages: string[] = [];
    const errors = control.errors;
    const fieldLabel = this.translateService.instant(fieldName);

    Object.keys(errors).forEach(errorKey => {
      const message = this.getErrorMessageByType(errorKey, errors[errorKey], fieldLabel);
      if (message) {
        messages.push(message);
      }
    });

    return messages;
  }

  /**
   * Get error message by error type
   * @param errorType - Type of validation error
   * @param errorValue - Error value/details
   * @param fieldLabel - Translated field label
   * @returns Error message
   */
  private getErrorMessageByType(errorType: string, errorValue: any, fieldLabel: string): string {
    switch (errorType) {
      case 'required':
        return this.translateService.instant('validation.required', { field: fieldLabel });
      case 'email':
        return this.translateService.instant('validation.email');
      case 'minlength':
        return this.translateService.instant('validation.minlength', {
          field: fieldLabel,
          min: errorValue.requiredLength
        });
      case 'maxlength':
        return this.translateService.instant('validation.maxlength', {
          field: fieldLabel,
          max: errorValue.requiredLength
        });
      case 'min':
        return this.translateService.instant('validation.min', {
          field: fieldLabel,
          min: errorValue.min
        });
      case 'max':
        return this.translateService.instant('validation.max', {
          field: fieldLabel,
          max: errorValue.max
        });
      case 'pattern':
        return this.translateService.instant('validation.pattern', { field: fieldLabel });
      default:
        return this.translateService.instant('validation.invalid', { field: fieldLabel });
    }
  }

  /**
   * Check if control has specific error
   * @param control - Form control to check
   * @param errorType - Error type to check for
   * @returns True if control has the specified error
   */
  hasError(control: AbstractControl | null, errorType: string): boolean {
    return !!(control && control.errors && control.errors[errorType] && control.touched);
  }

  /**
   * Get password strength requirements message
   * @returns Password requirements text
   */
  getPasswordRequirements(): string {
    return this.translateService.instant('validation.password_requirements', {
      min: VALIDATION.PASSWORD_MIN_LENGTH
    });
  }
}