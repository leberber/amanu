// src/app/pages/admin/admin-notifications/admin-notifications.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-admin-notifications',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ToastModule,
    TranslateModule
  ],
  providers: [MessageService],
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
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService);
  private apiService = inject(ApiService);

  sendNotification(): void {
    if (!this.notificationTitle.trim() || !this.notificationBody.trim()) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translateService.instant('common.warning'),
        detail: this.translateService.instant('admin.notifications.empty_fields')
      });
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
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('common.success'),
          detail: this.translateService.instant('admin.notifications.sent_success', { count: response.sent })
        });
      },
      error: (error) => {
        this.sendingNotification = false;
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: error.error?.detail || this.translateService.instant('admin.notifications.sent_failed')
        });
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/admin']);
  }
}
