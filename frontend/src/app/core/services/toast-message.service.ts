import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
  providedIn: 'root'
})
export class ToastMessageService {
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService);


  private readonly DEFAULT_LIFE = 4000;

  showSuccess(detail: string, params?: any): void {
    this.messageService.add({
      severity: 'success',
      summary: this.translateService.instant('common.success'),
      detail: this.translateService.instant(detail, params),
      life: this.DEFAULT_LIFE
    });
  }

  showError(detail: string, params?: any): void {
    this.messageService.add({
      severity: 'error',
      summary: this.translateService.instant('common.error'),
      detail: this.translateService.instant(detail, params),
      life: this.DEFAULT_LIFE + 1000 
    });
  }

  showInfo(detail: string, params?: any): void {
    this.messageService.add({
      severity: 'info',
      summary: this.translateService.instant('common.info'),
      detail: this.translateService.instant(detail, params),
      life: this.DEFAULT_LIFE
    });
  }

  showWarn(detail: string, params?: any): void {
    this.messageService.add({
      severity: 'warn',
      summary: this.translateService.instant('common.warning'),
      detail: this.translateService.instant(detail, params),
      life: this.DEFAULT_LIFE
    });
  }

  showCustom(severity: 'success' | 'info' | 'warn' | 'error', summary: string, detail: string, params?: any): void {
    this.messageService.add({
      severity,
      summary: this.translateService.instant(summary, params),
      detail: this.translateService.instant(detail, params),
      life: this.DEFAULT_LIFE
    });
  }

  showApiError(error: any, fallbackKey: string): void {
    let detail: string;
    const errorDetail = error.error?.detail;

    if (typeof errorDetail === 'string') {
      // Direct string message from API
      detail = errorDetail;
    } else if (Array.isArray(errorDetail) && errorDetail.length > 0) {
    
      detail = errorDetail[0]?.msg || this.translateService.instant(fallbackKey);
    } else {
      // Fallback to translation key
      detail = this.translateService.instant(fallbackKey);
    }

  
    this.messageService.add({
      severity: 'error',
      summary: this.translateService.instant('common.error'),
      detail: detail,
      life: this.DEFAULT_LIFE + 1000
    });
  }

  showSessionExpired(): void {
    this.showCustom('warn', 'auth.session_expired_title', 'auth.session_expired_message');
  }

  showPermissionDenied(): void {
    this.showError('common.permission_denied');
  }

  showComingSoon(featureName: string): void {
    this.showInfo('common.coming_soon', { feature: featureName });
  }
}