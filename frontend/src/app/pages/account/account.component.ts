// src/app/pages/account/account.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { PushService } from '../../services/push.service';
import { User } from '../../models/user.model';
import { DateService } from '../../core/services/date.service';
import { ValidationMessagesService } from '../../core/services/validation-messages.service';
import { VALIDATION } from '../../core/constants/app.constants';
import { PhoneFormatDirective } from '../../directives/phone-format.directive';
import { BackButtonComponent } from '../../shared/components/back-button/back-button.component';
import { ToastMessageService } from '../../core/services/toast-message.service';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    ToastModule,
    TranslateModule,
    TagModule,
    TooltipModule,
    ToggleButtonModule,
    ToggleSwitch,
    PhoneFormatDirective,
    BackButtonComponent
  ],
    templateUrl: './account.component.html',
  styleUrl: './account.component.scss'
})
export class AccountComponent implements OnInit {
  user: User | null = null;
  profileForm!: FormGroup;
  passwordForm!: FormGroup;
  loading = false;
  loadingPassword = false;
  notificationsEnabled = false;
  loadingNotifications = false;
  focusedField = '';
  
  private fb = inject(FormBuilder);
  public authService = inject(AuthService);
  private userService = inject(UserService);
  private toast = inject(ToastMessageService);
  public translateService = inject(TranslateService);
  private router = inject(Router);
  private dateService = inject(DateService);
  private formValidation = inject(ValidationMessagesService);
  public pushService = inject(PushService);
  
  ngOnInit(): void {
    this.profileForm = this.createProfileForm();
    this.passwordForm = this.createPasswordForm();
    this.loadUserData();

    // Subscribe to push notification status
    this.pushService.isSubscribed$.subscribe(isSubscribed => {
      this.notificationsEnabled = isSubscribed;
    });
  }
  
  private createProfileForm(): FormGroup {
    return this.fb.group({
      full_name: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_NAME_LENGTH)]],
      email: [{value: '', disabled: true}],
      phone: [''],
      address: ['']
    });
  }
  
  private createPasswordForm(): FormGroup {
    return this.fb.group({
      current_password: ['', Validators.required],
      new_password: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_PASSWORD_LENGTH)]],
      confirm_password: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }
  
  private passwordMatchValidator(form: FormGroup) {
    const newPassword = form.get('new_password');
    const confirmPassword = form.get('confirm_password');
    
    if (newPassword && confirmPassword && newPassword.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
    } else if (confirmPassword) {
      confirmPassword.setErrors(null);
    }
    
    return null;
  }
  
  private loadUserData(): void {
    this.user = this.authService.currentUserValue;
    if (this.user) {
      this.profileForm.patchValue({
        full_name: this.user.full_name,
        email: this.user.email,
        phone: this.user.phone || '',
        address: this.user.address || ''
      });
    }
  }
  
  onUpdateProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    
    this.loading = true;
    const updateData = {
      full_name: this.profileForm.get('full_name')?.value,
      phone: this.profileForm.get('phone')?.value,
      address: this.profileForm.get('address')?.value
    };
    
    this.userService.updateProfile(updateData).subscribe({
      next: (updatedUser) => {
        this.loading = false;
        this.user = updatedUser;

        // Update the user in auth service
        this.authService.updateCurrentUser(updatedUser);
        this.toast.showSuccess('account.profile_updated_success');
      },
      error: (error) => {
        this.loading = false;
        this.toast.showApiError(error, 'account.profile_update_failed');
      }
    });
  }
  
  onChangePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    
    this.loadingPassword = true;
    const passwordData = {
      current_password: this.passwordForm.get('current_password')?.value,
      new_password: this.passwordForm.get('new_password')?.value
    };
    
    this.userService.changePassword(passwordData).subscribe({
      next: () => {
        this.loadingPassword = false;
        this.passwordForm.reset();
        this.toast.showSuccess('account.password_changed_success');
      },
      error: (error) => {
        this.loadingPassword = false;
        this.toast.showApiError(error, 'account.password_change_failed');
      }
    });
  }
  
  getFieldError(form: FormGroup, fieldName: string, errorType: string): boolean {
    return this.formValidation.hasFieldError(form, fieldName, errorType);
  }
  
  formatDate(dateString: string | undefined): string {
    if (!dateString) return '';
    return this.dateService.formatDate(dateString);
  }
  
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  async toggleNotifications(): Promise<void> {
    this.loadingNotifications = true;
    try {
      // notificationsEnabled is already toggled by ngModel, so logic is inverted
      if (this.notificationsEnabled) {
        // User wants to enable (toggle is now ON)
        const success = await this.pushService.subscribe();
        if (success) {
          this.toast.showSuccess('account.notifications_enabled');
        } else {
          this.notificationsEnabled = false; // Revert toggle
          this.toast.showError('account.notifications_error');
        }
      } else {
        // User wants to disable (toggle is now OFF)
        await this.pushService.unsubscribe();
        this.toast.showInfo('account.notifications_disabled');
      }
    } finally {
      this.loadingNotifications = false;
    }
  }
}