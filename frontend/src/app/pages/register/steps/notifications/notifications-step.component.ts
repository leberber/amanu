import { Component, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { PushService } from '../../../../services/push.service';

@Component({
  selector: 'app-notifications-step',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="slide-header">
      <div class="icon-wrapper" style="background: rgba(99, 102, 241, 0.08);">
        <div class="icon-bg" style="background: rgba(99, 102, 241, 0.12);"></div>
        <div class="icon-circle" style="background: linear-gradient(135deg, #6366f1, #4f46e5);">
          <i class="pi pi-bell"></i>
        </div>
      </div>
      <h1>{{ 'register.notifications_title' | translate }}</h1>
      <p>{{ 'register.notifications_subtitle' | translate }}</p>
    </div>

    <div class="summary-cards">
      <div class="summary-card" style="cursor: default; pointer-events: none;">
        <div class="card-icon"><i class="pi pi-truck"></i></div>
        <div class="card-info">
          <span class="card-value">{{ 'register.notif_orders' | translate }}</span>
        </div>
      </div>
      <div class="summary-card" style="cursor: default; pointer-events: none;">
        <div class="card-icon"><i class="pi pi-tag"></i></div>
        <div class="card-info">
          <span class="card-value">{{ 'register.notif_promos' | translate }}</span>
        </div>
      </div>
      <div class="summary-card" style="cursor: default; pointer-events: none;">
        <div class="card-icon"><i class="pi pi-info-circle"></i></div>
        <div class="card-info">
          <span class="card-value">{{ 'register.notif_updates' | translate }}</span>
        </div>
      </div>
    </div>

    <div class="step-actions" style="display: flex; flex-direction: column; gap: 0.75rem; padding: 0 1.5rem 2rem;">
      <button class="register-btn" [disabled]="loading()" (click)="enable()">
        @if (loading()) {
          <i class="pi pi-spin pi-spinner"></i>
        } @else {
          <i class="pi pi-bell"></i>
          <span>{{ 'register.notif_enable' | translate }}</span>
        }
      </button>
      <button class="skip-btn" [disabled]="loading()" (click)="skip()">
        {{ 'register.notif_skip' | translate }}
      </button>
    </div>
  `,
  styles: [`
    .skip-btn {
      background: transparent;
      border: none;
      color: var(--text-color-secondary);
      font-size: 0.9rem;
      padding: 0.75rem;
      cursor: pointer;
      border-radius: var(--border-radius);
      transition: color 0.2s;
      &:hover { color: var(--text-color); }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }
  `],
  styleUrls: ['../_shared-styles.scss']
})
export class NotificationsStepComponent {
  private pushService = inject(PushService);

  loading = signal(false);
  done = output<void>();

  async enable(): Promise<void> {
    this.loading.set(true);
    await this.pushService.subscribe();
    this.loading.set(false);
    this.done.emit();
  }

  skip(): void {
    this.done.emit();
  }
}
