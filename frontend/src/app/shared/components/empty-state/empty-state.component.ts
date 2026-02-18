import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, TranslateModule, ButtonModule, RouterLink],
  template: `
    <div class="empty-state">
      <div class="empty-icon-wrapper">
        <div class="empty-icon-bg"></div>
        <div class="empty-icon-circle">
          <i [class]="'pi ' + icon"></i>
        </div>
      </div>

      <h2>{{ title | translate }}</h2>

      <p *ngIf="description">{{ description | translate }}</p>

      <!-- Action button with router link -->
      <a
        *ngIf="actionLabel && actionLink"
        [routerLink]="actionLink"
        class="action-btn">
        <i [class]="actionIcon"></i>
        <span>{{ actionLabel | translate }}</span>
      </a>

      <!-- Action button with click handler -->
      <button
        *ngIf="actionLabel && action && !actionLink"
        (click)="onActionClick()"
        class="action-btn">
        <i [class]="actionIcon"></i>
        <span>{{ actionLabel | translate }}</span>
      </button>

      <!-- Custom action via content projection -->
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    .empty-state {
      text-align: center;
      padding: 2.5rem 2rem;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 24px;
      border: 1px solid rgba(15, 60, 130, 0.1);
      max-width: 420px;
      margin: 2rem auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
      position: relative;
      overflow: hidden;
    }

    .empty-state::before {
      content: '';
      position: absolute;
      top: -50px;
      right: -50px;
      width: 200px;
      height: 200px;
      background: radial-gradient(circle, rgba(46, 108, 183, 0.08) 0%, transparent 70%);
      pointer-events: none;
    }

    .empty-state::after {
      content: '';
      position: absolute;
      bottom: -30px;
      left: -30px;
      width: 150px;
      height: 150px;
      background: radial-gradient(circle, rgba(34, 197, 94, 0.06) 0%, transparent 70%);
      pointer-events: none;
    }

    .empty-icon-wrapper {
      position: relative;
      width: 100px;
      height: 100px;
      margin: 0 auto 1.5rem;
    }

    .empty-icon-bg {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: linear-gradient(135deg, rgba(46, 108, 183, 0.15) 0%, rgba(30, 79, 154, 0.2) 100%);
      animation: pulse 3s ease-in-out infinite;
    }

    .empty-icon-circle {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 70px;
      height: 70px;
      border-radius: 50%;
      background: linear-gradient(135deg, #2E6CB7 0%, #0F3C82 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 35px rgba(46, 108, 183, 0.4);
    }

    .empty-icon-circle i {
      font-size: 1.75rem;
      color: white;
    }

    @keyframes pulse {
      0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      50% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.7; }
    }

    h2 {
      font-size: 1.1rem;
      font-weight: 700;
      color: #1a1a1a;
      margin: 0 0 0.5rem 0;
      position: relative;
    }

    p {
      color: var(--text-color-secondary);
      margin: 0 0 1.5rem 0;
      font-size: 0.9rem;
      line-height: 1.5;
      position: relative;
    }

    .action-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.875rem 1.5rem;
      border: none;
      border-radius: 12px;
      background: linear-gradient(135deg, #2E6CB7 0%, #0F3C82 100%);
      color: #ffffff !important;
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 6px 20px rgba(46, 108, 183, 0.3);
      text-decoration: none;
      position: relative;
    }

    .action-btn span,
    .action-btn i {
      color: #ffffff !important;
    }

    .action-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(46, 108, 183, 0.4);
    }

    .action-btn i {
      font-size: 0.9rem;
    }
  `]
})
export class EmptyStateComponent {
  @Input() icon = 'pi-inbox';
  @Input() title = 'common.no_data';
  @Input() description?: string;
  @Input() actionLabel?: string;
  @Input() actionLink?: string | any[];
  @Input() actionIcon = 'pi pi-plus';
  @Input() action?: () => void;

  onActionClick(): void {
    if (this.action) {
      this.action();
    }
  }
}
