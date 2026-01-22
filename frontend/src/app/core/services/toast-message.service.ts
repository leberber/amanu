import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';

/**
 * Service to centralize toast message handling
 * Provides consistent message formatting and translation
 */
@Injectable({
  providedIn: 'root'
})
export class ToastMessageService {
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService);

  // Default toast duration in milliseconds (matches CSS progress bar animation)
  private readonly DEFAULT_LIFE = 4000;

  /**
   * Show success message
   * @param detail - Message detail key or text
   * @param params - Translation parameters
   */
  showSuccess(detail: string, params?: any): void {
    this.messageService.add({
      severity: 'success',
      summary: this.translateService.instant('common.success'),
      detail: this.translateService.instant(detail, params),
      life: this.DEFAULT_LIFE
    });
  }

  /**
   * Show error message
   * @param detail - Message detail key or text
   * @param params - Translation parameters
   */
  showError(detail: string, params?: any): void {
    this.messageService.add({
      severity: 'error',
      summary: this.translateService.instant('common.error'),
      detail: this.translateService.instant(detail, params),
      life: this.DEFAULT_LIFE + 1000 // Errors stay a bit longer
    });
  }

  /**
   * Show info message
   * @param detail - Message detail key or text
   * @param params - Translation parameters
   */
  showInfo(detail: string, params?: any): void {
    this.messageService.add({
      severity: 'info',
      summary: this.translateService.instant('common.info'),
      detail: this.translateService.instant(detail, params),
      life: this.DEFAULT_LIFE
    });
  }

  /**
   * Show warning message
   * @param detail - Message detail key or text
   * @param params - Translation parameters
   */
  showWarn(detail: string, params?: any): void {
    this.messageService.add({
      severity: 'warn',
      summary: this.translateService.instant('common.warning'),
      detail: this.translateService.instant(detail, params),
      life: this.DEFAULT_LIFE
    });
  }

  /**
   * Show custom message
   * @param severity - Message severity
   * @param summary - Summary key or text
   * @param detail - Detail key or text
   * @param params - Translation parameters
   */
  showCustom(severity: 'success' | 'info' | 'warn' | 'error', summary: string, detail: string, params?: any): void {
    this.messageService.add({
      severity,
      summary: this.translateService.instant(summary, params),
      detail: this.translateService.instant(detail, params),
      life: this.DEFAULT_LIFE
    });
  }

  /**
   * Show API error message with fallback
   * @param error - Error object from API
   * @param fallbackKey - Fallback translation key
   */
  showApiError(error: any, fallbackKey: string): void {
    const detail = error.error?.detail || this.translateService.instant(fallbackKey);
    this.showError(detail);
  }

  /**
   * Show session expired message
   */
  showSessionExpired(): void {
    this.showCustom('warn', 'auth.session_expired_title', 'auth.session_expired_message');
  }

  /**
   * Show permission denied message
   */
  showPermissionDenied(): void {
    this.showError('common.permission_denied');
  }

  /**
   * Show feature coming soon message
   * @param featureName - Name of the feature
   */
  showComingSoon(featureName: string): void {
    this.showInfo('common.coming_soon', { feature: featureName });
  }
}