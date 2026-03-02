import {
  Component,
  AfterViewInit,
  OnDestroy,
  inject,
  input,
  output,
  signal,
  ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../environments/environment';

declare const google: any;

@Component({
  selector: 'app-google-signin-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './google-signin-button.component.html',
  styleUrl: './google-signin-button.component.scss'
})
export class GoogleSignInButtonComponent implements AfterViewInit, OnDestroy {
  /** Button text type: 'signin_with' or 'signup_with' */
  buttonText = input<'signin_with' | 'signup_with'>('signin_with');

  /** Emits the Google credential token when authentication succeeds */
  credentialReceived = output<string>();

  /** Loading state - can be controlled externally */
  loading = signal(false);

  private elementRef = inject(ElementRef);
  private checkInterval: any;
  private buttonId = `google-btn-${Math.random().toString(36).substring(2, 9)}`;

  ngAfterViewInit(): void {
    this.initGoogleSignIn();
  }

  ngOnDestroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  getButtonId(): string {
    return this.buttonId;
  }

  setLoading(value: boolean): void {
    this.loading.set(value);
  }

  private initGoogleSignIn(): void {
    if (!environment.googleClientId) {
      console.warn('Google Client ID not configured');
      return;
    }

    this.checkInterval = setInterval(() => {
      if (typeof google !== 'undefined' && google.accounts) {
        clearInterval(this.checkInterval);

        google.accounts.id.initialize({
          client_id: environment.googleClientId,
          callback: (response: any) => this.handleCallback(response),
          auto_select: false,
          cancel_on_tap_outside: true
        });

        const buttonElement = this.elementRef.nativeElement.querySelector(`#${this.buttonId}`);
        if (buttonElement) {
          google.accounts.id.renderButton(buttonElement, {
            theme: 'outline',
            size: 'large',
            width: '100%',
            text: this.buttonText(),
            shape: 'pill',
            logo_alignment: 'center'
          });
        }
      }
    }, 100);

    // Clear interval after 5 seconds if Google doesn't load
    setTimeout(() => {
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
      }
    }, 5000);
  }

  private handleCallback(response: any): void {
    if (response.credential) {
      this.credentialReceived.emit(response.credential);
    }
  }
}
