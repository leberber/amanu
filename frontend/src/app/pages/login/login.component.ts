// src/app/pages/login/login.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CheckboxModule } from 'primeng/checkbox';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    PasswordModule,
    MessageModule,
    ToastModule,
    RouterLink,
    CheckboxModule,
    TranslateModule
  ],
  providers: [MessageService],
  template: `
    <div class="flex align-items-center justify-content-center min-h-screen p-4">
      <p-card styleClass="w-full max-w-md">
        <ng-template pTemplate="header">
          <div class="text-center py-4">
            <h2 class="text-2xl font-bold mb-2">{{ 'auth.login_title' | translate }}</h2>
            <p class="text-color-secondary">{{ 'auth.login_subtitle' | translate }}</p>
          </div>
        </ng-template>
        
        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="p-4">
          <div class="field mb-4">
            <label for="username" class="block font-medium mb-2">
              {{ 'common.email' | translate }} *
            </label>
            <input 
              id="username"
              type="email" 
              pInputText 
              formControlName="username"
              [placeholder]="'auth.email_placeholder' | translate"
              [class.ng-invalid]="f['username'].invalid && f['username'].touched"
              class="w-full"
            />
            <small 
              *ngIf="f['username'].invalid && f['username'].touched" 
              class="p-error block mt-1"
            >
              <span *ngIf="f['username'].errors?.['required']">
                {{ 'auth.email_required' | translate }}
              </span>
              <span *ngIf="f['username'].errors?.['email']">
                {{ 'auth.email_invalid' | translate }}
              </span>
            </small>
          </div>

          <div class="field mb-4">
            <label for="password" class="block font-medium mb-2">
              {{ 'common.password' | translate }} *
            </label>
            <p-password
              id="password"
              formControlName="password"
              [placeholder]="'auth.password_placeholder' | translate"
              [feedback]="false"
              [toggleMask]="true"
              styleClass="w-full"
              inputStyleClass="w-full"
              [class.ng-invalid]="f['password'].invalid && f['password'].touched"
            />
            <small 
              *ngIf="f['password'].invalid && f['password'].touched" 
              class="p-error block mt-1"
            >
              {{ 'auth.password_required' | translate }}
            </small>
          </div>

          <div class="flex align-items-center justify-content-between mb-4">
            <div class="flex align-items-center">
              <p-checkbox 
                formControlName="rememberMe" 
                binary="true" 
                inputId="rememberMe"
              />
              <label for="rememberMe" class="ml-2">
                {{ 'auth.remember_me' | translate }}
              </label>
            </div>
            <a 
              href="#" 
              class="text-primary font-medium text-sm hover:text-primary-600"
              (click)="onForgotPassword($event)"
            >
              {{ 'auth.forgot_password' | translate }}
            </a>
          </div>

          <p-button 
            type="submit" 
            [label]="'auth.login' | translate"
            styleClass="w-full"
            [loading]="loading"
            [disabled]="loginForm.invalid"
          />
        </form>

        <ng-template pTemplate="footer">
          <div class="text-center pt-4 border-top-1 surface-border">
            <span class="text-color-secondary">{{ 'auth.no_account' | translate }}</span>
            <a routerLink="/register" class="text-primary font-medium ml-2 hover:text-primary-600">
              {{ 'auth.register_now' | translate }}
            </a>
          </div>
        </ng-template>
      </p-card>
      
      <p-toast />
    </div>
  `,
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  loading = false;
  returnUrl: string = '/';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private messageService: MessageService,
    private translateService: TranslateService
  ) {
    // Initialize form
    this.loginForm = this.fb.group({
      username: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      rememberMe: [false]
    });
  }

  ngOnInit() {
    // Get return url from route parameters or default to '/'
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
    
    // Check for session expired flag in localStorage
    const sessionExpired = localStorage.getItem('session_expired');
    if (sessionExpired === 'true') {
      // Clear the flag immediately
      localStorage.removeItem('session_expired');
      
      // Show the message
      setTimeout(() => {
        this.messageService.add({
          severity: 'info',
          summary: this.translateService.instant('auth.session_expired_title'),
          detail: this.translateService.instant('auth.session_expired_message'),
          life: 7000
        });
      }, 300);
    }
  }

  // Convenience getter for easy access to form fields
  get f() { return this.loginForm.controls; }

  onSubmit() {
    // Stop here if form is invalid
    if (this.loginForm.invalid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.loginForm.controls).forEach(key => {
        this.loginForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.loading = true;
    this.authService.login(this.loginForm.value)
      .pipe(
        finalize(() => {
          // Always set loading to false when done (success or error)
          setTimeout(() => this.loading = false, 1000);
        })
      )
      .subscribe({
        next: (user) => {
          console.log('Login successful, user:', user);
          this.messageService.add({
            severity: 'success',
            summary: this.translateService.instant('common.success'),
            detail: this.translateService.instant('auth.login_success')
          });
          // Navigate to return url
          setTimeout(() => {
            this.router.navigate([this.returnUrl]);
          }, 1500);
        },
        error: (error) => {
          console.error('Login error:', error);
          this.messageService.add({
            severity: 'error',
            summary: this.translateService.instant('common.error'),
            detail: error.error?.detail || this.translateService.instant('auth.login_failed')
          });
        }
      });
  }

  onForgotPassword(event: Event) {
    event.preventDefault();
    this.messageService.add({
      severity: 'info',
      summary: this.translateService.instant('auth.forgot_password'),
      detail: this.translateService.instant('auth.forgot_password_message')
    });
  }
}