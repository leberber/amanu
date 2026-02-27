import { Component, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ROUTES } from '../../core/constants/routes.constants';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

interface UserNotification {
  id: number;
  type: 'order' | 'promotion' | 'system';
  title: string;
  message: string;
  date: Date;
  read: boolean;
  link?: string;
}

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [DatePipe, TranslateModule, PageLayoutComponent, EmptyStateComponent],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss'
})
export class NotificationsComponent {
  readonly routes = ROUTES;

  notifications = signal<UserNotification[]>([]);

  getNotificationIcon(type: string): string {
    const icons: Record<string, string> = {
      'order': 'pi pi-shopping-bag',
      'promotion': 'pi pi-percentage',
      'system': 'pi pi-info-circle'
    };
    return icons[type] || 'pi pi-bell';
  }
}
