import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ORDER_STATUS, ORDER_STATUS_CONFIG, TIMELINE_COLORS } from '../constants/order.constants';
import { Order } from '../../models/order.model';

export interface TimelineStatus {
  status: string;
  date: string;
  icon: string;
  color: string;
}

@Injectable({ providedIn: 'root' })
export class OrderTimelineService {
  private translateService = inject(TranslateService);

  getStatusIcon(status?: string): string {
    if (!status) return 'pi-shopping-bag';
    const config = ORDER_STATUS_CONFIG[status as keyof typeof ORDER_STATUS_CONFIG];
    return config?.iconClass || 'pi-shopping-bag';
  }

  getStatusColor(status?: string): string {
    if (!status) return TIMELINE_COLORS.PLACED;
    const config = ORDER_STATUS_CONFIG[status as keyof typeof ORDER_STATUS_CONFIG];
    return config?.color || TIMELINE_COLORS.PLACED;
  }

  generateTimeline(order: Order): TimelineStatus[] {
    const confirmedConfig = ORDER_STATUS_CONFIG[ORDER_STATUS.CONFIRMED];
    const assignedConfig = ORDER_STATUS_CONFIG[ORDER_STATUS.ASSIGNED];
    const pickedUpConfig = ORDER_STATUS_CONFIG[ORDER_STATUS.PICKED_UP];
    const inTransitConfig = ORDER_STATUS_CONFIG[ORDER_STATUS.IN_TRANSIT];
    const deliveredConfig = ORDER_STATUS_CONFIG[ORDER_STATUS.DELIVERED];
    const cancelledConfig = ORDER_STATUS_CONFIG[ORDER_STATUS.CANCELLED];

    const statuses: TimelineStatus[] = [
      this.createStatus('orders.detail.timeline.order_placed', order.created_at, 'pi pi-shopping-cart', TIMELINE_COLORS.PLACED)
    ];

    const statusDate = order.updated_at || order.created_at;

    switch (order.status) {
      case ORDER_STATUS.CANCELLED:
        statuses.push(this.createStatus('orders.detail.timeline.order_cancelled', statusDate, cancelledConfig.icon, cancelledConfig.color));
        break;

      case ORDER_STATUS.CONFIRMED:
      case ORDER_STATUS.ASSIGNED:
      case ORDER_STATUS.PICKED_UP:
      case ORDER_STATUS.IN_TRANSIT:
      case ORDER_STATUS.DELIVERED:
        statuses.push(this.createStatus('orders.detail.timeline.order_confirmed', statusDate, confirmedConfig.icon, confirmedConfig.color));

        if (order.status !== ORDER_STATUS.CONFIRMED) {
          statuses.push(this.createStatus('orders.detail.timeline.driver_assigned', statusDate, assignedConfig.icon, assignedConfig.color));

          if (order.status !== ORDER_STATUS.ASSIGNED) {
            statuses.push(this.createStatus('orders.detail.timeline.order_picked_up', statusDate, pickedUpConfig.icon, pickedUpConfig.color));

            if (order.status === ORDER_STATUS.IN_TRANSIT || order.status === ORDER_STATUS.DELIVERED) {
              statuses.push(this.createStatus('orders.detail.timeline.order_shipped', statusDate, inTransitConfig.icon, inTransitConfig.color));

              if (order.status === ORDER_STATUS.DELIVERED) {
                statuses.push(this.createStatus('orders.detail.timeline.order_delivered', statusDate, deliveredConfig.icon, deliveredConfig.color));
              }
            }
          }
        }
        break;
    }

    return statuses;
  }

  private createStatus(translationKey: string, date: string, icon: string, color: string): TimelineStatus {
    return {
      status: this.translateService.instant(translationKey),
      date,
      icon,
      color
    };
  }
}
