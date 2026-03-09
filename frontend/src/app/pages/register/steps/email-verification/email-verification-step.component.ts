import { Component, inject, output, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { RegisterStateService } from '../../register-state.service';

@Component({
  selector: 'app-email-verification-step',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="register-header">
      <div class="verification-icon">
        <i class="pi pi-envelope"></i>
      </div>
      <h1>{{ 'register.verify_email_title' | translate }}</h1>
      <p>{{ 'register.verify_email_subtitle' | translate }}</p>
      <span class="verification-email">{{ state.personalInfoForm.value.email }}</span>
    </div>

    <!-- Code Input -->
    <div class="verification-code-container">
      <div class="code-inputs">
        @for (i of [0,1,2,3,4,5]; track i) {
          <div class="code-input">
            <input
              type="text"
              inputmode="numeric"
              maxlength="1"
              [value]="state.verificationCode()[i] || ''"
              (input)="onCodeInput($event, i)"
              (keydown)="onCodeKeydown($event, i)"
              (paste)="onCodePaste($event)"
              [class.filled]="state.verificationCode()[i]"
              [class.error]="state.verificationError()">
          </div>
        }
      </div>

      @if (state.verificationError()) {
        <small class="verification-error">{{ state.verificationError() }}</small>
      }
    </div>

    <!-- Resend Link -->
    <div class="verification-resend">
      @if (state.resendCountdown() > 0) {
        <span class="resend-countdown">{{ 'register.resend_code_in' | translate }} {{ state.resendCountdown() }}s</span>
      } @else {
        <button type="button" class="resend-btn" (click)="resendCode.emit()" [disabled]="state.verificationLoading()">
          {{ 'register.resend_code' | translate }}
        </button>
      }
    </div>

    <!-- Verify Button -->
    <button
      type="button"
      class="register-btn"
      [disabled]="state.verificationCode().length !== 6 || state.verificationLoading()"
      (click)="verify.emit()">
      @if (state.verificationLoading()) {
        <i class="pi pi-spin pi-spinner"></i>
      } @else {
        <span>{{ 'register.verify_code' | translate }}</span>
      }
    </button>
  `,
  styleUrls: ['../_shared-styles.scss']
})
export class EmailVerificationStepComponent {
  state = inject(RegisterStateService);
  private elementRef = inject(ElementRef);

  verify = output<void>();
  resendCode = output<void>();

  onCodeInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/[^0-9]/g, '');
    input.value = value;

    const currentCode = this.state.verificationCode().split('');
    while (currentCode.length < 6) currentCode.push('');
    currentCode[index] = value;
    this.state.verificationCode.set(currentCode.join(''));
    this.state.verificationError.set('');

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
        const currentCode = this.state.verificationCode().split('');
        currentCode[index - 1] = '';
        this.state.verificationCode.set(currentCode.join(''));
      }
    }
  }

  onCodePaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedData = event.clipboardData?.getData('text') || '';
    const digits = pastedData.replace(/[^0-9]/g, '').slice(0, 6);

    if (digits) {
      this.state.verificationCode.set(digits.padEnd(6, ''));

      const inputs = this.elementRef.nativeElement.querySelectorAll('.code-input input');
      inputs.forEach((input: HTMLInputElement, i: number) => {
        input.value = digits[i] || '';
      });

      const focusIndex = Math.min(digits.length, 5);
      (inputs[focusIndex] as HTMLInputElement)?.focus();
    }
  }
}
