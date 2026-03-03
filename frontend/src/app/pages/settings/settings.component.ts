import { Component, inject, signal, computed, DestroyRef, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { UserPreferencesService, ViewMode } from '../../core/services/user-preferences.service';
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
  private preferencesService = inject(UserPreferencesService);
  private pushService = inject(PushService);
  private toast = inject(ToastMessageService);
  private destroyRef = inject(DestroyRef);

  readonly routes = ROUTES;

  currentViewMode = computed(() => this.preferencesService.productViewMode());
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

  setViewMode(mode: ViewMode): void {
    this.preferencesService.setProductViewMode(mode);
  }

  async toggleNotifications(): Promise<void> {
    this.loadingNotifications.set(true);
    try {
      if (this.notificationsEnabled()) {
        const success = await this.pushService.subscribe();
        if (success) {
          this.toast.showSuccess('settings.notifications_enabled');
        } else {
          this.notificationsEnabled.set(false);
          this.toast.showError('settings.notifications_error');
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
