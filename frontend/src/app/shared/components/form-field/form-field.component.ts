import { Component, Input, ContentChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Simple form field wrapper component
 * Provides consistent layout for form fields with labels and error messages
 */
@Component({
  selector: 'app-form-field',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="field" [class.field-error]="hasError">
      <label *ngIf="label" [for]="fieldId" [class.required]="required">
        {{ label }}
        <span *ngIf="required" class="required-indicator">*</span>
      </label>
      
      <ng-content></ng-content>
      
      <small *ngIf="hasError && showErrors" class="p-error">
        <ng-container *ngFor="let error of getErrors()">
          {{ error }}
        </ng-container>
      </small>
      
      <small *ngIf="hint && !hasError" class="p-hint">
        {{ hint }}
      </small>
    </div>
  `,
  styles: [`
    .field {
      margin-bottom: 1rem;
    }
    
    .field-error {
      .p-inputtext,
      .p-dropdown,
      .p-inputnumber,
      .p-calendar,
      .p-inputtextarea {
        border-color: var(--red-500);
      }
    }
    
    label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
    }
    
    label.required {
      font-weight: 600;
    }
    
    .required-indicator {
      color: var(--red-500);
      margin-left: 0.25rem;
    }
    
    .p-error {
      display: block;
      margin-top: 0.25rem;
      color: var(--red-500);
    }
    
    .p-hint {
      display: block;
      margin-top: 0.25rem;
      color: var(--text-color-secondary);
    }
  `]
})
export class FormFieldComponent {
  @Input() label?: string;
  @Input() fieldId?: string;
  @Input() control?: AbstractControl | null;
  @Input() required = false;
  @Input() hint?: string;
  @Input() showErrors = true;

  get hasError(): boolean {
    return !!(this.control && this.control.invalid && (this.control.dirty || this.control.touched));
  }

  getErrors(): string[] {
    if (!this.control || !this.control.errors) {
      return [];
    }

    const errors: string[] = [];
    const errorObj = this.control.errors;

    // Handle common validation errors
    if (errorObj['required']) {
      errors.push('This field is required');
    }
    if (errorObj['email']) {
      errors.push('Please enter a valid email address');
    }
    if (errorObj['minlength']) {
      errors.push(`Minimum length is ${errorObj['minlength'].requiredLength} characters`);
    }
    if (errorObj['maxlength']) {
      errors.push(`Maximum length is ${errorObj['maxlength'].requiredLength} characters`);
    }
    if (errorObj['min']) {
      errors.push(`Minimum value is ${errorObj['min'].min}`);
    }
    if (errorObj['max']) {
      errors.push(`Maximum value is ${errorObj['max'].max}`);
    }
    if (errorObj['pattern']) {
      errors.push('Please enter a valid format');
    }

    // Custom errors
    if (errorObj['passwordMismatch']) {
      errors.push('Passwords do not match');
    }

    return errors;
  }
}