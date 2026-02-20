// src/app/shared/components/user-form/user-form.component.ts
import { Component, OnInit, OnChanges, SimpleChanges, inject, DestroyRef, input, output, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { onLanguageChange } from '../../../core/utils/language-change.util';
import { ValidationMessagesService } from '../../../core/services/validation-messages.service';
import { StatusSeverityService } from '../../../core/services/status-severity.service';
import { VALIDATION, USER_ROLES } from '../../../core/constants/app.constants';

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
export class UserFormComponent implements OnInit, OnChanges {
  // Inputs
  configInput = input<UserFormConfig>({
    mode: 'register',
    showRoleSelection: false,
    showActiveToggle: false,
    showAddressField: true,
    showPhoneField: true,
    passwordRequired: true,
    showCancelButton: false
  }, { alias: 'config' });

  initialDataInput = input<Partial<UserFormData> | undefined>(undefined, { alias: 'initialData' });
  loadingInput = input(false, { alias: 'loading' });

  // Outputs
  formSubmit = output<UserFormData>();
  formCancel = output<void>();

  // State
  userForm!: FormGroup;
  roleOptions: any[] = [];
  currentLang = signal('en');

  // Convenience getter for template
  get config(): UserFormConfig { return this.configInput(); }
  get loading(): boolean { return this.loadingInput(); }
  
  private fb = inject(FormBuilder);
  private translateService = inject(TranslateService);
  private formValidation = inject(ValidationMessagesService);
  private statusService = inject(StatusSeverityService);
  private destroyRef = inject(DestroyRef);
  
  ngOnInit(): void {
    this.userForm = this.createForm();
    this.currentLang.set(this.translateService.currentLang);
    this.initializeRoleOptions();
    this.configureForm();

    const initialData = this.initialDataInput();
    if (initialData) {
      this.userForm.patchValue(initialData);
    }

    onLanguageChange(this.translateService, this.destroyRef, () => {
      this.currentLang.set(this.translateService.currentLang);
      this.initializeRoleOptions();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialDataInput'] && !changes['initialDataInput'].firstChange && this.userForm) {
      const newData = this.initialDataInput();
      if (newData) {
        this.userForm.reset();
        this.userForm.patchValue(newData);

        this.configureForm();

        if (this.configInput().mode === 'edit') {
          this.userForm.get('email')?.disable();
        }
      }
    }

    if (changes['configInput'] && !changes['configInput'].firstChange && this.userForm) {
      this.configureForm();
    }
  }
  
  private createForm(): FormGroup {
    return this.fb.group({
      full_name: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_NAME_LENGTH)]],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      address: [''],
      password: [''],
      role: [USER_ROLES.CUSTOMER],
      is_active: [true]
    });
  }
  
  private configureForm(): void {
    const config = this.configInput();

    if (config.passwordRequired) {
      this.userForm.get('password')?.setValidators([
        Validators.required,
        Validators.minLength(VALIDATION.MIN_PASSWORD_LENGTH)
      ]);
    } else {
      this.userForm.get('password')?.setValidators([Validators.minLength(VALIDATION.MIN_PASSWORD_LENGTH)]);
    }

    if (config.mode === 'register') {
      this.userForm.patchValue({ role: USER_ROLES.CUSTOMER });
    }

    if (config.mode === 'edit') {
      this.userForm.get('email')?.disable();
    }

    this.userForm.get('password')?.updateValueAndValidity();
  }
  
  private initializeRoleOptions(): void {
    this.roleOptions = this.statusService.getRoleOptions();
  }
  
  onSubmit(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    const config = this.configInput();
    const formData = this.userForm.getRawValue();

    if (config.mode === 'edit' && !formData.password) {
      delete formData.password;
    }

    if (!config.showRoleSelection) {
      formData.role = USER_ROLES.CUSTOMER;
    }

    if (!config.showActiveToggle) {
      formData.is_active = true;
    }

    if (!config.showPhoneField) {
      delete formData.phone;
    }

    if (!config.showAddressField) {
      delete formData.address;
    }

    this.formSubmit.emit(formData);
  }
  
  onCancel(): void {
    this.formCancel.emit();
  }
  
  getFieldError(fieldName: string, errorType: string): boolean {
    return this.formValidation.hasFieldError(this.userForm, fieldName, errorType);
  }
  
  get submitButtonLabel(): string {
    const config = this.configInput();
    if (config.submitButtonLabel) {
      return config.submitButtonLabel;
    }

    switch (config.mode) {
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
    if (this.configInput().mode === 'edit') {
      return this.translateService.instant('admin.users.form.password_edit');
    }
    return this.translateService.instant('admin.users.form.password');
  }

  get showPasswordRequired(): boolean {
    return this.configInput().passwordRequired || false;
  }
}