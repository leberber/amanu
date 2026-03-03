import { Component, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ROUTES } from '../../core/constants/routes.constants';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { UserNotificationService } from '../../services/user-notification.service';
import { UserNotification } from '../../models/user-notification.model';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [DatePipe, TranslateModule, PageLayoutComponent, EmptyStateComponent],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss'
})
export class NotificationsComponent implements OnInit {
  private notificationService = inject(UserNotificationService);
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);

  readonly routes = ROUTES;

  notifications = signal<UserNotification[]>([]);
  loading = signal(true);
  error = signal(false);

  ngOnInit(): void {
    this.loadNotifications();
  }

  loadNotifications(): void {
    this.loading.set(true);
    this.error.set(false);

    this.notificationService.getNotifications(0, 50)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (notifications) => {
          this.notifications.set(notifications);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        }
      });
  }

  getNotificationIcon(type: string): string {
    const icons: Record<string, string> = {
      'order_confirmed': 'pi pi-check-circle',
      'order_shipped': 'pi pi-truck',
      'order_delivered': 'pi pi-box',
      'order_cancelled': 'pi pi-times-circle',
      'payment_received': 'pi pi-wallet',
      'promotion': 'pi pi-percentage',
      'system': 'pi pi-info-circle'
    };
    return icons[type] || 'pi pi-bell';
  }

  onNotificationClick(notification: UserNotification): void {
    // Mark as read if not already
    if (!notification.is_read) {
      this.notificationService.markAsRead(notification.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          // Update local state
          const updated = this.notifications().map(n =>
            n.id === notification.id ? { ...n, is_read: true } : n
          );
          this.notifications.set(updated);
        });
    }

    // Navigate if URL is provided
    if (notification.url) {
      this.router.navigateByUrl(notification.url);
    }
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const updated = this.notifications().map(n => ({ ...n, is_read: true }));
        this.notifications.set(updated);
      });
  }
}
