import { Component, inject, ViewChild, ElementRef, OnInit, OnDestroy, AfterViewInit, DestroyRef, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToastModule } from 'primeng/toast';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { UserRole } from '../../models/user.model';
import { MapPickerComponent, LocationData } from '../../shared/components/map-picker/map-picker.component';
import { VALIDATION, UI_DELAY } from '../../core/constants/app.constants';
import { FormBuilderService } from '../../core/services/form-builder.service';
import { PhoneFormatDirective } from '../../directives/phone-format.directive';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { ROUTES } from '../../core/constants/routes.constants';
import { InactiveUserMessageComponent } from '../../components/inactive-user-message/inactive-user-message.component';

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
    InactiveUserMessageComponent
  ],
    templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild(MapPickerComponent) mapPicker!: MapPickerComponent;

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

  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);

  // Services
  private authService = inject(AuthService);
  private router = inject(Router);
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

    // Set initial validity for pre-filled forms
    this.personalInfoValid.set(this.personalInfoForm.valid);
    this.passwordFormValid.set(this.passwordForm.valid);
  }

  ngAfterViewInit() {
    // Trigger animation sequence - logo starts centered then moves to top
    setTimeout(() => {
      this.pageReady.set(true);
    }, 1000);
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
                // Move to next step after populating
                this.goToNextStepAfterLocation();
              }, 150);
            } else {
              // No daira match, still move to next step
              this.goToNextStepAfterLocation();
            }
          } else {
            // No daira to match, still move to next step
            this.goToNextStepAfterLocation();
          }
        }, 150);
      } else {
        // No wilaya match, still move to next step
        this.goToNextStepAfterLocation();
      }
    } else {
      // No wilaya data, still move to next step
      this.goToNextStepAfterLocation();
    }
  }

  private goToNextStepAfterLocation() {
    // Small delay for smoother transition
    setTimeout(() => {
      if (this.activeStep() === 2) {
        this.activeStep.set(3);
        this.onStepChange();
      }
    }, 300);
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

  // Step navigation
  canProceedStep1(): boolean {
    return this.personalInfoForm.valid;
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
        return this.passwordFormValid();
      case 2:
        return this.locationSelected();
      case 3:
        return this.storeDetailsValid();
      default:
        return true;
    }
  });

  // Check if a specific step can be accessed (all previous steps must be valid)
  canAccessStep(step: number): boolean {
    if (step === 0) return true;
    if (step === 1) return this.canProceedStep1();
    if (step === 2) return this.canProceedStep1() && this.canProceedStep2();
    if (step === 3) return this.canProceedStep1() && this.canProceedStep2() && this.canProceedStep3();
    if (step === 4) return this.canProceedStep1() && this.canProceedStep2() && this.canProceedStep3() && this.canProceedStep4();
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
    if (this.activeStep() < 4 && this.canProceedCurrentStep()) {
      this.activeStep.update(v => v + 1);
      this.onStepChange();
    }
  }

  private onStepChange() {
    // Invalidate map size when entering map step
    if (this.activeStep() === 2 && this.mapPicker) {
      setTimeout(() => {
        // Map will show "Use My Location" button for user to click
      }, 300);
    }
  }

  prevStep() {
    if (this.activeStep() > 0) {
      this.activeStep.update(v => v - 1);
    }
  }

  // Final submission
  onRegister() {
    // Mark all fields as touched to show validation errors
    this.personalInfoForm.markAllAsTouched();
    this.passwordForm.markAllAsTouched();
    this.storeDetailsForm.markAllAsTouched();

    // Check if all steps are valid
    if (!this.canProceedStep1()) {
      this.toast.showWarn('register.complete_personal_info');
      this.goToStep(0);
      return;
    }

    if (!this.canProceedStep2()) {
      this.toast.showWarn('register.complete_password');
      this.goToStep(1);
      return;
    }

    if (!this.canProceedStep3()) {
      this.toast.showWarn('register.select_location');
      this.goToStep(2);
      return;
    }

    if (!this.canProceedStep4()) {
      this.toast.showWarn('register.complete_store_details');
      this.goToStep(3);
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
          this.activeStep.set(5); // Navigate to success screen
        },
        error: (error) => {
          this.toast.showApiError(error, 'auth.register_failed');
          this.loading.set(false);
        }
      });
  }

  goToLogin(): void {
    this.router.navigate([ROUTES.LOGIN]);
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
