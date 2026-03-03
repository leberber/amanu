import { Injectable, inject } from '@angular/core';
import { AbstractControl, FormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { VALIDATION } from '../constants/validation.constants';

@Injectable({
  providedIn: 'root'
})
export class ValidationMessagesService {
  private translateService = inject(TranslateService);

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

  hasError(control: AbstractControl | null, errorType: string): boolean {
    return !!(control && control.errors && control.errors[errorType] && control.touched);
  }

  hasFieldError(form: FormGroup, fieldName: string, errorType: string): boolean {
    const field = form.get(fieldName);
    return !!(field?.hasError(errorType) && field?.touched);
  }

  getPasswordRequirements(): string {
    return this.translateService.instant('validation.password_requirements', {
      min: VALIDATION.MIN_PASSWORD_LENGTH
    });
  }
}