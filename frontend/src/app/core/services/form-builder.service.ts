import { Injectable, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { VALIDATION } from '../constants/validation.constants';
import { USER_ROLES } from '../constants/user.constants';

@Injectable({
  providedIn: 'root'
})
export class FormBuilderService {
  private fb = inject(FormBuilder);

  createUserForm(options?: {
    includePassword?: boolean;
    includeRole?: boolean;
    includeActive?: boolean;
    requiredFields?: string[];
  }): FormGroup {
    const requiredFields = options?.requiredFields || ['full_name', 'email'];
    
    const form = this.fb.group({
      full_name: ['', this.getValidators('full_name', requiredFields)],
      email: ['', this.getValidators('email', requiredFields)],
      phone: ['', this.getValidators('phone', requiredFields)],
      address: ['', this.getValidators('address', requiredFields)]
    });

    if (options?.includePassword) {
      (form as any).addControl('password', this.fb.control('',
        requiredFields.includes('password')
          ? [Validators.required, Validators.minLength(VALIDATION.MIN_PASSWORD_LENGTH)]
          : [Validators.minLength(VALIDATION.MIN_PASSWORD_LENGTH)]
      ));
    }

    if (options?.includeRole) {
      (form as any).addControl('role', this.fb.control(USER_ROLES.CUSTOMER));
    }

    if (options?.includeActive) {
      (form as any).addControl('is_active', this.fb.control(true));
    }

    return form;
  }

  createProductForm(): FormGroup {
    return this.fb.group({
      // Translation fields (all required)
      name_en: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_NAME_LENGTH)]],
      name_fr: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_NAME_LENGTH)]],
      name_ar: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_NAME_LENGTH)]],
      
      description_en: [''],
      description_fr: [''],
      description_ar: [''],
      
      // Product details
      category_id: [null, Validators.required],
      price: [null, [Validators.required, Validators.min(0)]],
      stock_quantity: [0, [Validators.required, Validators.min(0)]],
      unit: ['kg', Validators.required],
      
      // Images
      images: [[]],
      
      // Settings
      is_active: [true]
    });
  }

  createCategoryForm(): FormGroup {
    return this.fb.group({
      // Translation fields (all required for names)
      name_en: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_NAME_LENGTH)]],
      name_fr: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_NAME_LENGTH)]],
      name_ar: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_NAME_LENGTH)]],
      
      description_en: [''],
      description_fr: [''],
      description_ar: [''],
      
      // Settings
      image_url: [''],
      is_active: [true]
    });
  }

  createAddressForm(): FormGroup {
    return this.fb.group({
      fullName: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(VALIDATION.PHONE_PATTERN)]],
      address: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_ADDRESS_LENGTH)]]
    });
  }

  createLoginForm(): FormGroup {
    return this.fb.group({
      username: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      rememberMe: [true]
    });
  }

  createPasswordForm(): FormGroup {
    return this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_PASSWORD_LENGTH)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  private getValidators(fieldName: string, requiredFields: string[]): any[] {
    const validators: any[] = [];
    
    if (requiredFields.includes(fieldName)) {
      validators.push(Validators.required);
    }

    switch (fieldName) {
      case 'full_name':
        validators.push(Validators.minLength(VALIDATION.MIN_NAME_LENGTH));
        break;
      case 'email':
        validators.push(Validators.email);
        break;
      case 'phone':
        validators.push(Validators.pattern(VALIDATION.PHONE_PATTERN));
        break;
      case 'address':
        validators.push(Validators.minLength(VALIDATION.MIN_ADDRESS_LENGTH));
        break;
    }

    return validators;
  }

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    return FormBuilderService.createPasswordMatchValidator('newPassword', 'confirmPassword')(control);
  }

  static createPasswordMatchValidator(
    passwordField: string,
    confirmField: string
  ): (control: AbstractControl) => ValidationErrors | null {
    return (control: AbstractControl): ValidationErrors | null => {
      const password = control.get(passwordField);
      const confirmPassword = control.get(confirmField);

      if (!password || !confirmPassword) {
        return null;
      }

      // Don't override other errors
      if (confirmPassword.errors && !confirmPassword.errors['passwordMismatch']) {
        return null;
      }

      if (password.value !== confirmPassword.value) {
        confirmPassword.setErrors({ passwordMismatch: true });
        return { passwordMismatch: true };
      } else {
        confirmPassword.setErrors(null);
        return null;
      }
    };
  }
}