import { Component, OnInit, inject, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { BackButtonComponent } from '../../shared/components/back-button/back-button.component';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { ANIMATION, UI_DELAY } from '../../core/constants/app.constants';
import { ROUTES } from '../../core/constants/routes.constants';

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
  loading = signal(false);
  focusedField = signal('');

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastMessageService);
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

    this.loading.set(true);
    const email = this.forgotPasswordForm.get('email')?.value;

    this.authService.forgotPassword(email)
      .pipe(
        finalize(() => {
          setTimeout(() => this.loading.set(false), ANIMATION.VERY_SLOW);
        })
      )
      .subscribe({
        next: () => {
          this.toast.showSuccess('auth.reset_code_sent');

          // Navigate to reset password page with email
          setTimeout(() => {
            this.router.navigate([ROUTES.RESET_PASSWORD], { queryParams: { email } });
          }, UI_DELAY.TOAST_BEFORE_NAVIGATE);
        },
        error: (error) => {
          this.toast.showApiError(error, 'auth.reset_code_failed');
        }
      });
  }

  onInputFocus(fieldName: string): void {
    this.focusedField.set(fieldName);
  }

  onInputBlur(): void {
    this.focusedField.set('');
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
