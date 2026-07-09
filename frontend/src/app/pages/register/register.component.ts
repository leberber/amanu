import { Component, inject, OnInit, OnDestroy, AfterViewInit, DestroyRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { UserRole, AuthProvider } from '../../models/user.model';
import { DriverService } from '../../driver/services/driver.service';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { ROUTES } from '../../core/constants/routes.constants';
import { normalizeAlgerianPhone } from '../../core/utils/format.util';
import { ANIMATION } from '../../core/constants/ui.constants';
import { InactiveUserMessageComponent } from '../../components/inactive-user-message/inactive-user-message.component';

import { RegisterStateService, RegistrationType } from './register-state.service';
import {
  TypeChoiceStepComponent,
  PersonalInfoStepComponent,
  EmailVerificationStepComponent,
  PasswordStepComponent,
  LocationMapStepComponent,
  StoreDetailsStepComponent,
  VehicleDetailsStepComponent,
  ConfirmationStepComponent,
  NotificationsStepComponent
} from './steps';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    InactiveUserMessageComponent,
    TypeChoiceStepComponent,
    PersonalInfoStepComponent,
    EmailVerificationStepComponent,
    PasswordStepComponent,
    LocationMapStepComponent,
    StoreDetailsStepComponent,
    VehicleDetailsStepComponent,
    ConfirmationStepComponent,
    NotificationsStepComponent
  ],
  providers: [RegisterStateService],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent implements OnInit, OnDestroy, AfterViewInit {
  state = inject(RegisterStateService);
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private driverService = inject(DriverService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastMessageService);
  private destroyRef = inject(DestroyRef);
  private ngZone = inject(NgZone);

  private resendTimer: ReturnType<typeof setInterval> | null = null;

  readonly ROUTES = ROUTES;

  ngOnInit(): void {
    this.state.loadWilayaData();
    this.state.loadSegments();

    // Check for Google OAuth flow
    const isFromGoogle = this.route.snapshot.queryParams['fromGoogle'] === 'true';

    if (isFromGoogle) {
      this.initGoogleFlow();
    } else if (this.state.stateRestored && this.state.activeStep() === 1) {
      this.startResendCountdown();
    }

    this.setupVisibilityListener();
  }

  ngAfterViewInit(): void {
    if (!this.state.stateRestored) {
      setTimeout(() => this.state.pageReady.set(true), ANIMATION.VERY_SLOW);
    }
  }

  ngOnDestroy(): void {
    if (this.resendTimer) {
      clearInterval(this.resendTimer);
    }
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  // Step navigation
  get stepDots(): number[] {
    // Google + Driver: Personal info → Vehicle → Confirmation
    if (this.state.fromGoogle() && this.state.isDriverMode()) return [0, 4, 5];
    // Google + Customer: Personal info → Location → Store → Confirmation
    if (this.state.fromGoogle()) return [0, 3, 4, 5];
    // Normal Driver: Personal info → Email → Password → Vehicle → Confirmation
    if (this.state.isDriverMode()) return [0, 1, 2, 4, 5];
    // Normal Customer: All steps
    return [0, 1, 2, 3, 4, 5];
  }

  onTypeSelected(type: RegistrationType): void {
    this.state.registrationType.set(type);
  }

  onBackToChoice(): void {
    this.state.registrationType.set(null);
  }

  nextStep(): void {
    const current = this.state.activeStep();

    // Google + Driver flow: Step 0 -> 4 (vehicle details)
    if (this.state.fromGoogle() && this.state.isDriverMode() && current === 0) {
      this.state.activeStep.set(4);
      return;
    }

    // Google + Customer flow: Step 0 -> 3 (map)
    if (this.state.fromGoogle() && current === 0) {
      this.state.activeStep.set(3);
      return;
    }

    // Normal flow: Step 0 -> 1 (send verification)
    if (current === 0) {
      this.sendVerificationCode();
      return;
    }

    // Driver flow: Step 2 -> 4 (skip map)
    if (this.state.isDriverMode() && current === 2) {
      this.state.activeStep.set(4);
      return;
    }

    this.state.activeStep.update(v => v + 1);
  }

  prevStep(): void {
    const current = this.state.activeStep();

    if (current === 0) return;

    // Google + Driver flow: 4 -> 0
    if (this.state.fromGoogle() && this.state.isDriverMode() && current === 4) {
      this.state.activeStep.set(0);
      return;
    }

    // Google + Customer flow: 3 -> 0
    if (this.state.fromGoogle() && current === 3) {
      this.state.activeStep.set(0);
      return;
    }

    // Normal Driver flow: 4 -> 2
    if (this.state.isDriverMode() && current === 4) {
      this.state.activeStep.set(2);
      return;
    }

    this.state.activeStep.update(v => v - 1);
  }

  goToStep(step: number): void {
    if (step <= this.state.activeStep() || this.canAccessStep(step)) {
      this.state.activeStep.set(step);
    }
  }

  canAccessStep(step: number): boolean {
    // Google + Driver flow
    if (this.state.fromGoogle() && this.state.isDriverMode()) {
      if (step === 0) return true;
      if (step === 1 || step === 2 || step === 3) return false;
      if (step === 4) return this.state.isPersonalInfoValid();
      if (step === 5) return this.state.isPersonalInfoValid() && this.state.isVehicleFormValid();
    }

    // Google + Customer flow
    if (this.state.fromGoogle()) {
      if (step === 0) return true;
      if (step === 1 || step === 2) return false;
      if (step === 3) return this.state.isPersonalInfoValid();
      if (step === 4) return this.state.isPersonalInfoValid() && this.state.locationSelected();
      if (step === 5) return this.state.isPersonalInfoValid() && this.state.locationSelected() && this.state.isStoreDetailsValid();
    }

    // Normal Driver flow
    if (this.state.isDriverMode()) {
      if (step === 0) return true;
      if (step === 1) return this.state.isPersonalInfoValid();
      if (step === 2) return this.state.isPersonalInfoValid() && this.state.emailVerified();
      if (step === 3) return false;
      if (step === 4) return this.state.isPersonalInfoValid() && this.state.emailVerified() && this.state.isPasswordValid();
      if (step === 5) return this.state.isPersonalInfoValid() && this.state.emailVerified() && this.state.isPasswordValid() && this.state.isVehicleFormValid();
    }

    // Customer flow
    if (step === 0) return true;
    if (step === 1) return this.state.isPersonalInfoValid();
    if (step === 2) return this.state.isPersonalInfoValid() && this.state.emailVerified();
    if (step === 3) return this.state.isPersonalInfoValid() && this.state.emailVerified() && this.state.isPasswordValid();
    if (step === 4) return this.state.isPersonalInfoValid() && this.state.emailVerified() && this.state.isPasswordValid() && this.state.locationSelected();
    if (step === 5) return this.state.isPersonalInfoValid() && this.state.emailVerified() && this.state.isPasswordValid() && this.state.locationSelected() && this.state.isStoreDetailsValid();

    return false;
  }

  onConfirmLocation(): void {
    if (this.state.locationSelected()) {
      this.autoPopulateStoreDetails();
      this.state.activeStep.set(4);
    }
  }

  onLocationError(errorType: string): void {
    const messageKey = this.getLocationErrorKey(errorType);
    this.toast.showWarn(messageKey);
  }

  // Email verification
  private sendVerificationCode(): void {
    const email = this.state.personalInfoForm.value.email;
    if (!email) return;

    this.state.verificationLoading.set(true);
    this.state.verificationError.set('');
    this.state.serverErrors.set({});

    this.authService.sendVerificationCode(email)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.state.verificationLoading.set(false);
          this.state.verificationSent.set(true);
          this.startResendCountdown();
          this.state.activeStep.set(1);
          this.state.saveState();
        },
        error: (error) => {
          this.state.verificationLoading.set(false);
          const detail = error.error?.detail;
          if (typeof detail === 'string') {
            this.state.serverErrors.set({ email: detail });
          } else {
            this.toast.showApiError(error, 'register.verification_send_failed');
          }
        }
      });
  }

  onVerifyCode(): void {
    const email = this.state.personalInfoForm.value.email;
    const code = this.state.verificationCode();

    if (!email || code.length !== 6) return;

    this.state.verificationLoading.set(true);
    this.state.verificationError.set('');

    this.authService.verifyEmail(email, code)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.state.verificationLoading.set(false);
          if (response.verified) {
            this.state.emailVerified.set(true);
            this.state.activeStep.set(2);
            this.state.saveState();
          }
        },
        error: (error) => {
          this.state.verificationLoading.set(false);
          const detail = error.error?.detail;
          if (typeof detail === 'string') {
            this.state.verificationError.set(detail);
          } else {
            this.toast.showApiError(error, 'register.verification_failed');
          }
        }
      });
  }

  onResendCode(): void {
    if (this.state.resendCountdown() > 0) return;

    const email = this.state.personalInfoForm.value.email;
    if (!email) return;

    this.state.verificationLoading.set(true);
    this.state.verificationError.set('');

    this.authService.sendVerificationCode(email)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.state.verificationLoading.set(false);
          this.startResendCountdown();
          this.toast.showSuccess('register.verification_code_resent');
        },
        error: (error) => {
          this.state.verificationLoading.set(false);
          this.toast.showApiError(error, 'register.verification_send_failed');
        }
      });
  }

  private startResendCountdown(): void {
    this.state.resendCountdown.set(60);
    if (this.resendTimer) clearInterval(this.resendTimer);

    this.resendTimer = setInterval(() => {
      if (this.state.resendCountdown() > 0) {
        this.state.resendCountdown.update(v => v - 1);
      } else if (this.resendTimer) {
        clearInterval(this.resendTimer);
        this.resendTimer = null;
      }
    }, 1000);
  }

  // Google OAuth
  onGoogleCredential(credential: string): void {
    this.ngZone.run(() => {
      this.authService.googleAuth(credential)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => {
            if (response.is_new_user || !response.profile_complete) {
              this.initGoogleFlow();
            } else {
              this.toast.showSuccess('auth.login_success');
              this.router.navigate([ROUTES.HOME]);
            }
          },
          error: (error) => {
            this.toast.showApiError(error, 'auth.login_failed');
          }
        });
    });
  }

  private initGoogleFlow(): void {
    const user = this.authService.currentUserValue;
    if (!user || user.auth_provider !== AuthProvider.GOOGLE) {
      this.router.navigate([ROUTES.LOGIN]);
      return;
    }

    this.state.fromGoogle.set(true);
    this.state.personalInfoForm.patchValue({
      full_name: user.full_name || '',
      email: user.email || '',
      phone: ''
    });
    this.state.emailVerified.set(true);
    this.state.verificationSent.set(true);
    this.state.activeStep.set(0);
  }

  // Final submission
  onRegister(): void {
    // Google + Driver: Convert Google user to driver
    if (this.state.fromGoogle() && this.state.isDriverMode()) {
      this.submitGoogleDriverRegistration();
      return;
    }

    // Google + Customer: Update profile
    if (this.state.fromGoogle()) {
      this.submitGoogleProfileUpdate();
      return;
    }

    // Normal Driver
    if (this.state.isDriverMode()) {
      this.submitDriverRegistration();
      return;
    }

    // Normal Customer
    this.submitCustomerRegistration();
  }

  private submitCustomerRegistration(): void {
    this.state.loading.set(true);
    const storeDetails = this.state.storeDetailsForm.getRawValue();
    const location = this.state.locationData();

    const registerData = {
      full_name: this.state.personalInfoForm.value.full_name,
      email: this.state.personalInfoForm.value.email,
      phone: normalizeAlgerianPhone(this.state.personalInfoForm.value.phone || ''),
      password: this.state.passwordForm.value.password,
      address: location?.address || '',
      latitude: location?.latitude,
      longitude: location?.longitude,
      store_name: storeDetails.store_name || null,
      segment_id: storeDetails.segment_id || null,
      wilaya: storeDetails.wilaya,
      daira: storeDetails.daira,
      commune: storeDetails.commune,
      role: UserRole.CUSTOMER
    };

    this.authService.register(registerData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.autoLoginAfterRegister(),
        error: (error) => {
          this.state.loading.set(false);
          this.handleServerError(error);
        }
      });
  }

  private submitDriverRegistration(): void {
    this.state.loading.set(true);
    const vehicleData = this.state.vehicleForm.value;

    const driverData = {
      email: this.state.personalInfoForm.value.email,
      full_name: this.state.personalInfoForm.value.full_name,
      phone: this.state.personalInfoForm.value.phone,
      password: this.state.passwordForm.value.password,
      vehicle_type: vehicleData.vehicle_type,
      capacity_kg: vehicleData.capacity_kg || null,
      capacity_volume: vehicleData.capacity_volume || null
    };

    this.driverService.register(driverData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.state.loading.set(false);
          this.state.clearSavedState();
          this.state.activeStep.set(6);
        },
        error: (error) => {
          this.state.loading.set(false);
          this.handleServerError(error);
        }
      });
  }

  private submitGoogleDriverRegistration(): void {
    this.state.loading.set(true);
    const vehicleData = this.state.vehicleForm.value;

    const driverData = {
      full_name: this.state.personalInfoForm.value.full_name,
      phone: this.state.personalInfoForm.value.phone,
      vehicle_type: vehicleData.vehicle_type,
      capacity_kg: vehicleData.capacity_kg || null,
      capacity_volume: vehicleData.capacity_volume || null
    };

    this.driverService.convertToDriver(driverData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.state.loading.set(false);
          this.state.clearSavedState();
          this.state.activeStep.set(6);
        },
        error: (error) => {
          this.state.loading.set(false);
          this.handleServerError(error);
        }
      });
  }

  private submitGoogleProfileUpdate(): void {
    this.state.loading.set(true);
    const storeDetails = this.state.storeDetailsForm.getRawValue();
    const location = this.state.locationData();

    const profileData = {
      full_name: this.state.personalInfoForm.value.full_name,
      phone: this.state.personalInfoForm.value.phone,
      address: location?.address || '',
      latitude: location?.latitude,
      longitude: location?.longitude,
      store_name: storeDetails.store_name || null,
      segment_id: storeDetails.segment_id || null,
      wilaya: storeDetails.wilaya,
      daira: storeDetails.daira,
      commune: storeDetails.commune
    };

    this.userService.updateProfile(profileData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updatedUser) => {
          this.state.loading.set(false);
          this.state.clearSavedState();
          this.authService.updateCurrentUser(updatedUser);
          this.state.activeStep.set(6);
        },
        error: (error) => {
          this.state.loading.set(false);
          this.toast.showApiError(error, 'account.profile_update_failed');
        }
      });
  }

  private autoLoginAfterRegister(): void {
    this.authService.login({
      username: this.state.personalInfoForm.value.email,
      password: this.state.passwordForm.value.password
    }).subscribe({
      next: () => {
        this.state.loading.set(false);
        this.state.clearSavedState();
        this.state.activeStep.set(6);
      },
      error: () => {
        this.state.loading.set(false);
        this.state.clearSavedState();
        this.state.activeStep.set(6);
      }
    });
  }

  goToHome(): void {
    this.router.navigate([ROUTES.HOME]);
  }

  // Helpers
  private autoPopulateStoreDetails(): void {
    const location = this.state.locationData();
    if (!location?.wilaya) return;

    const matchedWilaya = this.findMatch(this.state.wilayas(), location.wilaya);
    if (matchedWilaya) {
      this.state.storeDetailsForm.patchValue({ wilaya: matchedWilaya });
      this.state.updateDairas(matchedWilaya);

      setTimeout(() => {
        if (location.daira) {
          const matchedDaira = this.findMatch(this.state.dairas(), location.daira);
          if (matchedDaira) {
            this.state.storeDetailsForm.patchValue({ daira: matchedDaira });
            this.state.updateCommunes(matchedDaira);

            setTimeout(() => {
              if (location.commune) {
                const matchedCommune = this.findMatch(this.state.communes(), location.commune);
                if (matchedCommune) {
                  this.state.storeDetailsForm.patchValue({ commune: matchedCommune });
                }
              }
            }, 100);
          }
        }
      }, 100);
    }
  }

  private findMatch(options: { label: string; value: string }[], search: string): string | null {
    if (!search || !options.length) return null;

    const normalized = this.normalize(search);
    const match = options.find(opt =>
      this.normalize(opt.value) === normalized ||
      this.normalize(opt.label) === normalized ||
      this.normalize(opt.value).includes(normalized) ||
      normalized.includes(this.normalize(opt.value))
    );

    return match?.value || null;
  }

  private normalize(str: string): string {
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_]/g, ' ').trim();
  }

  private handleServerError(error: { error?: { detail?: string | { msg?: string }[] } }): void {
    const detail = error.error?.detail;
    let message = '';
    let original = '';

    if (typeof detail === 'string') {
      message = detail.toLowerCase();
      original = detail;
    } else if (Array.isArray(detail) && detail.length > 0) {
      message = (detail[0]?.msg || '').toLowerCase();
      original = detail[0]?.msg || '';
    }

    this.state.serverErrors.set({});

    if (message.includes('email')) {
      this.state.serverErrors.set({ email: original });
      this.goToStep(0);
      return;
    }

    if (message.includes('phone')) {
      this.state.serverErrors.set({ phone: original });
      this.goToStep(0);
      return;
    }

    if (message.includes('password')) {
      this.state.serverErrors.set({ password: original });
      this.goToStep(2);
      return;
    }

    this.toast.showApiError(error, 'auth.register_failed');
  }

  private getLocationErrorKey(errorType: string): string {
    switch (errorType) {
      case 'permission_denied': return 'register.location_permission_denied';
      case 'position_unavailable': return 'register.location_unavailable';
      case 'timeout': return 'register.location_timeout';
      case 'geolocation_not_supported': return 'register.geolocation_not_supported';
      default: return 'register.location_error';
    }
  }

  private setupVisibilityListener(): void {
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  private onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      this.state.saveState();
    }
  };
}
