// src/app/pages/account/account.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { User } from '../../models/user.model';
import { DateService } from '../../../core/services/date.service';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    CardModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    ToastModule,
    TranslateModule,
    TagModule,
    TooltipModule
  ],
  providers: [MessageService],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss'
})
export class AccountComponent implements OnInit {
  user: User | null = null;
  profileForm: FormGroup;
  passwordForm: FormGroup;
  loading = false;
  loadingPassword = false;
  
  private fb = inject(FormBuilder);
  public authService = inject(AuthService);
  private userService = inject(UserService);
  private messageService = inject(MessageService);
  public translateService = inject(TranslateService);
  private router = inject(Router);
  private dateService = inject(DateService);
  
  constructor() {
    this.profileForm = this.createProfileForm();
    this.passwordForm = this.createPasswordForm();
  }
  
  ngOnInit(): void {
    this.loadUserData();
  }
  
  private createProfileForm(): FormGroup {
    return this.fb.group({
      full_name: ['', [Validators.required, Validators.minLength(3)]],
      email: [{value: '', disabled: true}], // Email is disabled
      phone: [''],
      address: ['']
    });
  }
  
  private createPasswordForm(): FormGroup {
    return this.fb.group({
      current_password: ['', Validators.required],
      new_password: ['', [Validators.required, Validators.minLength(8)]],
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
        
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('account.profile_updated'),
          detail: this.translateService.instant('account.profile_updated_success')
        });
      },
      error: (error) => {
        this.loading = false;
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: error.error?.detail || this.translateService.instant('account.profile_update_failed')
        });
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
        
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('account.password_changed'),
          detail: this.translateService.instant('account.password_changed_success')
        });
      },
      error: (error) => {
        this.loadingPassword = false;
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: error.error?.detail || this.translateService.instant('account.password_change_failed')
        });
      }
    });
  }
  
  getFieldError(form: FormGroup, fieldName: string, errorType: string): boolean {
    const field = form.get(fieldName);
    return !!(field?.hasError(errorType) && field?.touched);
  }
  
  formatDate(dateString: string | undefined): string {
    return this.dateService.formatDate(dateString);
  }
  
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}