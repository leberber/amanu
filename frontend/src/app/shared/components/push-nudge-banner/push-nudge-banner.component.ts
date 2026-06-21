import { Component, inject, OnInit, signal } from '@angular/core';
import { PushService } from '../../../services/push.service';
import { AuthService } from '../../../services/auth.service';

const DISMISSED_KEY = 'push_nudge_dismissed_at';
const COOLDOWN_DAYS = 7;

@Component({
  selector: 'app-push-nudge-banner',
  standalone: true,
  template: `
    @if (visible()) {
      <div class="push-nudge">
        <div class="push-nudge__icon">
          <i class="pi pi-bell"></i>
        </div>
        <p class="push-nudge__text">
          Activez les notifications pour suivre vos commandes en temps réel.
        </p>
        <div class="push-nudge__actions">
          <button class="push-nudge__enable" [disabled]="loading()" (click)="enable()">
            @if (loading()) {
              <i class="pi pi-spin pi-spinner"></i>
            } @else {
              Activer
            }
          </button>
          <button class="push-nudge__dismiss" (click)="dismiss()" aria-label="Fermer">
            <i class="pi pi-times"></i>
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    .push-nudge {
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      background: #1e293b;
      color: white;
      border-radius: 14px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.25);
      max-width: calc(100vw - 2rem);
      width: max-content;
      animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateX(-50%) translateY(12px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }

    .push-nudge__icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: rgba(255,255,255,0.12);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      i { font-size: 1rem; }
    }

    .push-nudge__text {
      margin: 0;
      font-size: 0.8rem;
      line-height: 1.4;
      color: rgba(255,255,255,0.9);
      max-width: 220px;
    }

    .push-nudge__actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    .push-nudge__enable {
      padding: 0.4rem 0.875rem;
      border: none;
      border-radius: 8px;
      background: #3b82f6;
      color: white;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
      min-width: 68px;

      &:hover:not(:disabled) { background: #2563eb; }
      &:disabled { opacity: 0.6; cursor: wait; }
    }

    .push-nudge__dismiss {
      width: 28px;
      height: 28px;
      border: none;
      border-radius: 50%;
      background: rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.7);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
      flex-shrink: 0;

      i { font-size: 0.7rem; }
      &:hover { background: rgba(255,255,255,0.2); }
    }

    @media (max-width: 480px) {
      .push-nudge {
        bottom: 76px;
        left: 1rem;
        right: 1rem;
        transform: none;
        width: auto;
      }

      @keyframes slideUp {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    }
  `]
})
export class PushNudgeBannerComponent implements OnInit {
  private pushService = inject(PushService);
  private authService = inject(AuthService);

  visible = signal(false);
  loading = signal(false);

  ngOnInit(): void {
    // Debug override: run `localStorage.setItem('debug_push_nudge','1')` in console to force-show
    if (localStorage.getItem('debug_push_nudge') === '1') {
      setTimeout(() => this.visible.set(true), 1000);
      return;
    }

    // Only for logged-in customers, not admin/staff/driver
    if (!this.authService.isLoggedIn || this.authService.isAdminOrStaff() || this.authService.isDriver()) {
      localStorage.setItem('push_nudge_blocked', 'not_customer'); return;
    }

    // Browser must support notifications
    if (typeof Notification === 'undefined') {
      localStorage.setItem('push_nudge_blocked', 'no_notification_api'); return;
    }

    // If the user explicitly denied, nothing we can do
    if (Notification.permission === 'denied') {
      localStorage.setItem('push_nudge_blocked', 'permission_denied'); return;
    }

    // Skip if dismissed recently
    const dismissedAt = localStorage.getItem(DISMISSED_KEY);
    if (dismissedAt) {
      const days = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
      if (days < COOLDOWN_DAYS) {
        localStorage.setItem('push_nudge_blocked', `dismissed_${Math.floor(days)}d_ago`); return;
      }
    }

    // Check via Push Manager whether an actual subscription exists.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg =>
        reg.pushManager.getSubscription().then(sub => {
          if (sub) {
            localStorage.setItem('push_nudge_blocked', 'already_subscribed');
          } else {
            localStorage.setItem('push_nudge_blocked', 'none_showing');
            setTimeout(() => this.visible.set(true), 3000);
          }
        })
      );
    } else if (Notification.permission === 'default') {
      localStorage.setItem('push_nudge_blocked', 'none_showing_no_sw');
      setTimeout(() => this.visible.set(true), 3000);
    } else {
      localStorage.setItem('push_nudge_blocked', 'no_sw_permission_granted');
    }
  }

  async enable(): Promise<void> {
    this.loading.set(true);
    await this.pushService.subscribe();
    this.loading.set(false);
    this.visible.set(false);
  }

  dismiss(): void {
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
    this.visible.set(false);
  }
}
