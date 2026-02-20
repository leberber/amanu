// src/app/pages/forgot-password/forgot-password.component.ts
import { Component, OnInit, inject, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { BackButtonComponent } from '../../shared/components/back-button/back-button.component';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { ANIMATION } from '../../core/constants/app.constants';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputTextModule,
    ToastModule,
    TranslateModule,
    BackButtonComponent
  ],
    templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss'
})
export class ForgotPasswordComponent implements OnInit {
  forgotPasswordForm!: FormGroup;
  loading = false;
  focusedField = '';

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastMessageService);
  private translateService = inject(TranslateService);
  private elementRef = inject(ElementRef);

  ngOnInit() {
    this.initializeForm();
  }

  get f() { return this.forgotPasswordForm.controls; }

  onSubmit() {
    if (this.forgotPasswordForm.invalid) {
      Object.keys(this.forgotPasswordForm.controls).forEach(key => {
        this.forgotPasswordForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.loading = true;
    const email = this.forgotPasswordForm.get('email')?.value;

    this.authService.forgotPassword(email)
      .pipe(
        finalize(() => {
          setTimeout(() => this.loading = false, ANIMATION.VERY_SLOW);
        })
      )
      .subscribe({
        next: () => {
          this.toast.showSuccess('auth.reset_code_sent');

          // Navigate to reset password page with email
          setTimeout(() => {
            this.router.navigate(['/reset-password'], { queryParams: { email } });
          }, 1500);
        },
        error: (error) => {
          this.toast.showApiError(error, 'auth.reset_code_failed');
        }
      });
  }

  onInputFocus(fieldName: string): void {
    this.focusedField = fieldName;
  }

  onInputBlur(): void {
    this.focusedField = '';
  }

  focusField(fieldName: string): void {
    const selector = `[data-field="${fieldName}"] input`;
    const input = this.elementRef.nativeElement.querySelector(selector) as HTMLInputElement;
    if (input) {
      input.focus();
    }
  }

  private initializeForm(): void {
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }
}
