import { Component, OnInit, AfterViewInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { TranslateModule } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { AuthService } from '../../services/auth.service';
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
    ToastModule,
    RouterLink,
    TranslateModule
  ],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss'
})
export class ResetPasswordComponent implements OnInit, AfterViewInit {
  resetPasswordForm!: FormGroup;
  loading = signal(false);
  focusedField = signal('');
  email = signal('');
  pageReady = signal(false);
  showPassword = signal(false);
  showConfirmPassword = signal(false);

  // Password value signals for reactive validation display
  passwordValue = signal('');
  confirmPasswordValue = signal('');

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastMessageService);
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    this.email.set(this.route.snapshot.queryParams['email'] || '');
    this.initializeForm();
    this.setupPasswordTracking();
  }

  ngAfterViewInit() {
    // Trigger animation sequence - logo stays centered for 1 second
    setTimeout(() => {
      this.pageReady.set(true);
    }, 1000);
  }

  get f() { return this.resetPasswordForm.controls; }

  // Track password changes to update signals
  private setupPasswordTracking(): void {
    this.resetPasswordForm.get('password')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => this.passwordValue.set(value || ''));

    this.resetPasswordForm.get('confirmPassword')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => this.confirmPasswordValue.set(value || ''));
  }

  // Password validation checks using computed (now reactive)
  passwordChecks = computed(() => {
    const password = this.passwordValue();
    const confirmPassword = this.confirmPasswordValue();
    return {
      minLength: password.length >= 8,
      hasLetter: /[a-zA-Z]/.test(password),
      hasNumber: /\d/.test(password),
      passwordsMatch: password.length > 0 && password === confirmPassword
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

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword.update(v => !v);
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
