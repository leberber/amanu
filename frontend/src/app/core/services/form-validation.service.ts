import { Injectable } from '@angular/core';
import { AbstractControl, FormGroup, ValidationErrors } from '@angular/forms';

@Injectable({
  providedIn: 'root'
})
export class FormValidationService {
  
  /**
   * Check if a form field has a specific error and has been touched
   * @param form - FormGroup instance
   * @param fieldName - Name of the field
   * @param errorType - Type of error to check for
   * @returns boolean indicating if the error exists and field is touched
   */
  hasError(form: FormGroup, fieldName: string, errorType: string): boolean {
    const field = form.get(fieldName);
    return !!(field?.hasError(errorType) && field?.touched);
  }
  
  /**
   * Check if a form field is invalid and has been touched
   * @param form - FormGroup instance
   * @param fieldName - Name of the field
   * @returns boolean
   */
  isFieldInvalid(form: FormGroup, fieldName: string): boolean {
    const field = form.get(fieldName);
    return !!(field?.invalid && field?.touched);
  }
  
  /**
   * Get error message for a specific field
   * @param form - FormGroup instance
   * @param fieldName - Name of the field
   * @param customMessages - Optional custom error messages
   * @returns Error message string
   */
  getErrorMessage(
    form: FormGroup,
    fieldName: string,
    customMessages?: Record<string, string>
  ): string {
    const field = form.get(fieldName);
    if (!field || !field.errors || !field.touched) {
      return '';
    }
    
    const errors = field.errors;
    const errorKey = Object.keys(errors)[0];
    
    // Check for custom message first
    if (customMessages && customMessages[errorKey]) {
      return this.interpolateMessage(customMessages[errorKey], errors[errorKey]);
    }
    
    // Default error messages
    return this.getDefaultErrorMessage(errorKey, errors[errorKey], fieldName);
  }
  
  /**
   * Get all error messages for a form
   * @param form - FormGroup instance
   * @param customMessages - Optional custom error messages per field
   * @returns Object with field names as keys and error messages as values
   */
  getAllErrors(
    form: FormGroup,
    customMessages?: Record<string, Record<string, string>>
  ): Record<string, string> {
    const errors: Record<string, string> = {};
    
    Object.keys(form.controls).forEach(fieldName => {
      const errorMessage = this.getErrorMessage(
        form,
        fieldName,
        customMessages?.[fieldName]
      );
      if (errorMessage) {
        errors[fieldName] = errorMessage;
      }
    });
    
    return errors;
  }
  
  /**
   * Mark all fields as touched to trigger validation display
   * @param form - FormGroup instance
   */
  markAllFieldsAsTouched(form: FormGroup): void {
    Object.keys(form.controls).forEach(key => {
      const control = form.get(key);
      control?.markAsTouched();
      
      // Recursively mark nested form groups
      if (control instanceof FormGroup) {
        this.markAllFieldsAsTouched(control);
      }
    });
  }
  
  /**
   * Reset form and clear validations
   * @param form - FormGroup instance
   * @param value - Optional value to reset form with
   */
  resetForm(form: FormGroup, value?: any): void {
    form.reset(value);
    form.markAsUntouched();
    form.markAsPristine();
  }
  
  /**
   * Get default error message based on validator type
   * @param validatorName - Name of the validator
   * @param validatorValue - Value of the validator error
   * @param fieldName - Name of the field
   * @returns Error message string
   */
  private getDefaultErrorMessage(
    validatorName: string,
    validatorValue: any,
    fieldName: string
  ): string {
    const config: Record<string, () => string> = {
      required: () => `${this.humanizeFieldName(fieldName)} is required`,
      email: () => 'Please enter a valid email address',
      minlength: () => `${this.humanizeFieldName(fieldName)} must be at least ${validatorValue.requiredLength} characters`,
      maxlength: () => `${this.humanizeFieldName(fieldName)} must not exceed ${validatorValue.requiredLength} characters`,
      min: () => `${this.humanizeFieldName(fieldName)} must be at least ${validatorValue.min}`,
      max: () => `${this.humanizeFieldName(fieldName)} must not exceed ${validatorValue.max}`,
      pattern: () => `${this.humanizeFieldName(fieldName)} format is invalid`,
      whitespace: () => `${this.humanizeFieldName(fieldName)} cannot contain only whitespace`,
      numeric: () => `${this.humanizeFieldName(fieldName)} must be a number`,
      alphanumeric: () => `${this.humanizeFieldName(fieldName)} must contain only letters and numbers`,
      phone: () => 'Please enter a valid phone number',
      url: () => 'Please enter a valid URL',
      date: () => 'Please enter a valid date',
      match: () => 'Fields do not match',
      unique: () => `${this.humanizeFieldName(fieldName)} already exists`,
      custom: () => validatorValue.message || 'Invalid value'
    };
    
    const errorMessageFn = config[validatorName];
    return errorMessageFn ? errorMessageFn() : `${this.humanizeFieldName(fieldName)} is invalid`;
  }
  
  /**
   * Convert field name to human-readable format
   * @param fieldName - Field name
   * @returns Humanized field name
   */
  private humanizeFieldName(fieldName: string): string {
    return fieldName
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }
  
  /**
   * Interpolate message with error values
   * @param message - Message template
   * @param errorValue - Error value object
   * @returns Interpolated message
   */
  private interpolateMessage(message: string, errorValue: any): string {
    if (typeof errorValue === 'object') {
      Object.keys(errorValue).forEach(key => {
        message = message.replace(`{${key}}`, errorValue[key]);
      });
    }
    return message;
  }
  
  /**
   * Common validators
   */
  static validators = {
    /**
     * Whitespace validator
     */
    noWhitespace(control: AbstractControl): ValidationErrors | null {
      const value = control.value;
      if (!value || value.trim().length === value.length) {
        return null;
      }
      return { whitespace: true };
    },
    
    /**
     * Numeric validator
     */
    numeric(control: AbstractControl): ValidationErrors | null {
      const value = control.value;
      if (!value || /^\d+$/.test(value)) {
        return null;
      }
      return { numeric: true };
    },
    
    /**
     * Alphanumeric validator
     */
    alphanumeric(control: AbstractControl): ValidationErrors | null {
      const value = control.value;
      if (!value || /^[a-zA-Z0-9]+$/.test(value)) {
        return null;
      }
      return { alphanumeric: true };
    },
    
    /**
     * Phone number validator
     */
    phone(control: AbstractControl): ValidationErrors | null {
      const value = control.value;
      if (!value || /^[\d\s\-\+\(\)]+$/.test(value)) {
        return null;
      }
      return { phone: true };
    },
    
    /**
     * URL validator
     */
    url(control: AbstractControl): ValidationErrors | null {
      const value = control.value;
      if (!value) return null;
      
      try {
        new URL(value);
        return null;
      } catch {
        return { url: true };
      }
    },
    
    /**
     * Match validator (for password confirmation)
     */
    match(fieldName: string) {
      return (control: AbstractControl): ValidationErrors | null => {
        if (!control.parent) return null;
        
        const field = control.parent.get(fieldName);
        if (!field) return null;
        
        if (field.value !== control.value) {
          return { match: { fieldName } };
        }
        
        return null;
      };
    }
  };
}