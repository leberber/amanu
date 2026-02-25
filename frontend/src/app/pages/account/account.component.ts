// src/app/pages/account/account.component.ts
import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ROUTES } from '../../core/constants/routes.constants';
import { VALIDATION } from '../../core/constants/app.constants';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { PushService } from '../../services/push.service';
import { User } from '../../models/user.model';
import { ValidationMessagesService } from '../../core/services/validation-messages.service';
import { FormBuilderService } from '../../core/services/form-builder.service';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { UserPreferencesService, ViewMode } from '../../core/services/user-preferences.service';
import { PhoneFormatDirective } from '../../directives/phone-format.directive';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';
import { DateFormatPipe } from '../../shared/pipes/date-format.pipe';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    InputTextModule,
    PasswordModule,
    ToastModule,
    TranslateModule,
    TagModule,
    TooltipModule,
    ToggleSwitch,
    SelectButtonModule,
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
  private router = inject(Router);
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private toast = inject(ToastMessageService);
  private translateService = inject(TranslateService);
  private formValidation = inject(ValidationMessagesService);
  private pushService = inject(PushService);
  private preferencesService = inject(UserPreferencesService);
  private destroyRef = inject(DestroyRef);

  // Constants
  readonly ROUTES = ROUTES;

  // View mode options for product display
  viewModeOptions = [
    { label: 'Liste', value: 'list', icon: 'pi pi-list' },
    { label: 'Grille', value: 'grid', icon: 'pi pi-th-large' }
  ];

  // Current view mode (bound to SelectButton)
  productViewMode = computed(() => this.preferencesService.productViewMode());

  // Forms
  profileForm!: FormGroup;
  passwordForm!: FormGroup;

  // Signals
  user = signal<User | null>(null);
  loading = signal(false);
  loadingPassword = signal(false);
  notificationsEnabled = signal(false);
  loadingNotifications = signal(false);
  focusedField = signal('');

  // Computed values
  userInitial = computed(() => {
    const name = this.user()?.full_name;
    return name?.charAt(0)?.toUpperCase() || 'U';
  });

  // Page layout subtitle
  pageSubtitle = computed(() => this.user()?.full_name || '');

  userRoleSeverity = computed(() => {
    const role = this.user()?.role;
    if (role === 'admin') return 'danger';
    if (role === 'staff') return 'warn';
    return 'info';
  });

  ngOnInit(): void {
    this.profileForm = this.createProfileForm();
    this.passwordForm = this.createPasswordForm();
    this.loadUserData();

    // Subscribe to push notification status
    this.pushService.isSubscribed$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(isSubscribed => {
        this.notificationsEnabled.set(isSubscribed);
      });
  }

  private createProfileForm(): FormGroup {
    return this.fb.group({
      full_name: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_NAME_LENGTH)]],
      email: [{ value: '', disabled: true }],
      phone: [''],
      address: ['']
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
        address: currentUser.address || ''
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
      address: this.profileForm.get('address')?.value
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

  logout(): void {
    this.authService.logout();
    this.router.navigate([ROUTES.HOME]);
  }

  async toggleNotifications(): Promise<void> {
    this.loadingNotifications.set(true);
    try {
      if (this.notificationsEnabled()) {
        const success = await this.pushService.subscribe();
        if (success) {
          this.toast.showSuccess('account.notifications_enabled');
        } else {
          this.notificationsEnabled.set(false);
          this.toast.showError('account.notifications_error');
        }
      } else {
        await this.pushService.unsubscribe();
        this.toast.showInfo('account.notifications_disabled');
      }
    } finally {
      this.loadingNotifications.set(false);
    }
  }

  setFocusedField(field: string): void {
    this.focusedField.set(field);
  }

  clearFocusedField(): void {
    this.focusedField.set('');
  }

  onViewModeChange(mode: ViewMode): void {
    this.preferencesService.setProductViewMode(mode);
  }
}
