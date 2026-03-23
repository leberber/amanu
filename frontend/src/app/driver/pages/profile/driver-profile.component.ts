import { Component, inject, OnInit, signal, computed, DestroyRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { DriverService } from '../../../services/driver.service';
import { AuthService } from '../../../services/auth.service';
import { PushService } from '../../../services/push.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { ROUTES } from '../../../core/constants/routes.constants';
import { DRIVER_STATUS, DRIVER_STATUS_CONFIG } from '../../../core/constants/driver.constants';

@Component({
  selector: 'app-driver-profile',
  standalone: true,
  imports: [TranslateModule, RouterLink],
  templateUrl: './driver-profile.component.html',
  styleUrl: './driver-profile.component.scss'
})
export class DriverProfileComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly driverService = inject(DriverService);
  private readonly authService = inject(AuthService);
  private readonly pushService = inject(PushService);
  private readonly toast = inject(ToastMessageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly DRIVER_STATUS = DRIVER_STATUS;
  readonly driverStatusConfig = DRIVER_STATUS_CONFIG;

  // State from service
  profile = this.driverService.profile;
  driverProfile = this.driverService.driverProfile;
  stats = this.driverService.stats;
  loading = signal(true);
  notificationsEnabled = signal(false);
  loadingNotifications = signal(false);

  // Computed
  isOnline = computed(() => {
    const status = this.driverProfile()?.status;
    return status === DRIVER_STATUS.AVAILABLE || status === DRIVER_STATUS.BUSY;
  });

  ngOnInit(): void {
    this.loadProfile();

    // Subscribe to real push notification status
    this.pushService.isSubscribed$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(isSubscribed => {
        this.notificationsEnabled.set(isSubscribed);
      });
  }

  async toggleNotifications(): Promise<void> {
    this.loadingNotifications.set(true);
    try {
      if (!this.notificationsEnabled()) {
        const result = await this.pushService.subscribe();
        if (result.success) {
          this.toast.showSuccess('driver.messages.notifications_enabled');
        } else {
          switch (result.error) {
            case 'permission_denied':
              this.toast.showError('settings.notifications_permission_denied');
              break;
            default:
              this.toast.showError('settings.notifications_error');
          }
        }
      } else {
        await this.pushService.unsubscribe();
        this.toast.showInfo('driver.messages.notifications_disabled');
      }
    } finally {
      this.loadingNotifications.set(false);
    }
  }

  loadProfile(): void {
    this.loading.set(true);
    this.driverService.getDriverProfile().subscribe({
      next: () => {
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  getStatusLabel(): string {
    const status = this.driverProfile()?.status || DRIVER_STATUS.OFFLINE;
    return this.driverStatusConfig[status as keyof typeof this.driverStatusConfig]?.label || status;
  }

  getStatusColor(): string {
    const status = this.driverProfile()?.status || DRIVER_STATUS.OFFLINE;
    return this.driverStatusConfig[status as keyof typeof this.driverStatusConfig]?.color || '#6b7280';
  }

  toggleStatus(): void {
    const current = this.driverProfile()?.status;
    if (current === DRIVER_STATUS.AVAILABLE) {
      this.driverService.goOffline().subscribe();
    } else if (current === DRIVER_STATUS.OFFLINE) {
      this.driverService.goOnline().subscribe();
    }
  }

  editProfile(): void {
    // TODO: Implement profile editing
    this.toast.showInfo('driver.messages.feature_coming_soon');
  }

  viewDocuments(): void {
    // TODO: Implement documents page
    this.toast.showInfo('driver.messages.feature_coming_soon');
  }

  viewSettings(): void {
    // TODO: Implement settings page
    this.toast.showInfo('driver.messages.feature_coming_soon');
  }

  contactSupport(): void {
    // Open phone dialer or messaging
    window.location.href = 'tel:+213123456789';
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate([ROUTES.LOGIN]);
  }
}
