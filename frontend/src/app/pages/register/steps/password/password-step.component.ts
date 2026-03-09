import { Component, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { RegisterStateService } from '../../register-state.service';

@Component({
  selector: 'app-password-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  template: `
    <div class="register-header" [class.hidden]="state.isInputFocused()">
      <h1>{{ 'register.step2_title' | translate }}</h1>
      <p>{{ 'auth.password_minlength' | translate }}</p>
    </div>

    <form [formGroup]="state.passwordForm" class="register-form">
      <!-- Password -->
      <div class="register-input"
           [class.register-input--focused]="state.focusedField() === 'password'"
           [class.register-input--filled]="state.passwordForm.get('password')?.value">
        <input
          [type]="showPassword() ? 'text' : 'password'"
          formControlName="password"
          autocomplete="new-password"
          [placeholder]="'auth.password_placeholder' | translate"
          (focus)="state.onInputFocus('password')"
          (blur)="state.onInputBlur()">
        <button type="button" class="register-input__toggle" (click)="togglePassword()" tabindex="-1">
          <i class="pi" [class.pi-eye]="!showPassword()" [class.pi-eye-slash]="showPassword()"></i>
        </button>
      </div>

      <!-- Confirm Password -->
      <div class="register-input"
           [class.register-input--focused]="state.focusedField() === 'confirmPassword'"
           [class.register-input--filled]="state.passwordForm.get('confirmPassword')?.value">
        <input
          [type]="showConfirmPassword() ? 'text' : 'password'"
          formControlName="confirmPassword"
          autocomplete="new-password"
          [placeholder]="'register.confirm_password_placeholder' | translate"
          (focus)="state.onInputFocus('confirmPassword')"
          (blur)="state.onInputBlur()">
        <button type="button" class="register-input__toggle" (click)="toggleConfirmPassword()" tabindex="-1">
          <i class="pi" [class.pi-eye]="!showConfirmPassword()" [class.pi-eye-slash]="showConfirmPassword()"></i>
        </button>
      </div>

      <!-- Password Requirements -->
      <div class="register-requirements">
        <div class="register-requirements__item" [class.register-requirements__item--met]="hasMinLength">
          <i class="pi" [ngClass]="hasMinLength ? 'pi-check-circle' : 'pi-circle'"></i>
          <span>{{ 'register.password_min_chars' | translate }}</span>
        </div>
        <div class="register-requirements__item" [class.register-requirements__item--met]="hasLetter">
          <i class="pi" [ngClass]="hasLetter ? 'pi-check-circle' : 'pi-circle'"></i>
          <span>{{ 'register.password_has_letter' | translate }}</span>
        </div>
        <div class="register-requirements__item" [class.register-requirements__item--met]="hasNumber">
          <i class="pi" [ngClass]="hasNumber ? 'pi-check-circle' : 'pi-circle'"></i>
          <span>{{ 'register.password_has_number' | translate }}</span>
        </div>
        <div class="register-requirements__item" [class.register-requirements__item--met]="passwordsMatch">
          <i class="pi" [ngClass]="passwordsMatch ? 'pi-check-circle' : 'pi-circle'"></i>
          <span>{{ 'register.passwords_must_match' | translate }}</span>
        </div>
      </div>

      <!-- Continue Button -->
      <button
        type="button"
        class="register-btn"
        [disabled]="!state.isPasswordValid()"
        (click)="onContinue()">
        <span>{{ 'common.continue' | translate }}</span>
      </button>
    </form>
  `,
  styleUrls: ['../_shared-styles.scss']
})
export class PasswordStepComponent {
  state = inject(RegisterStateService);

  continue = output<void>();

  showPassword = signal(false);
  showConfirmPassword = signal(false);

  get hasMinLength(): boolean {
    const password = this.state.passwordForm?.get('password')?.value || '';
    return password.length >= 8;
  }

  get hasLetter(): boolean {
    const password = this.state.passwordForm?.get('password')?.value || '';
    return /[a-zA-Z]/.test(password);
  }

  get hasNumber(): boolean {
    const password = this.state.passwordForm?.get('password')?.value || '';
    return /[0-9]/.test(password);
  }

  get passwordsMatch(): boolean {
    const password = this.state.passwordForm?.get('password')?.value || '';
    const confirmPassword = this.state.passwordForm?.get('confirmPassword')?.value || '';
    return password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword.update(v => !v);
  }

  onContinue(): void {
    if (this.state.isPasswordValid()) {
      this.continue.emit();
    }
  }
}
