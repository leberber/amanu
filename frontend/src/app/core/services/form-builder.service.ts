import { Injectable, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { VALIDATION } from '../constants/app.constants';

/**
 * Service to create common form patterns
 * Reduces duplication in form creation across components
 */
@Injectable({
  providedIn: 'root'
})
export class FormBuilderService {
  private fb = inject(FormBuilder);

  /**
   * Create user form with common fields
   * @param options - Configuration options for the form
   * @returns FormGroup with user fields
   */
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
      form.addControl('password', this.fb.control('', 
        requiredFields.includes('password') 
          ? [Validators.required, Validators.minLength(VALIDATION.PASSWORD_MIN_LENGTH)]
          : [Validators.minLength(VALIDATION.PASSWORD_MIN_LENGTH)]
      ));
    }

    if (options?.includeRole) {
      form.addControl('role', this.fb.control('customer'));
    }

    if (options?.includeActive) {
      form.addControl('is_active', this.fb.control(true));
    }

    return form;
  }

  /**
   * Create product form with translations
   * @returns FormGroup with product fields
   */
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

  /**
   * Create category form with translations
   * @returns FormGroup with category fields
   */
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

  /**
   * Create address form
   * @returns FormGroup with address fields
   */
  createAddressForm(): FormGroup {
    return this.fb.group({
      fullName: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(VALIDATION.PHONE_PATTERN)]],
      address: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_ADDRESS_LENGTH)]]
    });
  }

  /**
   * Create login form
   * @returns FormGroup with login fields
   */
  createLoginForm(): FormGroup {
    return this.fb.group({
      username: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      rememberMe: [false]
    });
  }

  /**
   * Create password change form with confirmation
   * @returns FormGroup with password fields
   */
  createPasswordForm(): FormGroup {
    return this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(VALIDATION.PASSWORD_MIN_LENGTH)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  /**
   * Get validators for a field based on requirements
   * @param fieldName - Name of the field
   * @param requiredFields - Array of required field names
   * @returns Array of validators
   */
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

  /**
   * Validator to check if passwords match
   * @param control - Abstract control (form group)
   * @returns Validation errors or null
   */
  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const newPassword = control.get('newPassword');
    const confirmPassword = control.get('confirmPassword');

    if (!newPassword || !confirmPassword) {
      return null;
    }

    if (confirmPassword.errors && !confirmPassword.errors['passwordMismatch']) {
      return null;
    }

    if (newPassword.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    } else {
      confirmPassword.setErrors(null);
      return null;
    }
  }
}