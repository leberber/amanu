import { Component, OnInit, inject, ElementRef, signal, viewChild, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { User, UserRole } from '../../models/user.model';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { StorageService } from '../../core/services/storage.service';
import { ANIMATION, UI_DELAY, UI } from '../../core/constants/ui.constants';
import { ROUTES, DefaultRedirects } from '../../core/constants/routes.constants';
import { GoogleSignInButtonComponent } from '../../shared/components/google-signin-button/google-signin-button.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ToastModule,
    RouterLink,
    TranslateModule,
    GoogleSignInButtonComponent
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  // ViewChild
  usernameInput = viewChild<ElementRef<HTMLInputElement>>('usernameInput');
  googleButton = viewChild<GoogleSignInButtonComponent>('googleButton');

  // State signals
  loginForm!: FormGroup;
  loading = signal(false);
  returnUrl = signal<string>(ROUTES.HOME);
  focusedField = signal('');
  showPassword = signal(false);
  pageReady = signal(false);

  // Constants
  readonly ROUTES = ROUTES;

  // Services
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastMessageService);
  private storage = inject(StorageService);
  private ngZone = inject(NgZone);

  // Lifecycle hooks
  ngOnInit() {
    this.initializeForm();
    this.checkReturnUrl();
    this.checkSessionExpired();

    // Trigger animation sequence - logo stays centered for 1 second
    setTimeout(() => {
      this.pageReady.set(true);
      // Auto-focus email input after animation
      setTimeout(() => {
        this.usernameInput()?.nativeElement.focus();
      }, ANIMATION.SLOW + UI.FOCUS_DELAY);
    }, ANIMATION.VERY_SLOW);
  }

  onGoogleCredential(credential: string): void {
    this.ngZone.run(() => {
      this.googleButton()?.setLoading(true);
      this.authService.googleAuth(credential)
        .pipe(finalize(() => this.googleButton()?.setLoading(false)))
        .subscribe({
          next: (authResponse) => {
            if (authResponse.is_new_user || !authResponse.profile_complete) {
              // New user or incomplete profile - redirect to complete registration
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

  private handleSuccessfulLogin(user: User): void {
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

    // Pre-fill email if passed from registration
    const email = this.route.snapshot.queryParams['email'];
    if (email) {
      this.loginForm.patchValue({ username: email });
    }
  }

  private checkSessionExpired(): void {
    if (this.storage.isSessionExpired()) {
      this.storage.clearSessionExpired();
      setTimeout(() => {
        this.toast.showSessionExpired();
      }, ANIMATION.NORMAL);
    }
  }
}
