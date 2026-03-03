import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { TranslateModule } from '@ngx-translate/core';

import { ROUTES } from '../../core/constants/routes.constants';
import { VALIDATION } from '../../core/constants/validation.constants';
import { USER_ROLES } from '../../core/constants/user.constants';
import { getInitials } from '../../core/utils/format.util';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { User } from '../../models/user.model';
import { ValidationMessagesService } from '../../core/services/validation-messages.service';
import { FormBuilderService } from '../../core/services/form-builder.service';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { PhoneFormatDirective } from '../../directives/phone-format.directive';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';
import { DateFormatPipe } from '../../shared/pipes/date-format.pipe';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    PasswordModule,
    ToastModule,
    TranslateModule,
    TagModule,
    TooltipModule,
    PhoneFormatDirective,
    PageLayoutComponent,
    DateFormatPipe
  ],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss'
})
export class AccountComponent implements OnInit {
  // Dependency injection
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private toast = inject(ToastMessageService);
  private formValidation = inject(ValidationMessagesService);

  // Constants
  readonly ROUTES = ROUTES;

  // Forms
  profileForm!: FormGroup;
  passwordForm!: FormGroup;

  // Signals
  user = signal<User | null>(null);
  loading = signal(false);
  loadingPassword = signal(false);
  avatarError = signal(false);

  // Computed values - Get up to 2 initials from the name
  userInitials = computed(() => getInitials(this.user()?.full_name));

  userRoleSeverity = computed(() => {
    const role = this.user()?.role;
    if (role === USER_ROLES.ADMIN) return 'danger';
    if (role === USER_ROLES.STAFF) return 'warn';
    return 'info';
  });

  ngOnInit(): void {
    this.profileForm = this.createProfileForm();
    this.passwordForm = this.createPasswordForm();
    this.loadUserData();
  }

  private createProfileForm(): FormGroup {
    return this.fb.group({
      full_name: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_NAME_LENGTH)]],
      email: [{ value: '', disabled: true }],
      phone: [''],
      address: [''],
      store_name: ['']
    });
  }

  private createPasswordForm(): FormGroup {
    return this.fb.group({
      current_password: ['', Validators.required],
      new_password: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_PASSWORD_LENGTH)]],
      confirm_password: ['', Validators.required]
    }, { validators: FormBuilderService.createPasswordMatchValidator('new_password', 'confirm_password') });
  }

  private loadUserData(): void {
    const currentUser = this.authService.currentUserValue;
    this.user.set(currentUser);

    if (currentUser) {
      this.profileForm.patchValue({
        full_name: currentUser.full_name,
        email: currentUser.email,
        phone: currentUser.phone || '',
        address: currentUser.address || '',
        store_name: currentUser.store_name || ''
      });
    }
  }

  onUpdateProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const updateData = {
      full_name: this.profileForm.get('full_name')?.value,
      phone: this.profileForm.get('phone')?.value,
      address: this.profileForm.get('address')?.value,
      store_name: this.profileForm.get('store_name')?.value
    };

    this.userService.updateProfile(updateData).subscribe({
      next: (updatedUser) => {
        this.loading.set(false);
        this.user.set(updatedUser);
        this.authService.updateCurrentUser(updatedUser);
        this.toast.showSuccess('account.profile_updated_success');
      },
      error: (error) => {
        this.loading.set(false);
        this.toast.showApiError(error, 'account.profile_update_failed');
      }
    });
  }

  onChangePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.loadingPassword.set(true);
    const passwordData = {
      current_password: this.passwordForm.get('current_password')?.value,
      new_password: this.passwordForm.get('new_password')?.value
    };

    this.userService.changePassword(passwordData).subscribe({
      next: () => {
        this.loadingPassword.set(false);
        this.passwordForm.reset();
        this.toast.showSuccess('account.password_changed_success');
      },
      error: (error) => {
        this.loadingPassword.set(false);
        this.toast.showApiError(error, 'account.password_change_failed');
      }
    });
  }

  getFieldError(form: FormGroup, fieldName: string, errorType: string): boolean {
    return this.formValidation.hasFieldError(form, fieldName, errorType);
  }

  onAvatarError(event: Event): void {
    // Hide the image and show initials instead
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    this.avatarError.set(true);
  }
}
