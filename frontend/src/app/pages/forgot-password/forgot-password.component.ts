// src/app/pages/forgot-password/forgot-password.component.ts
import { Component, OnInit, inject, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { BackButtonComponent } from '../../shared/components/back-button/back-button.component';

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
  providers: [MessageService],
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
  private messageService = inject(MessageService);
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
          setTimeout(() => this.loading = false, 1000);
        })
      )
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.translateService.instant('common.success'),
            detail: this.translateService.instant('auth.reset_code_sent')
          });

          // Navigate to reset password page with email
          setTimeout(() => {
            this.router.navigate(['/reset-password'], { queryParams: { email } });
          }, 1500);
        },
        error: (error) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translateService.instant('common.error'),
            detail: error.error?.detail || this.translateService.instant('auth.reset_code_failed')
          });
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
