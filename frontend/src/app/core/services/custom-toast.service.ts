import { Injectable, signal, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type ToastSeverity = 'success' | 'error' | 'warn' | 'info';

export interface ToastMessage {
  id: string;
  severity: ToastSeverity;
  summary: string;
  detail?: string;
  life: number;
  state: 'enter' | 'leave';
}

@Injectable({
  providedIn: 'root'
})
export class CustomToastService {
  private translateService = inject(TranslateService);

  private readonly DEFAULT_LIFE = 1000;
  private toastList = signal<ToastMessage[]>([]);

  toasts = this.toastList.asReadonly();

  private generateId(): string {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private add(toast: Omit<ToastMessage, 'id' | 'state'>): void {
    const newToast: ToastMessage = {
      ...toast,
      id: this.generateId(),
      state: 'enter'
    };

    this.toastList.update(list => [...list, newToast]);

    // Auto-remove after life duration
    setTimeout(() => {
      this.remove(newToast.id);
    }, toast.life);
  }

  remove(id: string): void {
    this.toastList.update(list => list.filter(t => t.id !== id));
  }

  clear(): void {
    this.toastList.set([]);
  }

  showSuccess(detail: string, params?: Record<string, any>): void {
    this.add({
      severity: 'success',
      summary: this.translateService.instant('common.success'),
      detail: this.translateService.instant(detail, params),
      life: 500
    });
  }

  showError(detail: string, params?: Record<string, any>): void {
    this.add({
      severity: 'error',
      summary: this.translateService.instant('common.error'),
      detail: this.translateService.instant(detail, params),
      life: this.DEFAULT_LIFE + 500
    });
  }

  showInfo(detail: string, params?: Record<string, any>): void {
    this.add({
      severity: 'info',
      summary: this.translateService.instant('common.info'),
      detail: this.translateService.instant(detail, params),
      life: this.DEFAULT_LIFE
    });
  }

  showWarn(detail: string, params?: Record<string, any>): void {
    this.add({
      severity: 'warn',
      summary: this.translateService.instant('common.warning'),
      detail: this.translateService.instant(detail, params),
      life: this.DEFAULT_LIFE
    });
  }

  showCustom(severity: ToastSeverity, summary: string, detail: string, params?: Record<string, any>): void {
    this.add({
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
      detail = errorDetail;
    } else if (Array.isArray(errorDetail) && errorDetail.length > 0) {
      detail = errorDetail[0]?.msg || this.translateService.instant(fallbackKey);
    } else {
      detail = this.translateService.instant(fallbackKey);
    }

    this.add({
      severity: 'error',
      summary: this.translateService.instant('common.error'),
      detail: detail,
      life: this.DEFAULT_LIFE + 500
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
