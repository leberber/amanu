// src/app/pages/register/register.component.ts
import { Component, inject, ViewChild, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { UserRole } from '../../models/user.model';
import { MapPickerComponent, LocationData } from '../../shared/components/map-picker/map-picker.component';
import { VALIDATION } from '../../core/constants/app.constants';
import { PhoneFormatDirective } from '../../directives/phone-format.directive';
import { LanguageSelectorComponent } from '../../components/language-selector/language-selector.component';

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
    PasswordModule,
    SelectModule,
    RouterLink,
    TranslateModule,
    MapPickerComponent,
    PhoneFormatDirective,
    LanguageSelectorComponent
  ],
  providers: [MessageService],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent implements OnInit {
  @ViewChild(MapPickerComponent) mapPicker!: MapPickerComponent;

  loading = false;
  activeStep = 0;
  focusedField = '';
  isInputFocused = false;

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

  // Services
  private authService = inject(AuthService);
  private router = inject(Router);
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService);
  private fb = inject(FormBuilder);
  private elementRef = inject(ElementRef);

  constructor() {
    // Step 1: Personal Info
    this.personalInfoForm = this.fb.group({
      full_name: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_NAME_LENGTH)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required]]
    });

    // Step 2: Password
    this.passwordForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_PASSWORD_LENGTH)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });

    // Step 4: Store Details (after map)
    this.storeDetailsForm = this.fb.group({
      store_name: [''],
      wilaya: ['', Validators.required],
      daira: ['', Validators.required],
      commune: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.loadWilayaData();
    this.setupFormSubscriptions();
  }

  private loadWilayaData() {
    this.http.get<WilayaData>('assets/tizi_ouzou_wilaya_full.json').subscribe({
      next: (data) => {
        this.wilayaDataList = [data];
        this.wilayas = this.wilayaDataList.map(w => ({
          label: w.wilaya,
          value: w.wilaya
        }));
      },
      error: (err) => {
        console.error('Failed to load wilaya data:', err);
      }
    });
  }

  private setupFormSubscriptions() {
    // Listen for wilaya changes
    this.storeDetailsForm.get('wilaya')?.valueChanges.subscribe(selectedWilaya => {
      this.storeDetailsForm.patchValue({ daira: '', commune: '' }, { emitEvent: false });
      this.communes = [];

      const wilayaData = this.wilayaDataList.find(w => w.wilaya === selectedWilaya);
      if (wilayaData) {
        this.dairas = wilayaData.dairas.map(d => ({
          label: d.daira_name,
          value: d.daira_name
        }));
      } else {
        this.dairas = [];
      }
    });

    // Listen for daira changes
    this.storeDetailsForm.get('daira')?.valueChanges.subscribe(selectedDaira => {
      this.storeDetailsForm.patchValue({ commune: '' }, { emitEvent: false });

      const selectedWilaya = this.storeDetailsForm.get('wilaya')?.value;
      const wilayaData = this.wilayaDataList.find(w => w.wilaya === selectedWilaya);
      if (wilayaData) {
        const dairaData = wilayaData.dairas.find(d => d.daira_name === selectedDaira);
        if (dairaData) {
          this.communes = dairaData.communes.map(c => ({
            label: c.name,
            value: c.name
          }));
        } else {
          this.communes = [];
        }
      }
    });
  }

  onWilayaChange(event: any) {
    // Handled by valueChanges subscription
  }

  onDairaChange(event: any) {
    // Handled by valueChanges subscription
  }

  // Custom validator for password match
  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    if (password !== confirmPassword) {
      form.get('confirmPassword')?.setErrors({ mismatch: true });
      return { mismatch: true };
    }
    return null;
  }

  onLocationSelected(location: LocationData) {
    this.locationData = location;
  }

  onLocationError(errorType: string) {
    let message = '';
    switch (errorType) {
      case 'permission_denied':
        message = this.translateService.instant('register.location_permission_denied');
        break;
      case 'position_unavailable':
        message = this.translateService.instant('register.location_unavailable');
        break;
      case 'timeout':
        message = this.translateService.instant('register.location_timeout');
        break;
      case 'geolocation_not_supported':
        message = this.translateService.instant('register.geolocation_not_supported');
        break;
      default:
        message = this.translateService.instant('register.location_error');
    }

    this.messageService.add({
      severity: 'warn',
      summary: this.translateService.instant('common.warning'),
      detail: message,
      life: 5000
    });
  }

  // Step navigation
  canProceedStep1(): boolean {
    return this.personalInfoForm.valid;
  }

  canProceedStep2(): boolean {
    return this.passwordForm.valid;
  }

  canProceedStep3(): boolean {
    return !!this.locationData;
  }

  canProceedStep4(): boolean {
    return this.storeDetailsForm.valid;
  }

  // Check if current step is valid
  get canProceedCurrentStep(): boolean {
    switch (this.activeStep) {
      case 0:
        return this.canProceedStep1();
      case 1:
        return this.canProceedStep2();
      case 2:
        return this.canProceedStep3();
      case 3:
        return this.canProceedStep4();
      default:
        return true;
    }
  }

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
    if (step <= this.activeStep || this.canAccessStep(step)) {
      this.activeStep = step;
      this.onStepChange();
    }
  }

  nextStep() {
    // Only proceed if current step is valid
    if (this.activeStep < 4 && this.canProceedCurrentStep) {
      this.activeStep++;
      this.onStepChange();
    }
  }

  private onStepChange() {
    // Invalidate map size when entering map step
    if (this.activeStep === 2 && this.mapPicker) {
      setTimeout(() => {
        // Map will show "Use My Location" button for user to click
      }, 300);
    }
  }

  prevStep() {
    if (this.activeStep > 0) {
      this.activeStep--;
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
      this.messageService.add({
        severity: 'warn',
        summary: this.translateService.instant('common.warning'),
        detail: this.translateService.instant('register.complete_personal_info')
      });
      this.goToStep(0);
      return;
    }

    if (!this.canProceedStep2()) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translateService.instant('common.warning'),
        detail: this.translateService.instant('register.complete_password')
      });
      this.goToStep(1);
      return;
    }

    if (!this.canProceedStep3()) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translateService.instant('common.warning'),
        detail: this.translateService.instant('register.select_location')
      });
      this.goToStep(2);
      return;
    }

    if (!this.canProceedStep4()) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translateService.instant('common.warning'),
        detail: this.translateService.instant('register.complete_store_details')
      });
      this.goToStep(3);
      return;
    }

    this.loading = true;

    const registerData = {
      full_name: this.personalInfoForm.value.full_name,
      email: this.personalInfoForm.value.email,
      phone: this.personalInfoForm.value.phone,
      password: this.passwordForm.value.password,
      address: this.locationData?.address || '',
      latitude: this.locationData?.latitude,
      longitude: this.locationData?.longitude,
      store_name: this.storeDetailsForm.value.store_name || null,
      wilaya: this.storeDetailsForm.value.wilaya,
      daira: this.storeDetailsForm.value.daira,
      commune: this.storeDetailsForm.value.commune,
      role: UserRole.CUSTOMER
    };

    this.authService.register(registerData)
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.translateService.instant('common.success'),
            detail: this.translateService.instant('auth.register_success')
          });
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 1500);
        },
        error: (error) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translateService.instant('common.error'),
            detail: error.error?.detail || this.translateService.instant('auth.register_failed')
          });
          this.loading = false;
        }
      });
  }

  // Helper methods for form validation display
  getFieldError(form: FormGroup, fieldName: string, errorType: string): boolean {
    const field = form.get(fieldName);
    return !!(field?.hasError(errorType) && (field?.dirty || field?.touched));
  }

  // Password validation checks
  get passwordHasMinLength(): boolean {
    const password = this.passwordForm.get('password')?.value || '';
    return password.length >= 8;
  }

  get passwordHasLetter(): boolean {
    const password = this.passwordForm.get('password')?.value || '';
    return /[a-zA-Z]/.test(password);
  }

  get passwordHasNumber(): boolean {
    const password = this.passwordForm.get('password')?.value || '';
    return /[0-9]/.test(password);
  }

  get passwordsMatch(): boolean {
    const password = this.passwordForm.get('password')?.value || '';
    const confirmPassword = this.passwordForm.get('confirmPassword')?.value || '';
    return password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
  }

  // Scroll input into view when focused
  onInputFocus(fieldName: string): void {
    this.focusedField = fieldName;
    this.isInputFocused = true;

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
    this.focusedField = '';
    // Small delay to prevent flicker when switching between inputs
    setTimeout(() => {
      if (!this.focusedField) {
        this.isInputFocused = false;
      }
    }, 100);
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
