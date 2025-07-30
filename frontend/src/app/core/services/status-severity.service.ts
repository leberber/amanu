import { Injectable } from '@angular/core';

/**
 * Service to centralize severity mappings for roles and statuses
 * Ensures consistent color coding across the application
 */
@Injectable({
  providedIn: 'root'
})
export class StatusSeverityService {
  
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
}