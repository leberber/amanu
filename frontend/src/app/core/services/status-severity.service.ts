import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { USER_ROLES } from '../constants/user.constants';
import { ORDER_STATUS, ORDER_STATUS_CONFIG, PAYMENT_STATUS } from '../constants/order.constants';
import { PROMOTION_STATUS } from '../constants/promotion.constants';

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
    const config = ORDER_STATUS_CONFIG[status as keyof typeof ORDER_STATUS_CONFIG];
    return config?.severity || 'secondary';
  }

  getOrderStatusIcon(status: string): string {
    const config = ORDER_STATUS_CONFIG[status as keyof typeof ORDER_STATUS_CONFIG];
    return config?.icon || 'pi pi-info-circle';
  }

  getOrderStatusColor(status: string): string {
    const config = ORDER_STATUS_CONFIG[status as keyof typeof ORDER_STATUS_CONFIG];
    return config?.color || '#607D8B';
  }

  getNextOrderStatuses(currentStatus: string): { value: string; label: string; icon: string }[] {
    const statusTransitions: Record<string, string[]> = {
      [ORDER_STATUS.PENDING]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.SHIPPED, ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED],
      [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED],
      [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED],
      [ORDER_STATUS.DELIVERED]: [],
      [ORDER_STATUS.CANCELLED]: []
    };

    const nextStatuses = statusTransitions[currentStatus] || [];

    return nextStatuses.map(status => ({
      value: status,
      label: this.translateService.instant('admin.orders.status.' + status),
      icon: this.getOrderStatusIcon(status)
    }));
  }

  canEditOrderStatus(status: string): boolean {
    return this.getNextOrderStatuses(status).length > 0;
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