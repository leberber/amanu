import { Injectable, signal, computed, inject, DestroyRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilderService } from '../../core/services/form-builder.service';
import { VALIDATION } from '../../core/constants/validation.constants';
import { VehicleType } from '../../driver/services/driver.service';
import { LocationData } from '../../shared/components/map-picker/map-picker.component';

export type RegistrationType = 'customer' | 'driver' | null;

export interface WilayaData {
  wilaya: string;
  wilaya_code: number;
  dairas: DairaData[];
}

export interface DairaData {
  daira_name: string;
  daira_code: number;
  communes: CommuneData[];
}

export interface CommuneData {
  code: number;
  name: string;
}

@Injectable()
export class RegisterStateService {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);

  // Storage key for persisting state (v2 after refactor)
  private readonly STORAGE_KEY = 'registration_state_v2';

  // Registration type
  registrationType = signal<RegistrationType>(null);

  // Step navigation
  activeStep = signal(0);

  // Loading states
  loading = signal(false);
  verificationLoading = signal(false);

  // Email verification
  verificationCode = signal('');
  verificationSent = signal(false);
  emailVerified = signal(false);
  verificationError = signal('');
  resendCountdown = signal(0);

  // Server errors
  serverErrors = signal<Record<string, string>>({});

  // Location data
  locationData = signal<LocationData | null>(null);
  locationSelected = signal(false);

  // Google OAuth
  fromGoogle = signal(false);

  // UI state
  focusedField = signal('');
  isInputFocused = signal(false);
  pageReady = signal(false);
  stateRestored = false;

  // Forms
  personalInfoForm!: FormGroup;
  passwordForm!: FormGroup;
  storeDetailsForm!: FormGroup;
  vehicleForm!: FormGroup;

  // Wilaya data
  wilayaDataList = signal<WilayaData[]>([]);
  wilayas = signal<{ label: string; value: string }[]>([]);
  dairas = signal<{ label: string; value: string }[]>([]);
  communes = signal<{ label: string; value: string }[]>([]);

  // Vehicle type options
  readonly vehicleTypeOptions = [
    { label: 'Camion', value: VehicleType.TRUCK },
    { label: 'Fourgon', value: VehicleType.VAN },
    { label: 'Mini Fourgon', value: VehicleType.MINI_VAN }
  ];

  constructor() {
    this.initializeForms();

    // Clear old state keys from previous versions
    sessionStorage.removeItem('registration_state');
    sessionStorage.removeItem('registration_state_v2');
  }

  private initializeForms(): void {
    // Personal Info Form
    this.personalInfoForm = this.fb.group({
      full_name: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_NAME_LENGTH)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required]]
    });

    // Password Form
    this.passwordForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_PASSWORD_LENGTH)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: FormBuilderService.createPasswordMatchValidator('password', 'confirmPassword') });

    // Store Details Form
    this.storeDetailsForm = this.fb.group({
      store_name: [''],
      wilaya: ['', Validators.required],
      daira: [{ value: '', disabled: true }, Validators.required],
      commune: [{ value: '', disabled: true }, Validators.required]
    });

    // Vehicle Form
    this.vehicleForm = this.fb.group({
      vehicle_type: [null, Validators.required],
      capacity_kg: [null],
      capacity_volume: [null]
    });
  }

  private restoreSavedState(): void {
    const saved = sessionStorage.getItem(this.STORAGE_KEY);
    if (!saved) return;

    try {
      const state = JSON.parse(saved);
      const tenMinutes = 10 * 60 * 1000;

      if (Date.now() - state.timestamp < tenMinutes) {
        this.stateRestored = true;
        this.activeStep.set(state.activeStep || 0);
        this.verificationSent.set(state.verificationSent || false);
        this.emailVerified.set(state.emailVerified || false);
        this.registrationType.set(state.registrationType || null);
        this.pageReady.set(true);

        if (state.personalInfo) {
          this.personalInfoForm.patchValue(state.personalInfo);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  saveState(): void {
    if (this.activeStep() > 0 || this.verificationSent()) {
      const state = {
        activeStep: this.activeStep(),
        verificationSent: this.verificationSent(),
        emailVerified: this.emailVerified(),
        personalInfo: this.personalInfoForm.value,
        registrationType: this.registrationType(),
        timestamp: Date.now()
      };
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    }
  }

  clearSavedState(): void {
    sessionStorage.removeItem(this.STORAGE_KEY);
  }

  // Helper methods
  isDriverMode(): boolean {
    return this.registrationType() === 'driver';
  }

  isCustomerMode(): boolean {
    return this.registrationType() === 'customer';
  }

  // Form validity checks
  isPersonalInfoValid(): boolean {
    return this.personalInfoForm.valid;
  }

  isPasswordValid(): boolean {
    return this.passwordForm.valid;
  }

  isStoreDetailsValid(): boolean {
    const values = this.storeDetailsForm.getRawValue();
    return !!(values.wilaya && values.daira && values.commune);
  }

  isVehicleFormValid(): boolean {
    return this.vehicleForm.valid;
  }

  // Load wilaya data
  loadWilayaData(): void {
    this.http.get<WilayaData>('assets/tizi_ouzou_wilaya_full.json')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.wilayaDataList.set([data]);
          this.wilayas.set(
            [data].map(w => ({ label: w.wilaya, value: w.wilaya }))
          );
        }
      });
  }

  // Update dairas based on wilaya selection
  updateDairas(wilayaName: string): void {
    const wilayaData = this.wilayaDataList().find(w => w.wilaya === wilayaName);
    if (wilayaData) {
      this.dairas.set(
        wilayaData.dairas.map(d => ({ label: d.daira_name, value: d.daira_name }))
      );
      this.storeDetailsForm.get('daira')?.enable();
    } else {
      this.dairas.set([]);
      this.storeDetailsForm.get('daira')?.disable();
    }
    this.communes.set([]);
    this.storeDetailsForm.get('commune')?.disable();
  }

  // Update communes based on daira selection
  updateCommunes(dairaName: string): void {
    const wilayaName = this.storeDetailsForm.get('wilaya')?.value;
    const wilayaData = this.wilayaDataList().find(w => w.wilaya === wilayaName);
    const dairaData = wilayaData?.dairas.find(d => d.daira_name === dairaName);

    if (dairaData) {
      this.communes.set(
        dairaData.communes.map(c => ({ label: c.name, value: c.name }))
      );
      this.storeDetailsForm.get('commune')?.enable();
    } else {
      this.communes.set([]);
      this.storeDetailsForm.get('commune')?.disable();
    }
  }

  // Input focus handling
  onInputFocus(fieldName: string): void {
    this.focusedField.set(fieldName);
    this.isInputFocused.set(true);
  }

  onInputBlur(): void {
    this.focusedField.set('');
    setTimeout(() => {
      if (!this.focusedField()) {
        this.isInputFocused.set(false);
      }
    }, 100);
  }

  clearServerError(field: string): void {
    const current = this.serverErrors();
    if (current[field]) {
      const updated = { ...current };
      delete updated[field];
      this.serverErrors.set(updated);
    }
  }
}
