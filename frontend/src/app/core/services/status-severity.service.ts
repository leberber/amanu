import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { USER_ROLES } from '../constants/app.constants';

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
      case 'admin': return 'danger';
      case 'staff': return 'warn';
      case 'customer': return 'info';
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
      case 'pending': return 'warn';
      case 'confirmed': return 'info';
      case 'shipped': return 'info';
      case 'delivered': return 'success';
      case 'cancelled': return 'danger';
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
      case 'pending': return 'pi pi-clock';
      case 'confirmed': return 'pi pi-check';
      case 'shipped': return 'pi pi-send';
      case 'delivered': return 'pi pi-check-circle';
      case 'cancelled': return 'pi pi-times';
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
      case 'active': return 'success';
      case 'scheduled': return 'info';
      case 'expired': return 'secondary';
      case 'inactive': return 'danger';
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
      case 'active': return 'pi pi-check';
      case 'scheduled': return 'pi pi-clock';
      case 'expired': return 'pi pi-times';
      case 'inactive': return 'pi pi-ban';
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
      case 'paid': return 'success';
      case 'pending': return 'warn';
      case 'failed': return 'danger';
      case 'refunded': return 'info';
      default: return 'secondary';
    }
  }
}