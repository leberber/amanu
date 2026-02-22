// src/app/pages/reset-password/reset-password.component.ts
import { Component, OnInit, inject, ElementRef, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ToastModule } from 'primeng/toast';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { BackButtonComponent } from '../../shared/components/back-button/back-button.component';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { FormBuilderService } from '../../core/services/form-builder.service';
import { ANIMATION, UI_DELAY } from '../../core/constants/app.constants';
import { ROUTES } from '../../core/constants/routes.constants';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputTextModule,
    PasswordModule,
    ToastModule,
    TranslateModule,
    BackButtonComponent
  ],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss'
})
export class ResetPasswordComponent implements OnInit {
  resetPasswordForm!: FormGroup;
  loading = signal(false);
  focusedField = signal('');
  email = signal('');

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastMessageService);
  private elementRef = inject(ElementRef);

  ngOnInit() {
    this.email.set(this.route.snapshot.queryParams['email'] || '');
    this.initializeForm();
  }

  get f() { return this.resetPasswordForm.controls; }

  // Password validation checks using computed
  passwordChecks = computed(() => {
    const password = this.resetPasswordForm?.get('password')?.value || '';
    const confirmPassword = this.resetPasswordForm?.get('confirmPassword')?.value || '';
    return {
      minLength: password.length >= 8,
      hasLetter: /[a-zA-Z]/.test(password),
      hasNumber: /\d/.test(password),
      passwordsMatch: password && password === confirmPassword
    };
  });

  onSubmit() {
    if (this.resetPasswordForm.invalid) {
      Object.keys(this.resetPasswordForm.controls).forEach(key => {
        this.resetPasswordForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.loading.set(true);
    const { code, password } = this.resetPasswordForm.value;

    this.authService.resetPassword(this.email(), code, password)
      .pipe(
        finalize(() => {
          setTimeout(() => this.loading.set(false), ANIMATION.VERY_SLOW);
        })
      )
      .subscribe({
        next: () => {
          this.toast.showSuccess('auth.password_reset_success');

          setTimeout(() => {
            this.router.navigate([ROUTES.LOGIN]);
          }, UI_DELAY.TOAST_BEFORE_REDIRECT);
        },
        error: (error) => {
          this.toast.showApiError(error, 'auth.password_reset_failed');
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
    const selector = `[data-field="${fieldName}"] input, [data-field="${fieldName}"] .p-password-input`;
    const input = this.elementRef.nativeElement.querySelector(selector) as HTMLInputElement;
    if (input) {
      input.focus();
    }
  }

  private initializeForm(): void {
    this.resetPasswordForm = this.fb.group({
      code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6), Validators.pattern(/^\d{6}$/)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    }, {
      validators: FormBuilderService.createPasswordMatchValidator('password', 'confirmPassword')
    });
  }
}
