import { Component, inject, output, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { RegisterStateService } from '../../register-state.service';
import { PhoneFormatDirective } from '../../../../directives/phone-format.directive';
import { GoogleSignInButtonComponent } from '../../../../shared/components/google-signin-button/google-signin-button.component';
import { ROUTES } from '../../../../core/constants/routes.constants';

@Component({
  selector: 'app-personal-info-step',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TranslateModule,
    PhoneFormatDirective,
    GoogleSignInButtonComponent
  ],
  template: `
    <div class="register-header" [class.hidden]="state.isInputFocused()">
      <h1>{{ state.isDriverMode() ? 'Inscription Chauffeur' : ('register.step1_title' | translate) }}</h1>
      <p>{{ state.isDriverMode() ? 'Informations personnelles' : ('auth.register_subtitle' | translate) }}</p>
    </div>

    <form [formGroup]="state.personalInfoForm" class="register-form">
      <!-- Full Name -->
      <div class="register-input"
           [class.register-input--focused]="state.focusedField() === 'full_name'"
           [class.register-input--filled]="state.personalInfoForm.get('full_name')?.value">
        <input
          type="text"
          name="name"
          formControlName="full_name"
          autocomplete="name"
          [placeholder]="'auth.full_name_placeholder' | translate"
          (focus)="state.onInputFocus('full_name')"
          (blur)="state.onInputBlur()">
      </div>

      <!-- Email -->
      <div class="register-field-wrapper">
        <div class="register-input"
             [class.register-input--focused]="state.focusedField() === 'email'"
             [class.register-input--filled]="state.personalInfoForm.get('email')?.value"
             [class.register-input--error]="state.serverErrors()['email']"
             [class.register-input--readonly]="state.fromGoogle()">
          <input
            type="email"
            inputmode="email"
            name="email"
            formControlName="email"
            autocomplete="email"
            [placeholder]="'auth.email_placeholder' | translate"
            [readonly]="state.fromGoogle()"
            (focus)="state.onInputFocus('email')"
            (blur)="state.onInputBlur()"
            (input)="state.clearServerError('email')">
        </div>
        @if (state.serverErrors()['email']) {
          <small class="register-error">{{ state.serverErrors()['email'] }}</small>
        }
      </div>

      <!-- Phone -->
      <div class="register-field-wrapper">
        <div class="register-input"
             [class.register-input--focused]="state.focusedField() === 'phone'"
             [class.register-input--filled]="state.personalInfoForm.get('phone')?.value"
             [class.register-input--error]="state.serverErrors()['phone']">
          <input
            type="tel"
            inputmode="tel"
            name="phone"
            formControlName="phone"
            autocomplete="tel"
            appPhoneFormat
            [placeholder]="'auth.phone_placeholder' | translate"
            (focus)="state.onInputFocus('phone')"
            (blur)="state.onInputBlur()"
            (input)="state.clearServerError('phone')">
        </div>
        @if (state.serverErrors()['phone']) {
          <small class="register-error">{{ state.serverErrors()['phone'] }}</small>
        }
      </div>

      <!-- Login Link -->
      <div class="register-links">
        <span>{{ 'auth.already_have_account' | translate }}</span>
        <a [routerLink]="ROUTES.LOGIN">{{ 'auth.login_now' | translate }}</a>
      </div>

      <!-- Continue Button -->
      <button
        type="button"
        class="register-btn"
        [disabled]="!state.isPersonalInfoValid() || state.verificationLoading()"
        (click)="onContinue()">
        @if (state.verificationLoading()) {
          <i class="pi pi-spin pi-spinner"></i>
        } @else {
          <span>{{ 'common.continue' | translate }}</span>
        }
      </button>

      <!-- Google Sign-Up (not shown if already in Google flow) -->
      @if (!state.fromGoogle()) {
        <div class="register-divider">
          <span>{{ 'common.or' | translate }}</span>
        </div>
        <div class="register-google">
          <app-google-signin-button
            buttonText="signup_with"
            (credentialReceived)="googleCredential.emit($event)"
          />
        </div>
      }

      <!-- Back to type selection -->
      @if (state.registrationType() !== null && !state.fromGoogle()) {
        <div class="back-to-choice">
          <button type="button" (click)="backToChoice.emit()">
            <i class="pi pi-arrow-left"></i>
            <span>Changer de type de compte</span>
          </button>
        </div>
      }
    </form>
  `,
  styleUrls: ['../_shared-styles.scss']
})
export class PersonalInfoStepComponent {
  state = inject(RegisterStateService);

  continue = output<void>();
  backToChoice = output<void>();
  googleCredential = output<string>();

  readonly ROUTES = ROUTES;

  onContinue(): void {
    if (this.state.isPersonalInfoValid()) {
      this.continue.emit();
    }
  }
}
