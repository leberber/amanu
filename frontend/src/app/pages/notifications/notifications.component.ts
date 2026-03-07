import { Component, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ROUTES } from '../../core/constants/routes.constants';
import { NOTIFICATION_TYPE_CONFIG } from '../../core/constants/notification.constants';
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
    this.notificationService.refreshUnreadCount();
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
    const config = NOTIFICATION_TYPE_CONFIG[type as keyof typeof NOTIFICATION_TYPE_CONFIG];
    return config?.icon || 'pi pi-bell';
  }

  onNotificationClick(notification: UserNotification): void {
    const navigate = () => {
      if (notification.url) {
        this.router.navigateByUrl(notification.url);
      }
    };

    if (!notification.is_read) {
      this.notificationService.markAsRead(notification.id).subscribe({
        next: () => {
          const updated = this.notifications().map(n =>
            n.id === notification.id ? { ...n, is_read: true } : n
          );
          this.notifications.set(updated);
          navigate();
        },
        error: () => navigate()
      });
    } else {
      navigate();
    }
  }

  onDeleteClick(event: Event, notification: UserNotification): void {
    event.stopPropagation();

    this.notificationService.deleteNotification(notification.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const updated = this.notifications().filter(n => n.id !== notification.id);
        this.notifications.set(updated);
      });
  }
}
