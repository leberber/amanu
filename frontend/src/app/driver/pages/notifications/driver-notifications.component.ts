import { Component, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { trigger, transition, style, animate } from '@angular/animations';
import { NOTIFICATION_TYPE_CONFIG } from '../../../core/constants/notification.constants';
import { UserNotificationService } from '../../../services/user-notification.service';
import { UserNotification } from '../../../models/user-notification.model';

@Component({
  selector: 'app-driver-notifications',
  standalone: true,
  imports: [DatePipe, TranslateModule],
  templateUrl: './driver-notifications.component.html',
  styleUrl: './driver-notifications.component.scss',
  animations: [
    trigger('pageAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class DriverNotificationsComponent implements OnInit {
  private notificationService = inject(UserNotificationService);
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);

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

  goBack(): void {
    this.router.navigate(['/driver']);
  }
}
