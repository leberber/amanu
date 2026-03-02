import { Component, inject, ViewChild, ElementRef, OnInit, OnDestroy, AfterViewInit, DestroyRef, signal, computed, viewChild, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToastModule } from 'primeng/toast';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { UserRole, AuthProvider } from '../../models/user.model';
import { MapPickerComponent, LocationData } from '../../shared/components/map-picker/map-picker.component';
import { VALIDATION, UI_DELAY } from '../../core/constants/app.constants';
import { FormBuilderService } from '../../core/services/form-builder.service';
import { PhoneFormatDirective } from '../../directives/phone-format.directive';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { ROUTES } from '../../core/constants/routes.constants';
import { InactiveUserMessageComponent } from '../../components/inactive-user-message/inactive-user-message.component';
import { GoogleSignInButtonComponent } from '../../shared/components/google-signin-button/google-signin-button.component';
import { finalize } from 'rxjs';

// Interfaces for wilaya data
interface Commune {
  code: number;
  name: string;
}

interface Daira {
  daira_name: string;
  daira_code: number;
  communes: Commune[];
}

interface WilayaData {
  wilaya: string;
  wilaya_code: number;
  dairas: Daira[];
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ToastModule,
    InputTextModule,
    SelectModule,
    RouterLink,
    TranslateModule,
    MapPickerComponent,
    PhoneFormatDirective,
    InactiveUserMessageComponent,
    GoogleSignInButtonComponent
  ],
    templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild(MapPickerComponent) mapPicker!: MapPickerComponent;
  googleButton = viewChild<GoogleSignInButtonComponent>('googleButton');

  // State signals
  loading = signal(false);
  activeStep = signal(0);
  focusedField = signal('');
  isInputFocused = signal(false);
  pageReady = signal(false);
  showPassword = signal(false);
  showConfirmPassword = signal(false);

  // Form validity signals (synced via statusChanges)
  personalInfoValid = signal(false);
  passwordFormValid = signal(false);
  storeDetailsValid = signal(false);
  locationSelected = signal(false);

  // Email verification state
  verificationCode = signal('');
  verificationSent = signal(false);
  verificationLoading = signal(false);
  emailVerified = signal(false);
  verificationError = signal('');
  resendCountdown = signal(0);
  private resendTimer: ReturnType<typeof setInterval> | null = null;

  // Server-side field errors
  serverErrors = signal<{ [key: string]: string }>({});

  // Form groups for each step
  personalInfoForm: FormGroup;
  passwordForm: FormGroup;
  storeDetailsForm: FormGroup;

  // Location data from map
  locationData?: LocationData;

  // Wilaya data
  wilayaDataList: WilayaData[] = [];
  wilayas: { label: string; value: string }[] = [];
  dairas: { label: string; value: string }[] = [];
  communes: { label: string; value: string }[] = [];

  // Google OAuth flow
  fromGoogle = signal(false);

  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);
  private ngZone = inject(NgZone);

  // Services
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastMessageService);
  private fb = inject(FormBuilder);
  private elementRef = inject(ElementRef);

  constructor() {
    // Step 1: Personal Info (with test defaults for development)
    this.personalInfoForm = this.fb.group({
      full_name: ['Test User', [Validators.required, Validators.minLength(VALIDATION.MIN_NAME_LENGTH)]],
      email: ['test@example.com', [Validators.required, Validators.email]],
      phone: ['0555 12 34 56', [Validators.required]]
    });

    // Step 2: Password (with test defaults for development)
    this.passwordForm = this.fb.group({
      password: ['Test1234', [Validators.required, Validators.minLength(VALIDATION.MIN_PASSWORD_LENGTH)]],
      confirmPassword: ['Test1234', [Validators.required]]
    }, { validators: FormBuilderService.createPasswordMatchValidator('password', 'confirmPassword') });

    // Step 4: Store Details (after map)
    this.storeDetailsForm = this.fb.group({
      phone: [''], // Required for Google users, will be validated conditionally
      store_name: [''],
      wilaya: ['', Validators.required],
      daira: [{ value: '', disabled: true }, Validators.required],
      commune: [{ value: '', disabled: true }, Validators.required]
    });
  }

  ngOnInit() {
    this.loadWilayaData();
    this.setupFormSubscriptions();
    this.setupFormValiditySignals();

    // Check for Google OAuth flow
    const isFromGoogle = this.route.snapshot.queryParams['fromGoogle'] === 'true';
    if (isFromGoogle) {
      this.initGoogleFlow();
    } else {
      // Set initial validity for pre-filled forms (development defaults)
      this.personalInfoValid.set(this.personalInfoForm.valid);
      this.passwordFormValid.set(this.passwordForm.valid);
    }
  }

  private initGoogleFlow(): void {
    const user = this.authService.currentUserValue;
    if (!user || user.auth_provider !== AuthProvider.GOOGLE) {
      // Not a Google user or not logged in, redirect to login
      this.router.navigate([ROUTES.LOGIN]);
      return;
    }

    this.fromGoogle.set(true);

    // Pre-fill personal info from Google user data
    // Name is editable, email is read-only, phone is empty for user to enter
    this.personalInfoForm.patchValue({
      full_name: user.full_name || '',
      email: user.email || '',
      phone: '' // User must enter phone
    });

    // Mark email as verified (Google handles this)
    this.emailVerified.set(true);
    this.verificationSent.set(true);
    // Mark password as valid (not needed for OAuth users)
    this.passwordFormValid.set(true);

    // Start at step 0 (personal info) - user needs to enter phone
    this.activeStep.set(0);
  }

  ngAfterViewInit() {
    // Trigger animation sequence - logo starts centered then moves to top
    setTimeout(() => {
      this.pageReady.set(true);
    }, 1000);
  }

  onGoogleCredential(credential: string): void {
    this.ngZone.run(() => {
      this.googleButton()?.setLoading(true);
      this.authService.googleAuth(credential)
        .pipe(finalize(() => this.googleButton()?.setLoading(false)))
        .subscribe({
          next: (authResponse) => {
            if (authResponse.is_new_user || !authResponse.profile_complete) {
              // New user - stay on registration to complete profile
              this.initGoogleFlow();
            } else {
              // Existing user with complete profile - go to home
              this.toast.showSuccess('auth.login_success');
              this.router.navigate(['/']);
            }
          },
          error: (error) => {
            this.toast.showApiError(error, 'auth.login_failed');
          }
        });
    });
  }

  private setupFormValiditySignals(): void {
    // Sync form validity to signals via statusChanges
    this.personalInfoForm.statusChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.personalInfoValid.set(this.personalInfoForm.valid));

    this.passwordForm.statusChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.passwordFormValid.set(this.passwordForm.valid));

    this.storeDetailsForm.statusChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.storeDetailsValid.set(this.canProceedStep4()));

    // Also update on value changes for store details (since disabled fields don't trigger status)
    this.storeDetailsForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.storeDetailsValid.set(this.canProceedStep4()));
  }

  private loadWilayaData() {
    this.http.get<WilayaData>('assets/tizi_ouzou_wilaya_full.json').subscribe({
      next: (data) => {
        this.wilayaDataList = [data];
        this.wilayas = this.wilayaDataList.map(w => ({
          label: w.wilaya,
          value: w.wilaya
        }));

        // Set test defaults after data loads
        this.setTestLocationDefaults();
      },
      error: () => {
        this.toast.showError('register.wilaya_load_failed');
      }
    });
  }

  private setTestLocationDefaults(): void {
    // Set default wilaya (triggers daira options via valueChanges subscription)
    const defaultWilaya = this.wilayas[0]?.value;
    if (defaultWilaya) {
      this.storeDetailsForm.patchValue({ wilaya: defaultWilaya });

      // Wait for dairas to populate, then set default daira
      setTimeout(() => {
        const defaultDaira = this.dairas[0]?.value;
        if (defaultDaira) {
          this.storeDetailsForm.patchValue({ daira: defaultDaira });

          // Wait for communes to populate, then set default commune
          setTimeout(() => {
            const defaultCommune = this.communes[0]?.value;
            if (defaultCommune) {
              this.storeDetailsForm.patchValue({ commune: defaultCommune });
              // Update validity signal after all defaults are set
              this.storeDetailsValid.set(this.canProceedStep4());
            }
          }, 50);
        }
      }, 50);
    }
  }

  private setupFormSubscriptions() {
    const dairaControl = this.storeDetailsForm.get('daira');
    const communeControl = this.storeDetailsForm.get('commune');

    // Listen for wilaya changes - properly cleaned up on destroy
    this.storeDetailsForm.get('wilaya')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(selectedWilaya => {
        // Reset and disable dependent fields
        dairaControl?.setValue('', { emitEvent: false });
        communeControl?.setValue('', { emitEvent: false });
        this.communes = [];

        const wilayaData = this.wilayaDataList.find(w => w.wilaya === selectedWilaya);
        if (wilayaData && selectedWilaya) {
          this.dairas = wilayaData.dairas.map(d => ({
            label: d.daira_name,
            value: d.daira_name
          }));
          dairaControl?.enable({ emitEvent: false });
        } else {
          this.dairas = [];
          dairaControl?.disable({ emitEvent: false });
        }
        communeControl?.disable({ emitEvent: false });
      });

    // Listen for daira changes - properly cleaned up on destroy
    dairaControl?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(selectedDaira => {
        communeControl?.setValue('', { emitEvent: false });

        const selectedWilaya = this.storeDetailsForm.get('wilaya')?.value;
        const wilayaData = this.wilayaDataList.find(w => w.wilaya === selectedWilaya);
        if (wilayaData && selectedDaira) {
          const dairaData = wilayaData.dairas.find(d => d.daira_name === selectedDaira);
          if (dairaData) {
            this.communes = dairaData.communes.map(c => ({
              label: c.name,
              value: c.name
            }));
            communeControl?.enable({ emitEvent: false });
          } else {
            this.communes = [];
            communeControl?.disable({ emitEvent: false });
          }
        } else {
          this.communes = [];
          communeControl?.disable({ emitEvent: false });
        }
      });
  }

  ngOnDestroy(): void {
    // Subscriptions are automatically cleaned up by takeUntilDestroyed
    if (this.resendTimer) {
      clearInterval(this.resendTimer);
    }
  }

  onLocationSelected(location: LocationData) {
    this.locationData = location;
    this.locationSelected.set(true);

    // Auto-populate store details from geocoder data and then move to next step
    this.autoPopulateStoreDetails(location);
  }

  private autoPopulateStoreDetails(location: LocationData) {
    // Try to match wilaya from geocoder with available wilayas
    if (location.wilaya) {
      const matchedWilaya = this.findMatchingOption(this.wilayas, location.wilaya);
      if (matchedWilaya) {
        this.storeDetailsForm.patchValue({ wilaya: matchedWilaya }, { emitEvent: true });

        // Wait for dairas to load, then try to match daira
        setTimeout(() => {
          if (location.daira && this.dairas.length > 0) {
            const matchedDaira = this.findMatchingOption(this.dairas, location.daira);
            if (matchedDaira) {
              this.storeDetailsForm.patchValue({ daira: matchedDaira }, { emitEvent: true });

              // Wait for communes to load, then try to match commune
              setTimeout(() => {
                if (location.commune && this.communes.length > 0) {
                  const matchedCommune = this.findMatchingOption(this.communes, location.commune);
                  if (matchedCommune) {
                    this.storeDetailsForm.patchValue({ commune: matchedCommune }, { emitEvent: false });
                  }
                }
                // Update validity after populating (no auto-advance)
                this.storeDetailsValid.set(this.canProceedStep4());
              }, 150);
            } else {
              this.storeDetailsValid.set(this.canProceedStep4());
            }
          } else {
            this.storeDetailsValid.set(this.canProceedStep4());
          }
        }, 150);
      } else {
        this.storeDetailsValid.set(this.canProceedStep4());
      }
    } else {
      this.storeDetailsValid.set(this.canProceedStep4());
    }
  }

  confirmLocation(): void {
    if (this.activeStep() === 3 && this.locationSelected()) {
      this.activeStep.set(4);
      this.onStepChange();
    }
  }

  private findMatchingOption(options: { label: string; value: string }[], searchValue: string): string | null {
    if (!searchValue || !options.length) return null;

    const normalizedSearch = this.normalizeString(searchValue);

    // Try exact match first
    const exactMatch = options.find(opt =>
      this.normalizeString(opt.value) === normalizedSearch ||
      this.normalizeString(opt.label) === normalizedSearch
    );
    if (exactMatch) return exactMatch.value;

    // Try partial match (contains)
    const partialMatch = options.find(opt =>
      this.normalizeString(opt.value).includes(normalizedSearch) ||
      this.normalizeString(opt.label).includes(normalizedSearch) ||
      normalizedSearch.includes(this.normalizeString(opt.value)) ||
      normalizedSearch.includes(this.normalizeString(opt.label))
    );
    if (partialMatch) return partialMatch.value;

    return null;
  }

  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[-_]/g, ' ')
      .trim();
  }

  onLocationError(errorType: string) {
    let messageKey = 'register.location_error';
    switch (errorType) {
      case 'permission_denied':
        messageKey = 'register.location_permission_denied';
        break;
      case 'position_unavailable':
        messageKey = 'register.location_unavailable';
        break;
      case 'timeout':
        messageKey = 'register.location_timeout';
        break;
      case 'geolocation_not_supported':
        messageKey = 'register.geolocation_not_supported';
        break;
    }
    this.toast.showWarn(messageKey);
  }

  // Email verification methods
  sendVerificationCode(): void {
    const email = this.personalInfoForm.value.email;
    if (!email) return;

    this.verificationLoading.set(true);
    this.verificationError.set('');
    this.serverErrors.set({});

    this.authService.sendVerificationCode(email)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.verificationLoading.set(false);
          this.verificationSent.set(true);
          this.startResendCountdown();
          this.activeStep.set(1); // Move to verification step
        },
        error: (error) => {
          this.verificationLoading.set(false);
          const errorDetail = error.error?.detail;
          if (typeof errorDetail === 'string') {
            // Show email-related errors on step 0
            this.serverErrors.set({ email: errorDetail });
          } else {
            this.toast.showApiError(error, 'register.verification_send_failed');
          }
        }
      });
  }

  resendVerificationCode(): void {
    if (this.resendCountdown() > 0) return;

    const email = this.personalInfoForm.value.email;
    if (!email) return;

    this.verificationLoading.set(true);
    this.verificationError.set('');

    this.authService.sendVerificationCode(email)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.verificationLoading.set(false);
          this.startResendCountdown();
          this.toast.showSuccess('register.verification_code_resent');
        },
        error: (error) => {
          this.verificationLoading.set(false);
          this.toast.showApiError(error, 'register.verification_send_failed');
        }
      });
  }

  private startResendCountdown(): void {
    this.resendCountdown.set(60);
    if (this.resendTimer) {
      clearInterval(this.resendTimer);
    }
    this.resendTimer = setInterval(() => {
      if (this.resendCountdown() > 0) {
        this.resendCountdown.update(v => v - 1);
      } else if (this.resendTimer) {
        clearInterval(this.resendTimer);
        this.resendTimer = null;
      }
    }, 1000);
  }

  verifyEmailCode(): void {
    const email = this.personalInfoForm.value.email;
    const code = this.verificationCode();

    if (!email || code.length !== 6) return;

    this.verificationLoading.set(true);
    this.verificationError.set('');

    this.authService.verifyEmail(email, code)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.verificationLoading.set(false);
          if (response.verified) {
            this.emailVerified.set(true);
            this.activeStep.set(2); // Move to password step
          }
        },
        error: (error) => {
          this.verificationLoading.set(false);
          const errorDetail = error.error?.detail;
          if (typeof errorDetail === 'string') {
            this.verificationError.set(errorDetail);
          } else {
            this.toast.showApiError(error, 'register.verification_failed');
          }
        }
      });
  }

  onCodeInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/[^0-9]/g, '');
    input.value = value;

    // Update the verification code
    const currentCode = this.verificationCode().split('');
    while (currentCode.length < 6) currentCode.push('');
    currentCode[index] = value;
    this.verificationCode.set(currentCode.join(''));
    this.verificationError.set('');

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = this.elementRef.nativeElement.querySelector(
        `.code-input:nth-child(${index + 2}) input`
      ) as HTMLInputElement;
      if (nextInput) nextInput.focus();
    }
  }

  onCodeKeydown(event: KeyboardEvent, index: number): void {
    const input = event.target as HTMLInputElement;

    if (event.key === 'Backspace' && !input.value && index > 0) {
      const prevInput = this.elementRef.nativeElement.querySelector(
        `.code-input:nth-child(${index}) input`
      ) as HTMLInputElement;
      if (prevInput) {
        prevInput.focus();
        prevInput.value = '';
        const currentCode = this.verificationCode().split('');
        currentCode[index - 1] = '';
        this.verificationCode.set(currentCode.join(''));
      }
    }
  }

  onCodePaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedData = event.clipboardData?.getData('text') || '';
    const digits = pastedData.replace(/[^0-9]/g, '').slice(0, 6);

    if (digits) {
      this.verificationCode.set(digits.padEnd(6, ''));

      // Fill all inputs
      const inputs = this.elementRef.nativeElement.querySelectorAll('.code-input input');
      inputs.forEach((input: HTMLInputElement, i: number) => {
        input.value = digits[i] || '';
      });

      // Focus appropriate input
      const focusIndex = Math.min(digits.length, 5);
      (inputs[focusIndex] as HTMLInputElement)?.focus();
    }
  }

  // Step navigation (Step indices: 0=Personal, 1=Verification, 2=Password, 3=Map, 4=Store, 5=Confirmation, 6=Success)
  canProceedStep0(): boolean {
    return this.personalInfoForm.valid;
  }

  canProceedStep1(): boolean {
    return this.emailVerified();
  }

  canProceedStep2(): boolean {
    return this.passwordForm.valid;
  }

  canProceedStep3(): boolean {
    return this.locationSelected();
  }

  canProceedStep4(): boolean {
    // Check all required fields have values (using getRawValue to include disabled controls)
    const values = this.storeDetailsForm.getRawValue();
    return !!(values.wilaya && values.daira && values.commune);
  }

  // Computed signal for canProceedCurrentStep (uses validity signals)
  canProceedCurrentStep = computed(() => {
    switch (this.activeStep()) {
      case 0:
        return this.personalInfoValid();
      case 1:
        return this.emailVerified();
      case 2:
        return this.passwordFormValid();
      case 3:
        return this.locationSelected();
      case 4:
        return this.storeDetailsValid();
      default:
        return true;
    }
  });

  // Check if a specific step can be accessed (all previous steps must be valid)
  canAccessStep(step: number): boolean {
    // Google flow: step 0 -> skip 1,2 -> steps 3,4,5
    if (this.fromGoogle()) {
      if (step === 0) return true;
      if (step === 1 || step === 2) return false; // Skip verification and password
      if (step === 3) return this.canProceedStep0();
      if (step === 4) return this.canProceedStep0() && this.canProceedStep3();
      if (step === 5) return this.canProceedStep0() && this.canProceedStep3() && this.canProceedStep4();
      return false;
    }

    // Normal registration flow
    if (step === 0) return true;
    if (step === 1) return this.canProceedStep0();
    if (step === 2) return this.canProceedStep0() && this.canProceedStep1();
    if (step === 3) return this.canProceedStep0() && this.canProceedStep1() && this.canProceedStep2();
    if (step === 4) return this.canProceedStep0() && this.canProceedStep1() && this.canProceedStep2() && this.canProceedStep3();
    if (step === 5) return this.canProceedStep0() && this.canProceedStep1() && this.canProceedStep2() && this.canProceedStep3() && this.canProceedStep4();
    return false;
  }

  goToStep(step: number) {
    // Only allow going to steps that are accessible (previous steps completed)
    // Or going back to previous steps
    if (step <= this.activeStep() || this.canAccessStep(step)) {
      this.activeStep.set(step);
      this.onStepChange();
    }
  }

  nextStep() {
    // Only proceed if current step is valid
    if (this.activeStep() < 5 && this.canProceedCurrentStep()) {
      // Google flow: Step 0 -> 3 (skip verification and password)
      if (this.fromGoogle() && this.activeStep() === 0) {
        this.activeStep.set(3);
        this.onStepChange();
        return;
      }

      // Normal flow: Step 0 -> 1: Send verification code
      if (this.activeStep() === 0) {
        this.sendVerificationCode();
        return;
      }
      this.activeStep.update(v => v + 1);
      this.onStepChange();
    }
  }

  private onStepChange() {
    // Invalidate map size when entering map step (step 3)
    if (this.activeStep() === 3 && this.mapPicker) {
      setTimeout(() => {
        // Map will show "Use My Location" button for user to click
      }, 300);
    }
  }

  prevStep() {
    if (this.activeStep() === 0) return;

    // Google flow: from step 3 go back to step 0 (skip 1,2)
    if (this.fromGoogle() && this.activeStep() === 3) {
      this.activeStep.set(0);
      return;
    }

    this.activeStep.update(v => v - 1);
  }

  // Final submission
  onRegister() {
    // Mark all fields as touched to show validation errors
    this.storeDetailsForm.markAllAsTouched();

    // Google flow: only validate steps 3-4
    if (this.fromGoogle()) {
      if (!this.canProceedStep3()) {
        this.toast.showWarn('register.select_location');
        this.goToStep(3);
        return;
      }

      if (!this.canProceedStep4()) {
        this.toast.showWarn('register.complete_store_details');
        this.goToStep(4);
        return;
      }

      this.submitGoogleProfileUpdate();
      return;
    }

    // Normal registration flow
    this.personalInfoForm.markAllAsTouched();
    this.passwordForm.markAllAsTouched();

    // Check if all steps are valid
    if (!this.canProceedStep0()) {
      this.toast.showWarn('register.complete_personal_info');
      this.goToStep(0);
      return;
    }

    if (!this.canProceedStep1()) {
      this.toast.showWarn('register.verify_email_first');
      this.goToStep(1);
      return;
    }

    if (!this.canProceedStep2()) {
      this.toast.showWarn('register.complete_password');
      this.goToStep(2);
      return;
    }

    if (!this.canProceedStep3()) {
      this.toast.showWarn('register.select_location');
      this.goToStep(3);
      return;
    }

    if (!this.canProceedStep4()) {
      this.toast.showWarn('register.complete_store_details');
      this.goToStep(4);
      return;
    }

    this.loading.set(true);

    const storeDetails = this.storeDetailsForm.getRawValue();
    const registerData = {
      full_name: this.personalInfoForm.value.full_name,
      email: this.personalInfoForm.value.email,
      phone: this.personalInfoForm.value.phone,
      password: this.passwordForm.value.password,
      address: this.locationData?.address || '',
      latitude: this.locationData?.latitude,
      longitude: this.locationData?.longitude,
      store_name: storeDetails.store_name || null,
      wilaya: storeDetails.wilaya,
      daira: storeDetails.daira,
      commune: storeDetails.commune,
      role: UserRole.CUSTOMER
    };

    this.authService.register(registerData)
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.activeStep.set(6); // Navigate to success screen
        },
        error: (error) => {
          this.loading.set(false);
          this.handleServerError(error);
        }
      });
  }

  private submitGoogleProfileUpdate(): void {
    this.loading.set(true);

    const storeDetails = this.storeDetailsForm.getRawValue();
    const profileData = {
      full_name: this.personalInfoForm.value.full_name,
      phone: this.personalInfoForm.value.phone,
      address: this.locationData?.address || '',
      latitude: this.locationData?.latitude,
      longitude: this.locationData?.longitude,
      store_name: storeDetails.store_name || null,
      wilaya: storeDetails.wilaya,
      daira: storeDetails.daira,
      commune: storeDetails.commune
    };

    this.userService.updateProfile(profileData)
      .subscribe({
        next: (updatedUser) => {
          this.loading.set(false);
          this.authService.updateCurrentUser(updatedUser);
          // Show the inactive user screen (same as normal registration)
          this.activeStep.set(6);
        },
        error: (error) => {
          this.loading.set(false);
          this.toast.showApiError(error, 'account.profile_update_failed');
        }
      });
  }

  private handleServerError(error: any): void {
    const errorDetail = error.error?.detail;
    let errorMessage = '';
    let originalMessage = '';

    if (typeof errorDetail === 'string') {
      errorMessage = errorDetail.toLowerCase();
      originalMessage = errorDetail;
    } else if (Array.isArray(errorDetail) && errorDetail.length > 0) {
      errorMessage = (errorDetail[0]?.msg || '').toLowerCase();
      originalMessage = errorDetail[0]?.msg || '';
    }

    // Clear previous server errors
    this.serverErrors.set({});

    // Check for email-related errors (slide 0)
    if (errorMessage.includes('email')) {
      this.serverErrors.set({ email: originalMessage });
      this.goToStep(0);
      return;
    }

    // Check for phone-related errors (slide 0)
    if (errorMessage.includes('phone')) {
      this.serverErrors.set({ phone: originalMessage });
      this.goToStep(0);
      return;
    }

    // Check for password-related errors (slide 2)
    if (errorMessage.includes('password')) {
      this.serverErrors.set({ password: originalMessage });
      this.goToStep(2);
      return;
    }

    // Fallback: show toast for unhandled errors
    this.toast.showApiError(error, 'auth.register_failed');
  }

  clearServerError(field: string): void {
    const current = this.serverErrors();
    if (current[field]) {
      const updated = { ...current };
      delete updated[field];
      this.serverErrors.set(updated);
    }
  }

  goToLogin(): void {
    const email = this.personalInfoForm.value.email;
    this.router.navigate([ROUTES.LOGIN], email ? { queryParams: { email } } : {});
  }

  // Password validation checks using computed signals
  passwordHasMinLength = computed(() => {
    const password = this.passwordForm?.get('password')?.value || '';
    return password.length >= 8;
  });

  passwordHasLetter = computed(() => {
    const password = this.passwordForm?.get('password')?.value || '';
    return /[a-zA-Z]/.test(password);
  });

  passwordHasNumber = computed(() => {
    const password = this.passwordForm?.get('password')?.value || '';
    return /[0-9]/.test(password);
  });

  passwordsMatch = computed(() => {
    const password = this.passwordForm?.get('password')?.value || '';
    const confirmPassword = this.passwordForm?.get('confirmPassword')?.value || '';
    return password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
  });

  // Scroll input into view when focused
  onInputFocus(fieldName: string): void {
    this.focusedField.set(fieldName);
    this.isInputFocused.set(true);

    // Scroll the focused input to top with offset
    setTimeout(() => {
      const fieldContainer = this.elementRef.nativeElement.querySelector(
        `[data-field="${fieldName}"]`
      ) as HTMLElement;
      if (fieldContainer) {
        const slideContent = fieldContainer.closest('.carousel-slide') as HTMLElement;
        if (slideContent) {
          // Get the field's position relative to the slide content
          const slideRect = slideContent.getBoundingClientRect();
          const fieldRect = fieldContainer.getBoundingClientRect();
          const relativeTop = fieldRect.top - slideRect.top + slideContent.scrollTop;
          // Scroll to position with 20px from top
          slideContent.scrollTo({ top: relativeTop - 20, behavior: 'smooth' });
        }
      }
    }, 300); // Delay to let keyboard open first
  }

  onInputBlur(): void {
    this.focusedField.set('');
    // Small delay to prevent flicker when switching between inputs
    setTimeout(() => {
      if (!this.focusedField()) {
        this.isInputFocused.set(false);
      }
    }, 100);
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword.update(v => !v);
  }

  // Focus input when clicking anywhere on the field container
  focusField(fieldName: string): void {
    // Try regular input or password input first
    let selector = `[data-field="${fieldName}"] input, [data-field="${fieldName}"] .p-password-input`;
    let input = this.elementRef.nativeElement.querySelector(selector) as HTMLInputElement;
    if (input) {
      input.focus();
      return;
    }

    // Try p-select component
    const selectElement = this.elementRef.nativeElement.querySelector(`[data-field="${fieldName}"] p-select`);
    if (selectElement) {
      // Click on the select to open it
      const selectTrigger = selectElement.querySelector('.p-select, .p-select-label') as HTMLElement;
      if (selectTrigger) {
        selectTrigger.click();
      }
    }
  }
}
