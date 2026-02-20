import { Component, input, computed } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { inject } from '@angular/core';

@Component({
  selector: 'app-form-field',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './form-field.component.html',
  styleUrl: './form-field.component.scss'
})
export class FormFieldComponent {
  private translate = inject(TranslateService);

  // Signal inputs
  label = input<string | undefined>();
  fieldId = input<string | undefined>();
  control = input<AbstractControl | null | undefined>();
  required = input(false);
  hint = input<string | undefined>();
  showErrors = input(true);

  // Computed values
  hasError = computed(() => {
    const ctrl = this.control();
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  });

  errors = computed(() => {
    const ctrl = this.control();
    if (!ctrl || !ctrl.errors) {
      return [];
    }

    const errors: string[] = [];
    const errorObj = ctrl.errors;

    if (errorObj['required']) {
      errors.push(this.translate.instant('validation.required'));
    }
    if (errorObj['email']) {
      errors.push(this.translate.instant('validation.email'));
    }
    if (errorObj['minlength']) {
      errors.push(this.translate.instant('validation.minlength', { length: errorObj['minlength'].requiredLength }));
    }
    if (errorObj['maxlength']) {
      errors.push(this.translate.instant('validation.maxlength', { length: errorObj['maxlength'].requiredLength }));
    }
    if (errorObj['min']) {
      errors.push(this.translate.instant('validation.min', { value: errorObj['min'].min }));
    }
    if (errorObj['max']) {
      errors.push(this.translate.instant('validation.max', { value: errorObj['max'].max }));
    }
    if (errorObj['pattern']) {
      errors.push(this.translate.instant('validation.pattern'));
    }
    if (errorObj['passwordMismatch']) {
      errors.push(this.translate.instant('validation.password_mismatch'));
    }

    return errors;
  });
}
