import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { USER_ROLES, ORDER_STATUS, PROMOTION_STATUS, PAYMENT_STATUS } from '../constants/app.constants';

@Injectable({
  providedIn: 'root'
})
export class StatusSeverityService {
  private translateService = inject(TranslateService);

  getRoleOptions(): { label: string; value: string }[] {
    return [
      { label: this.translateService.instant('admin.users.roles.customer'), value: USER_ROLES.CUSTOMER },
      { label: this.translateService.instant('admin.users.roles.staff'), value: USER_ROLES.STAFF },
      { label: this.translateService.instant('admin.users.roles.admin'), value: USER_ROLES.ADMIN }
    ];
  }

  getRoleSeverity(role: string): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" {
    switch (role) {
      case USER_ROLES.ADMIN: return 'danger';
      case USER_ROLES.STAFF: return 'warn';
      case USER_ROLES.CUSTOMER: return 'info';
      default: return 'secondary';
    }
  }

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

  getBooleanSeverity(isActive: boolean): "success" | "danger" {
    return isActive ? 'success' : 'danger';
  }

  getPromotionStatusSeverity(status: string): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" {
    switch (status) {
      case PROMOTION_STATUS.ACTIVE: return 'success';
      case PROMOTION_STATUS.SCHEDULED: return 'info';
      case PROMOTION_STATUS.EXPIRED: return 'secondary';
      case PROMOTION_STATUS.INACTIVE: return 'danger';
      default: return 'secondary';
    }
  }

  getPromotionStatusIcon(status: string): string {
    switch (status) {
      case PROMOTION_STATUS.ACTIVE: return 'pi pi-check';
      case PROMOTION_STATUS.SCHEDULED: return 'pi pi-clock';
      case PROMOTION_STATUS.EXPIRED: return 'pi pi-times';
      case PROMOTION_STATUS.INACTIVE: return 'pi pi-ban';
      default: return 'pi pi-info';
    }
  }

  getStockSeverity(
    quantity: number,
    lowThreshold: number = 10,
    outThreshold: number = 0
  ): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" {
    if (quantity <= outThreshold) return 'danger';
    if (quantity <= lowThreshold) return 'warn';
    return 'success';
  }

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