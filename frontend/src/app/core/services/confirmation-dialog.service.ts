import { Injectable, inject } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';

export interface ConfirmConfig {
  message?: string;
  header?: string;
  icon?: string;
  acceptLabel?: string;
  rejectLabel?: string;
  acceptButtonStyleClass?: string;
  rejectButtonStyleClass?: string;
}

/**
 * Simple service to standardize confirmation dialogs
 * Reduces duplicate confirmation code across components
 */
@Injectable({
  providedIn: 'root'
})
export class ConfirmationDialogService {
  private translateService = inject(TranslateService);

  /**
   * Show a delete confirmation dialog
   * @param confirmationService - ConfirmationService instance from component
   * @param itemName - Name of the item being deleted
   * @param onConfirm - Callback when user confirms
   * @param config - Additional configuration
   */
  confirmDelete(confirmationService: ConfirmationService, itemName: string, onConfirm: () => void, config?: ConfirmConfig): void {
    confirmationService.confirm({
      message: config?.message || this.translateService.instant('common.confirm_delete_message', { item: itemName }),
      header: config?.header || this.translateService.instant('common.confirm_delete'),
      icon: config?.icon || 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: config?.acceptButtonStyleClass || 'p-button-danger',
      rejectButtonStyleClass: config?.rejectButtonStyleClass || 'p-button-text',
      acceptLabel: config?.acceptLabel || this.translateService.instant('common.delete'),
      rejectLabel: config?.rejectLabel || this.translateService.instant('common.cancel'),
      accept: onConfirm
    });
  }

  /**
   * Show a generic confirmation dialog
   * @param confirmationService - ConfirmationService instance from component
   * @param message - Confirmation message
   * @param onConfirm - Callback when user confirms
   * @param config - Additional configuration
   */
  confirm(confirmationService: ConfirmationService, message: string, onConfirm: () => void, config?: ConfirmConfig): void {
    confirmationService.confirm({
      message: message,
      header: config?.header || this.translateService.instant('common.confirm'),
      icon: config?.icon || 'pi pi-question-circle',
      acceptButtonStyleClass: config?.acceptButtonStyleClass || 'p-button-primary',
      rejectButtonStyleClass: config?.rejectButtonStyleClass || 'p-button-text',
      acceptLabel: config?.acceptLabel || this.translateService.instant('common.yes'),
      rejectLabel: config?.rejectLabel || this.translateService.instant('common.no'),
      accept: onConfirm
    });
  }

  /**
   * Show a warning confirmation dialog
   * @param confirmationService - ConfirmationService instance from component
   * @param message - Warning message
   * @param onConfirm - Callback when user confirms
   * @param config - Additional configuration
   */
  confirmWarning(confirmationService: ConfirmationService, message: string, onConfirm: () => void, config?: ConfirmConfig): void {
    confirmationService.confirm({
      message: message,
      header: config?.header || this.translateService.instant('common.warning'),
      icon: config?.icon || 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: config?.acceptButtonStyleClass || 'p-button-warning',
      rejectButtonStyleClass: config?.rejectButtonStyleClass || 'p-button-text',
      acceptLabel: config?.acceptLabel || this.translateService.instant('common.proceed'),
      rejectLabel: config?.rejectLabel || this.translateService.instant('common.cancel'),
      accept: onConfirm
    });
  }
}