import { Injectable, inject } from '@angular/core';
import { CustomToastService } from './custom-toast.service';

/**
 * Wrapper service for backward compatibility.
 * Delegates all calls to CustomToastService.
 */
@Injectable({
  providedIn: 'root'
})
export class ToastMessageService {
  private customToast = inject(CustomToastService);

  showSuccess(detail: string, params?: Record<string, any>): void {
    this.customToast.showSuccess(detail, params);
  }

  showError(detail: string, params?: Record<string, any>): void {
    this.customToast.showError(detail, params);
  }

  showInfo(detail: string, params?: Record<string, any>): void {
    this.customToast.showInfo(detail, params);
  }

  showWarn(detail: string, params?: Record<string, any>): void {
    this.customToast.showWarn(detail, params);
  }

  showWarnSticky(detail: string, params?: Record<string, any>): void {
    this.customToast.showWarnSticky(detail, params);
  }

  showCustom(severity: 'success' | 'info' | 'warn' | 'error', summary: string, detail: string, params?: Record<string, any>): void {
    this.customToast.showCustom(severity, summary, detail, params);
  }

  showApiError(error: any, fallbackKey: string): void {
    this.customToast.showApiError(error, fallbackKey);
  }

  showSessionExpired(): void {
    this.customToast.showSessionExpired();
  }

  showPermissionDenied(): void {
    this.customToast.showPermissionDenied();
  }

  showComingSoon(featureName: string): void {
    this.customToast.showComingSoon(featureName);
  }
}