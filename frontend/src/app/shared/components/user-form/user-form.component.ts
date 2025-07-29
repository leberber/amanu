// src/app/shared/components/user-form/user-form.component.ts
import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FormValidationService } from '../../../core/services/form-validation.service';

export interface UserFormData {
  full_name: string;
  email: string;
  phone?: string;
  address?: string;
  password?: string;
  role?: string;
  is_active?: boolean;
}

export interface UserFormConfig {
  mode: 'create' | 'edit' | 'register';
  showRoleSelection?: boolean;
  showActiveToggle?: boolean;
  showAddressField?: boolean;
  showPhoneField?: boolean;
  passwordRequired?: boolean;
  submitButtonLabel?: string;
  cancelButtonLabel?: string;
  showCancelButton?: boolean;
}

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputTextModule,
    PasswordModule,
    SelectModule,
    CheckboxModule,
    ButtonModule,
    TranslateModule
  ],
  templateUrl: './user-form.component.html',
  styleUrl: './user-form.component.scss'
})
export class UserFormComponent implements OnInit {
  @Input() config: UserFormConfig = {
    mode: 'register',
    showRoleSelection: false,
    showActiveToggle: false,
    showAddressField: true,
    showPhoneField: true,
    passwordRequired: true,
    showCancelButton: false
  };
  
  @Input() initialData?: Partial<UserFormData>;
  @Input() loading = false;
  
  @Output() formSubmit = new EventEmitter<UserFormData>();
  @Output() formCancel = new EventEmitter<void>();
  
  userForm: FormGroup;
  roleOptions: any[] = [];
  currentLang: string = 'en';
  
  constructor(
    private fb: FormBuilder,
    private translateService: TranslateService,
    private formValidation: FormValidationService
  ) {
    this.userForm = this.createForm();
  }
  
  ngOnInit(): void {
    this.currentLang = this.translateService.currentLang;
    this.initializeRoleOptions();
    this.configureForm();
    
    if (this.initialData) {
      this.userForm.patchValue(this.initialData);
    }
    
    // Update role options when language changes
    this.translateService.onLangChange.subscribe(() => {
      this.currentLang = this.translateService.currentLang;
      this.initializeRoleOptions();
    });
  }
  
  private createForm(): FormGroup {
    return this.fb.group({
      full_name: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      address: [''],
      password: [''],
      role: ['customer'],
      is_active: [true]
    });
  }
  
  private configureForm(): void {
    // Configure password validation based on mode
    if (this.config.passwordRequired) {
      this.userForm.get('password')?.setValidators([
        Validators.required,
        Validators.minLength(8)
      ]);
    } else {
      this.userForm.get('password')?.setValidators([Validators.minLength(8)]);
    }
    
    // Set default role for register mode
    if (this.config.mode === 'register') {
      this.userForm.patchValue({ role: 'customer' });
    }
    
    // Disable email field in edit mode
    if (this.config.mode === 'edit') {
      this.userForm.get('email')?.disable();
    }
    
    this.userForm.get('password')?.updateValueAndValidity();
  }
  
  private initializeRoleOptions(): void {
    this.roleOptions = [
      { label: this.translateService.instant('admin.users.roles.customer'), value: 'customer' },
      { label: this.translateService.instant('admin.users.roles.staff'), value: 'staff' },
      { label: this.translateService.instant('admin.users.roles.admin'), value: 'admin' }
    ];
  }
  
  onSubmit(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }
    
    const formData = this.userForm.getRawValue();
    
    // Remove empty password in edit mode
    if (this.config.mode === 'edit' && !formData.password) {
      delete formData.password;
    }
    
    // Remove fields based on configuration
    if (!this.config.showRoleSelection) {
      formData.role = 'customer';
    }
    
    if (!this.config.showActiveToggle) {
      formData.is_active = true;
    }
    
    if (!this.config.showPhoneField) {
      delete formData.phone;
    }
    
    if (!this.config.showAddressField) {
      delete formData.address;
    }
    
    this.formSubmit.emit(formData);
  }
  
  onCancel(): void {
    this.formCancel.emit();
  }
  
  getFieldError(fieldName: string, errorType: string): boolean {
    return this.formValidation.hasError(this.userForm, fieldName, errorType);
  }
  
  get submitButtonLabel(): string {
    if (this.config.submitButtonLabel) {
      return this.config.submitButtonLabel;
    }
    
    switch (this.config.mode) {
      case 'create':
        return this.translateService.instant('admin.users.dialog.create_button');
      case 'edit':
        return this.translateService.instant('admin.users.dialog.update_button');
      case 'register':
        return this.translateService.instant('auth.register');
      default:
        return this.translateService.instant('common.submit');
    }
  }
  
  get passwordLabel(): string {
    if (this.config.mode === 'edit') {
      return this.translateService.instant('admin.users.form.password_edit');
    }
    return this.translateService.instant('admin.users.form.password');
  }
  
  get showPasswordRequired(): boolean {
    return this.config.passwordRequired || false;
  }
}