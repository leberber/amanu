import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';

export interface NotificationConfig {
  position?: 'top-right' | 'top-center' | 'top-left' | 'bottom-right' | 'bottom-center' | 'bottom-left' | 'center';
  duration?: number;
  closable?: boolean;
  style?: 'toast' | 'inline' | 'banner';
  sticky?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private messageService = inject(MessageService);
  
  // Default configurations
  private readonly defaultConfig: NotificationConfig = {
    position: 'top-right',
    duration: 3000,
    closable: true,
    style: 'toast',
    sticky: false
  };
  
  private readonly errorConfig: NotificationConfig = {
    ...this.defaultConfig,
    duration: 5000,
    sticky: false
  };

  /**
   * Show success notification
   * @param message - Message to display
   * @param title - Optional title
   * @param config - Optional configuration
   */
  success(message: string, title = 'Success', config?: NotificationConfig): void {
    this.show('success', message, title, config);
  }
  
  /**
   * Show error notification
   * @param message - Message to display
   * @param title - Optional title
   * @param config - Optional configuration
   */
  error(message: string, title = 'Error', config?: NotificationConfig): void {
    this.show('error', message, title, { ...this.errorConfig, ...config });
  }
  
  /**
   * Show warning notification
   * @param message - Message to display
   * @param title - Optional title
   * @param config - Optional configuration
   */
  warning(message: string, title = 'Warning', config?: NotificationConfig): void {
    this.show('warn', message, title, config);
  }
  
  /**
   * Show info notification
   * @param message - Message to display
   * @param title - Optional title
   * @param config - Optional configuration
   */
  info(message: string, title = 'Information', config?: NotificationConfig): void {
    this.show('info', message, title, config);
  }
  
  /**
   * Handle API errors with consistent format
   * @param error - Error object from HTTP response
   * @param customMessage - Optional custom message
   */
  handleApiError(error: any, customMessage?: string): void {
    const message = customMessage || this.extractErrorMessage(error);
    this.error(message, 'Operation Failed');
  }
  
  /**
   * Extract error message from various error formats
   * @param error - Error object
   * @returns Error message string
   */
  private extractErrorMessage(error: any): string {
    // Handle different error formats
    if (typeof error === 'string') {
      return error;
    }
    
    if (error?.error?.detail) {
      return error.error.detail;
    }
    
    if (error?.error?.message) {
      return error.error.message;
    }
    
    if (error?.message) {
      return error.message;
    }
    
    if (error?.error && typeof error.error === 'string') {
      return error.error;
    }
    
    // Handle validation errors
    if (error?.error?.errors) {
      const errors = error.error.errors;
      if (Array.isArray(errors)) {
        return errors.join(', ');
      }
      if (typeof errors === 'object') {
        return Object.values(errors).flat().join(', ');
      }
    }
    
    // Handle HTTP status codes
    if (error?.status) {
      switch (error.status) {
        case 400:
          return 'Invalid request. Please check your input.';
        case 401:
          return 'You are not authorized. Please log in.';
        case 403:
          return 'You do not have permission to perform this action.';
        case 404:
          return 'The requested resource was not found.';
        case 409:
          return 'This operation conflicts with existing data.';
        case 422:
          return 'The provided data is invalid.';
        case 500:
          return 'An internal server error occurred. Please try again later.';
        case 502:
        case 503:
          return 'The service is temporarily unavailable. Please try again later.';
        default:
          return `An error occurred (${error.status}). Please try again.`;
      }
    }
    
    return 'An unexpected error occurred. Please try again.';
  }
  
  /**
   * Show notification with specified configuration
   * @param severity - Notification severity
   * @param message - Message to display
   * @param title - Title of notification
   * @param config - Optional configuration
   */
  private show(
    severity: 'success' | 'info' | 'warn' | 'error',
    message: string,
    title: string,
    config?: NotificationConfig
  ): void {
    const finalConfig = { ...this.defaultConfig, ...config };
    
    this.messageService.add({
      severity,
      summary: title,
      detail: message,
      life: finalConfig.sticky ? undefined : finalConfig.duration,
      closable: finalConfig.closable,
      sticky: finalConfig.sticky,
      key: finalConfig.position
    });
  }
  
  /**
   * Clear all notifications
   */
  clear(): void {
    this.messageService.clear();
  }
  
  /**
   * Clear notifications at specific position
   * @param position - Position key
   */
  clearByPosition(position: string): void {
    this.messageService.clear(position);
  }
  
  /**
   * Show multiple notifications at once
   * @param notifications - Array of notification objects
   */
  showMultiple(notifications: Array<{
    severity: 'success' | 'info' | 'warn' | 'error';
    message: string;
    title?: string;
    config?: NotificationConfig;
  }>): void {
    notifications.forEach(notification => {
      this.show(
        notification.severity,
        notification.message,
        notification.title || this.getDefaultTitle(notification.severity),
        notification.config
      );
    });
  }
  
  /**
   * Get default title based on severity
   * @param severity - Notification severity
   * @returns Default title
   */
  private getDefaultTitle(severity: 'success' | 'info' | 'warn' | 'error'): string {
    switch (severity) {
      case 'success':
        return 'Success';
      case 'error':
        return 'Error';
      case 'warn':
        return 'Warning';
      case 'info':
        return 'Information';
    }
  }
  
  /**
   * Show form validation errors
   * @param errors - Object containing field errors
   */
  showValidationErrors(errors: Record<string, string[]>): void {
    const errorMessages = Object.entries(errors)
      .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
      .join('\n');
    
    this.error(errorMessages, 'Validation Error', { duration: 6000 });
  }
  
  /**
   * Show loading notification (sticky)
   * @param message - Loading message
   * @returns Key to clear this specific notification
   */
  showLoading(message = 'Loading...'): string {
    const key = 'loading-' + Date.now();
    this.messageService.add({
      severity: 'info',
      summary: 'Please wait',
      detail: message,
      sticky: true,
      closable: false,
      key
    });
    return key;
  }
  
  /**
   * Hide loading notification
   * @param key - Key returned from showLoading
   */
  hideLoading(key: string): void {
    this.messageService.clear(key);
  }
}