// src/app/pages/admin/admin-notifications/admin-notifications.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ToastModule } from 'primeng/toast';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ROUTES } from '../../../core/constants/routes.constants';
import { ApiService } from '../../../services/api.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';

@Component({
  selector: 'app-admin-notifications',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ToastModule,
    TranslateModule
  ],
    templateUrl: './admin-notifications.component.html',
  styleUrl: './admin-notifications.component.scss'
})
export class AdminNotificationsComponent {
  notificationTitle = '';
  notificationBody = '';
  sendingNotification = false;
  titleFocused = false;
  bodyFocused = false;

  private router = inject(Router);
  private toast = inject(ToastMessageService);
  private translateService = inject(TranslateService);
  private apiService = inject(ApiService);

  sendNotification(): void {
    if (!this.notificationTitle.trim() || !this.notificationBody.trim()) {
      this.toast.showWarn('admin.notifications.empty_fields');
      return;
    }

    this.sendingNotification = true;
    this.apiService.post<any>('/push/send', {
      title: this.notificationTitle,
      body: this.notificationBody,
      url: '/'
    }).subscribe({
      next: (response) => {
        this.sendingNotification = false;
        this.notificationTitle = '';
        this.notificationBody = '';
        this.toast.showSuccess('admin.notifications.sent_success', { count: response.sent });
      },
      error: (error) => {
        this.sendingNotification = false;
        this.toast.showApiError(error, 'admin.notifications.sent_failed');
      }
    });
  }

  goBack(): void {
    this.router.navigate([ROUTES.ADMIN.BASE]);
  }
}
