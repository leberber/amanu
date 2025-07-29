// src/app/pages/register/register.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { UserFormComponent, UserFormData, UserFormConfig } from '../../shared/components/user-form/user-form.component';
import { UserRole } from '../../models/user.model';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    CardModule,
    ToastModule,
    RouterLink,
    TranslateModule,
    UserFormComponent
  ],
  providers: [MessageService],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  loading = false;
  
  userFormConfig: UserFormConfig = {
    mode: 'register',
    showRoleSelection: false,
    showActiveToggle: false,
    showAddressField: true,
    showPhoneField: true,
    passwordRequired: true,
    showCancelButton: false
  };

  constructor(
    private authService: AuthService,
    private router: Router,
    private messageService: MessageService,
    private translateService: TranslateService
  ) {}

  onRegister(formData: UserFormData) {
    this.loading = true;
    
    // Ensure role is set to customer for registration and password is provided
    const registerData = {
      full_name: formData.full_name,
      email: formData.email,
      password: formData.password!, // Password is required for registration
      phone: formData.phone,
      address: formData.address,
      role: UserRole.CUSTOMER
    };
    
    this.authService.register(registerData)
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.translateService.instant('common.success'),
            detail: this.translateService.instant('auth.register_success')
          });
          // Navigate to login page after successful registration
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 1500);
        },
        error: (error) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translateService.instant('common.error'),
            detail: error.error?.detail || this.translateService.instant('auth.register_failed')
          });
          this.loading = false;
        }
      });
  }
}