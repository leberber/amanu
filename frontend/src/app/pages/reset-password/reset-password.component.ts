// src/app/pages/reset-password/reset-password.component.ts
import { Component, OnInit, inject, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ToastModule } from 'primeng/toast';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { BackButtonComponent } from '../../shared/components/back-button/back-button.component';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { FormBuilderService } from '../../core/services/form-builder.service';

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
  loading = false;
  focusedField = '';
  email = '';

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastMessageService);
  private translateService = inject(TranslateService);
  private elementRef = inject(ElementRef);

  ngOnInit() {
    this.email = this.route.snapshot.queryParams['email'] || '';
    this.initializeForm();
  }

  get f() { return this.resetPasswordForm.controls; }

  // Password validation checks
  get passwordChecks() {
    const password = this.resetPasswordForm.get('password')?.value || '';
    return {
      minLength: password.length >= 8,
      hasLetter: /[a-zA-Z]/.test(password),
      hasNumber: /\d/.test(password),
      passwordsMatch: password && password === this.resetPasswordForm.get('confirmPassword')?.value
    };
  }

  onSubmit() {
    if (this.resetPasswordForm.invalid) {
      Object.keys(this.resetPasswordForm.controls).forEach(key => {
        this.resetPasswordForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.loading = true;
    const { code, password } = this.resetPasswordForm.value;

    this.authService.resetPassword(this.email, code, password)
      .pipe(
        finalize(() => {
          setTimeout(() => this.loading = false, 1000);
        })
      )
      .subscribe({
        next: () => {
          this.toast.showSuccess('auth.password_reset_success');

          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 2000);
        },
        error: (error) => {
          this.toast.showApiError(error, 'auth.password_reset_failed');
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
