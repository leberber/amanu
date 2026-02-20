// src/app/pages/login/login.component.ts
import { Component, OnInit, inject, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { UserRole } from '../../models/user.model';
import { LanguageSelectorComponent } from '../../components/language-selector/language-selector.component';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { STORAGE_KEYS } from '../../core/constants/app.constants';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputTextModule,
    PasswordModule,
    ToastModule,
    RouterLink,
    DialogModule,
    TranslateModule,
    LanguageSelectorComponent
  ],
    templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  // State properties
  loginForm!: FormGroup;
  loading = false;
  returnUrl: string = '/';
  showInactiveModal = false;
  focusedField = '';

  // Services
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastMessageService);
  private translateService = inject(TranslateService);
  private elementRef = inject(ElementRef);

  // Lifecycle hooks
  ngOnInit() {
    this.initializeForm();
    this.checkReturnUrl();
    this.checkSessionExpired();
  }

  // Getters
  get f() { return this.loginForm.controls; }

  // Public methods
  onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.authService.login(this.loginForm.value)
      .pipe(
        finalize(() => {
          setTimeout(() => this.loading = false, 1000);
        })
      )
      .subscribe({
        next: (user) => {
          this.toast.showSuccess('auth.login_success');

          let targetUrl = this.returnUrl;

          if (this.returnUrl === '/' && user.role === UserRole.STAFF) {
            targetUrl = '/admin/orders';
          }
          else if (this.returnUrl === '/' && user.role === UserRole.ADMIN) {
            targetUrl = '/admin';
          }

          setTimeout(() => {
            this.router.navigate([targetUrl]);
          }, 1500);
        },
        error: (error) => {
          // Check if error is due to inactive account
          if (error.status === 400 && (error.error?.detail?.toLowerCase().includes('inactive'))) {
            // Show the inactive account modal
            this.showInactiveModal = true;
          } else {
            // Show regular error toast for other errors
            this.toast.showApiError(error, 'auth.login_failed');
          }
        }
      });
  }

  // Input focus handling
  onInputFocus(fieldName: string): void {
    this.focusedField = fieldName;
  }

  onInputBlur(): void {
    this.focusedField = '';
  }

  // Focus input when clicking anywhere on the field container
  focusField(fieldName: string): void {
    const selector = `[data-field="${fieldName}"] input, [data-field="${fieldName}"] .p-password-input`;
    const input = this.elementRef.nativeElement.querySelector(selector) as HTMLInputElement;
    if (input) {
      input.focus();
    }
  }

  // Private methods
  private initializeForm(): void {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  private checkReturnUrl(): void {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
  }

  private checkSessionExpired(): void {
    const sessionExpired = localStorage.getItem(STORAGE_KEYS.SESSION_EXPIRED);
    if (sessionExpired === 'true') {
      localStorage.removeItem(STORAGE_KEYS.SESSION_EXPIRED);
      setTimeout(() => {
        this.toast.showSessionExpired();
      }, 300);
    }
  }
}
