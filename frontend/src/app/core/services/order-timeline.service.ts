import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ORDER_STATUS, TIMELINE_COLORS } from '../constants/app.constants';
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

  generateTimeline(order: Order): TimelineStatus[] {
    const statuses: TimelineStatus[] = [
      this.createStatus('orders.detail.timeline.order_placed', order.created_at, 'pi pi-shopping-cart', TIMELINE_COLORS.PLACED)
    ];

    const statusDate = order.updated_at || order.created_at;

    switch (order.status) {
      case ORDER_STATUS.CANCELLED:
        statuses.push(this.createStatus('orders.detail.timeline.order_cancelled', statusDate, 'pi pi-times', TIMELINE_COLORS.CANCELLED));
        break;

      case ORDER_STATUS.CONFIRMED:
      case ORDER_STATUS.SHIPPED:
      case ORDER_STATUS.DELIVERED:
        statuses.push(this.createStatus('orders.detail.timeline.order_confirmed', statusDate, 'pi pi-check-circle', TIMELINE_COLORS.CONFIRMED));

        if (order.status === ORDER_STATUS.SHIPPED || order.status === ORDER_STATUS.DELIVERED) {
          statuses.push(this.createStatus('orders.detail.timeline.order_shipped', statusDate, 'pi pi-truck', TIMELINE_COLORS.SHIPPED));

          if (order.status === ORDER_STATUS.DELIVERED) {
            statuses.push(this.createStatus('orders.detail.timeline.order_delivered', statusDate, 'pi pi-check-square', TIMELINE_COLORS.DELIVERED));
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
