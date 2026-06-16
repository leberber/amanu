import { Component, inject, signal, computed, DestroyRef, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { PushService } from '../../services/push.service';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { ROUTES } from '../../core/constants/routes.constants';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';
import { LanguageSelectorComponent } from '../../components/language-selector/language-selector.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [TranslateModule, FormsModule, ToggleSwitch, PageLayoutComponent, LanguageSelectorComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit {
  private pushService = inject(PushService);
  private toast = inject(ToastMessageService);
  private destroyRef = inject(DestroyRef);

  readonly routes = ROUTES;

  notificationsEnabled = signal(false);
  loadingNotifications = signal(false);

  ngOnInit(): void {
    // Subscribe to push notification status
    this.pushService.isSubscribed$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(isSubscribed => {
        this.notificationsEnabled.set(isSubscribed);
      });
  }

  async toggleNotifications(): Promise<void> {
    this.loadingNotifications.set(true);
    try {
      // When onChange fires, notificationsEnabled() still has the OLD value
      // So if it's currently false, user wants to enable → subscribe
      // If it's currently true, user wants to disable → unsubscribe
      if (!this.notificationsEnabled()) {
        const result = await this.pushService.subscribe();
        if (result.success) {
          this.toast.showSuccess('settings.notifications_enabled');
        } else {
          // Show specific error message based on error type
          switch (result.error) {
            case 'service_worker_disabled':
              this.toast.showError('settings.notifications_not_supported');
              break;
            case 'permission_denied':
              this.toast.showError('settings.notifications_permission_denied');
              break;
            case 'vapid_error':
            case 'server_error':
              this.toast.showError('settings.notifications_server_error');
              break;
            default:
              this.toast.showError('settings.notifications_error');
          }
        }
      } else {
        await this.pushService.unsubscribe();
        this.toast.showInfo('settings.notifications_disabled');
      }
    } finally {
      this.loadingNotifications.set(false);
    }
  }
}
