import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { USER_ROLES, ORDER_STATUS, PROMOTION_STATUS, PAYMENT_STATUS } from '../constants/app.constants';

/**
 * Service to centralize severity mappings for roles and statuses
 * Ensures consistent color coding across the application
 */
@Injectable({
  providedIn: 'root'
})
export class StatusSeverityService {
  private translateService = inject(TranslateService);

  /**
   * Get translated role options for dropdowns/selects.
   * Single source of truth for role options across the app.
   *
   * @returns Array of { label: string, value: string } for role selection
   *
   * @example
   * // In component:
   * roleOptions = this.statusService.getRoleOptions();
   */
  getRoleOptions(): { label: string; value: string }[] {
    return [
      { label: this.translateService.instant('admin.users.roles.customer'), value: USER_ROLES.CUSTOMER },
      { label: this.translateService.instant('admin.users.roles.staff'), value: USER_ROLES.STAFF },
      { label: this.translateService.instant('admin.users.roles.admin'), value: USER_ROLES.ADMIN }
    ];
  }

  /**
   * Get severity color for user roles
   * @param role - User role (admin, staff, customer)
   * @returns PrimeNG severity type
   */
  getRoleSeverity(role: string): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" {
    switch (role) {
      case USER_ROLES.ADMIN: return 'danger';
      case USER_ROLES.STAFF: return 'warn';
      case USER_ROLES.CUSTOMER: return 'info';
      default: return 'secondary';
    }
  }

  /**
   * Get severity color for order statuses
   * @param status - Order status
   * @returns PrimeNG severity type
   */
  getOrderStatusSeverity(status: string): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" {
    switch (status) {
      case ORDER_STATUS.PENDING: return 'warn';
      case ORDER_STATUS.CONFIRMED: return 'info';
      case ORDER_STATUS.SHIPPED: return 'info';
      case ORDER_STATUS.DELIVERED: return 'success';
      case ORDER_STATUS.CANCELLED: return 'danger';
      default: return 'secondary';
    }
  }

  /**
   * Get icon for order statuses
   * @param status - Order status
   * @returns PrimeNG icon class
   */
  getOrderStatusIcon(status: string): string {
    switch (status) {
      case ORDER_STATUS.PENDING: return 'pi pi-clock';
      case ORDER_STATUS.CONFIRMED: return 'pi pi-check';
      case ORDER_STATUS.SHIPPED: return 'pi pi-send';
      case ORDER_STATUS.DELIVERED: return 'pi pi-check-circle';
      case ORDER_STATUS.CANCELLED: return 'pi pi-times';
      default: return 'pi pi-info-circle';
    }
  }

  /**
   * Get severity for boolean status (active/inactive)
   * @param isActive - Boolean status
   * @returns PrimeNG severity type
   */
  getBooleanSeverity(isActive: boolean): "success" | "danger" {
    return isActive ? 'success' : 'danger';
  }

  /**
   * Get severity color for promotion statuses
   * @param status - Promotion status (active, expired, scheduled, inactive)
   * @returns PrimeNG severity type
   */
  getPromotionStatusSeverity(status: string): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" {
    switch (status) {
      case PROMOTION_STATUS.ACTIVE: return 'success';
      case PROMOTION_STATUS.SCHEDULED: return 'info';
      case PROMOTION_STATUS.EXPIRED: return 'secondary';
      case PROMOTION_STATUS.INACTIVE: return 'danger';
      default: return 'secondary';
    }
  }

  /**
   * Get icon for promotion statuses
   * @param status - Promotion status
   * @returns PrimeNG icon class
   */
  getPromotionStatusIcon(status: string): string {
    switch (status) {
      case PROMOTION_STATUS.ACTIVE: return 'pi pi-check';
      case PROMOTION_STATUS.SCHEDULED: return 'pi pi-clock';
      case PROMOTION_STATUS.EXPIRED: return 'pi pi-times';
      case PROMOTION_STATUS.INACTIVE: return 'pi pi-ban';
      default: return 'pi pi-info';
    }
  }

  /**
   * Get severity for stock levels
   * @param quantity - Stock quantity
   * @param lowThreshold - Low stock threshold (default: 10)
   * @param outThreshold - Out of stock threshold (default: 0)
   * @returns PrimeNG severity type
   */
  getStockSeverity(
    quantity: number,
    lowThreshold: number = 10,
    outThreshold: number = 0
  ): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" {
    if (quantity <= outThreshold) return 'danger';
    if (quantity <= lowThreshold) return 'warn';
    return 'success';
  }

  /**
   * Get severity for payment statuses
   * @param status - Payment status
   * @returns PrimeNG severity type
   */
  getPaymentStatusSeverity(status: string): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" {
    switch (status) {
      case PAYMENT_STATUS.PAID: return 'success';
      case PAYMENT_STATUS.PENDING: return 'warn';
      case PAYMENT_STATUS.FAILED: return 'danger';
      case PAYMENT_STATUS.REFUNDED: return 'info';
      default: return 'secondary';
    }
  }
}