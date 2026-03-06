import { Component, inject } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CrossSellNotificationService } from '../../../core/services/cross-sell-notification.service';

@Component({
  selector: 'app-cross-sell-notification',
  standalone: true,
  imports: [TranslateModule],
  template: `
    @if (notificationService.isVisible() && notificationService.currentNotification(); as notification) {
      <div
        class="cross-sell-notification"
        [@slideDown]
        [class.cross-sell-notification--earned]="notification.type === 'discount_earned'">

        <div class="cross-sell-notification__content">
          <i class="pi" [class.pi-percentage]="notification.type === 'potential_discount'"
             [class.pi-check-circle]="notification.type === 'discount_earned'"></i>
          <span class="cross-sell-notification__text">
            @if (notification.type === 'potential_discount') {
              {{ getDiscountText(notification) }}
            } @else {
              {{ getSavingsText(notification) }}
            }
          </span>
        </div>

        <button
          class="cross-sell-notification__dismiss"
          (click)="dismiss()"
          type="button"
          aria-label="Dismiss">
          <i class="pi pi-times"></i>
        </button>
      </div>
    }
  `,
  styleUrl: './cross-sell-notification.component.scss',
  animations: [
    trigger('slideDown', [
      transition(':enter', [
        style({ transform: 'translateY(-100%)', opacity: 0 }),
        animate('300ms ease-out', style({ transform: 'translateY(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('250ms ease-in', style({ transform: 'translateY(-100%)', opacity: 0 }))
      ])
    ])
  ]
})
export class CrossSellNotificationComponent {
  readonly notificationService = inject(CrossSellNotificationService);
  private readonly translate = inject(TranslateService);

  getDiscountText(notification: any): string {
    const discountText = notification.discountType === 'percentage'
      ? `${notification.discountValue}%`
      : this.notificationService.formatCurrency(notification.discountValue); // fixed_amount

    const triggers = notification.triggerProductNames.slice(0, 2).join(', ');
    const more = notification.triggerProductNames.length > 2
      ? ` +${notification.triggerProductNames.length - 2}`
      : '';

    return this.translate.instant('cross_sell.potential_discount', {
      discount: discountText,
      triggers: triggers + more
    });
  }

  getSavingsText(notification: any): string {
    const savings = this.notificationService.formatCurrency(notification.savingsAmount || 0);
    return this.translate.instant('cross_sell.discount_earned', {
      savings,
      target: notification.targetProductName
    });
  }

  dismiss(): void {
    this.notificationService.dismiss();
  }
}
