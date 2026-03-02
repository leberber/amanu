import { Component, OnInit, AfterViewInit, inject, ElementRef, signal, viewChild, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { UserRole } from '../../models/user.model';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { STORAGE_KEYS, ANIMATION, UI_DELAY } from '../../core/constants/app.constants';
import { ROUTES, DefaultRedirects } from '../../core/constants/routes.constants';
import { environment } from '../../../environments/environment';

declare const google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ToastModule,
    RouterLink,
    TranslateModule
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit, AfterViewInit {
  // ViewChild
  usernameInput = viewChild<ElementRef<HTMLInputElement>>('usernameInput');

  // State signals
  loginForm!: FormGroup;
  loading = signal(false);
  googleLoading = signal(false);
  returnUrl = signal<string>(ROUTES.HOME);
  focusedField = signal('');
  showPassword = signal(false);
  pageReady = signal(false);

  // Services
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastMessageService);
  private elementRef = inject(ElementRef);
  private ngZone = inject(NgZone);

  // Lifecycle hooks
  ngOnInit() {
    this.initializeForm();
    this.checkReturnUrl();
    this.checkSessionExpired();
  }

  ngAfterViewInit() {
    // Trigger animation sequence - logo stays centered for 1 second
    setTimeout(() => {
      this.pageReady.set(true);
      // Auto-focus email input after animation
      setTimeout(() => {
        this.usernameInput()?.nativeElement.focus();
      }, 600);
      // Initialize Google Sign-In after page is ready
      this.initGoogleSignIn();
    }, 1000);
  }

  private initGoogleSignIn(): void {
    if (!environment.googleClientId) {
      console.warn('Google Client ID not configured');
      return;
    }

    // Wait for Google API to load
    const checkGoogle = setInterval(() => {
      if (typeof google !== 'undefined' && google.accounts) {
        clearInterval(checkGoogle);
        google.accounts.id.initialize({
          client_id: environment.googleClientId,
          callback: (response: any) => this.handleGoogleCallback(response),
          auto_select: false,
          cancel_on_tap_outside: true
        });

        // Render the button
        const buttonElement = document.getElementById('google-signin-btn');
        if (buttonElement) {
          google.accounts.id.renderButton(buttonElement, {
            theme: 'outline',
            size: 'large',
            width: '100%',
            text: 'signin_with',
            shape: 'pill',
            logo_alignment: 'center'
          });
        }
      }
    }, 100);

    // Clear interval after 5 seconds if Google doesn't load
    setTimeout(() => clearInterval(checkGoogle), 5000);
  }

  private handleGoogleCallback(response: any): void {
    if (response.credential) {
      this.ngZone.run(() => {
        this.googleLoading.set(true);
        this.authService.googleAuth(response.credential)
          .pipe(finalize(() => this.googleLoading.set(false)))
          .subscribe({
            next: (authResponse) => {
              if (authResponse.is_new_user || !authResponse.profile_complete) {
                // New user or incomplete profile - redirect to complete registration
                // No success toast here - user still needs to complete their profile
                this.router.navigate([ROUTES.REGISTER], { queryParams: { fromGoogle: 'true' } });
              } else {
                // Existing user with complete profile
                this.toast.showSuccess('auth.login_success');
                this.handleSuccessfulLogin(authResponse.user);
              }
            },
            error: (error) => {
              this.toast.showApiError(error, 'auth.login_failed');
            }
          });
      });
    }
  }

  private handleSuccessfulLogin(user: any): void {
    let targetUrl: string = this.returnUrl();

    if (this.returnUrl() === ROUTES.HOME && user.role === UserRole.STAFF) {
      targetUrl = DefaultRedirects.STAFF_DEFAULT;
    } else if (this.returnUrl() === ROUTES.HOME && user.role === UserRole.ADMIN) {
      targetUrl = DefaultRedirects.ADMIN_DEFAULT;
    }

    setTimeout(() => {
      this.router.navigate([targetUrl]);
    }, UI_DELAY.TOAST_BEFORE_NAVIGATE);
  }

  // Getters
  get f() { return this.loginForm.controls; }

  // Public methods
  onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.authService.login(this.loginForm.value)
      .pipe(
        finalize(() => {
          setTimeout(() => this.loading.set(false), ANIMATION.VERY_SLOW);
        })
      )
      .subscribe({
        next: (user) => {
          this.toast.showSuccess('auth.login_success');
          this.handleSuccessfulLogin(user);
        },
        error: (error) => {
          this.toast.showApiError(error, 'auth.login_failed');
        }
      });
  }

  // Input focus handling
  onInputFocus(fieldName: string): void {
    this.focusedField.set(fieldName);
  }

  onInputBlur(): void {
    this.focusedField.set('');
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  // Private methods
  private initializeForm(): void {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  private checkReturnUrl(): void {
    this.returnUrl.set(this.route.snapshot.queryParams['returnUrl'] || ROUTES.HOME);
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
