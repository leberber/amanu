import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { ROUTES } from '../../core/constants/routes.constants';

@Component({
  selector: 'app-mobile-admin-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, DialogModule, ButtonModule, TranslateModule],
  template: `
    <p-dialog
      [(visible)]="visible"
      [modal]="true"
      [showHeader]="false"
      [style]="{width: '100vw'}"
      [baseZIndex]="10000"
      [draggable]="false"
      [resizable]="false"
      position="bottom">

      <div class="admin-menu-content">
        <div class="flex align-items-center justify-content-between mb-4 pb-3 border-bottom-1 surface-border">
          <h3 class="m-0 text-xl font-semibold">{{ 'header.admin' | translate }}</h3>
          <button
            pButton
            type="button"
            icon="pi pi-times"
            class="p-button-rounded p-button-text p-button-plain"
            (click)="hide()"></button>
        </div>

        <div class="menu-grid">
          <!-- Dashboard (Admin only) -->
          <a *ngIf="isAdmin()"
             [routerLink]="routes.ADMIN.DASHBOARD"
             (click)="hide()"
             class="menu-item">
            <i class="pi pi-chart-bar"></i>
            <span>{{ 'admin.navigation.dashboard' | translate }}</span>
          </a>

          <!-- Orders -->
          <a [routerLink]="routes.ADMIN.ORDERS"
             (click)="hide()"
             class="menu-item">
            <i class="pi pi-list"></i>
            <span>{{ 'admin.navigation.orders' | translate }}</span>
          </a>

          <!-- Products -->
          <a [routerLink]="routes.ADMIN.PRODUCTS"
             (click)="hide()"
             class="menu-item">
            <i class="pi pi-tag"></i>
            <span>{{ 'admin.navigation.products' | translate }}</span>
          </a>

          <!-- Categories -->
          <a [routerLink]="routes.ADMIN.CATEGORIES"
             (click)="hide()"
             class="menu-item">
            <i class="pi pi-tags"></i>
            <span>{{ 'admin.navigation.categories' | translate }}</span>
          </a>

          <!-- Brands -->
          <a [routerLink]="routes.ADMIN.BRANDS"
             (click)="hide()"
             class="menu-item">
            <i class="pi pi-building"></i>
            <span>{{ 'admin.navigation.brands' | translate }}</span>
          </a>

          <!-- Promotions -->
          <a [routerLink]="routes.ADMIN.PROMOTIONS"
             (click)="hide()"
             class="menu-item">
            <i class="pi pi-percentage"></i>
            <span>{{ 'admin.navigation.promotions' | translate }}</span>
          </a>

          <!-- Users (Admin only) -->
          <a *ngIf="isAdmin()"
             [routerLink]="routes.ADMIN.USERS"
             (click)="hide()"
             class="menu-item">
            <i class="pi pi-users"></i>
            <span>{{ 'admin.navigation.users' | translate }}</span>
          </a>

          <!-- Notifications (Admin only) -->
          <a *ngIf="isAdmin()"
             [routerLink]="routes.ADMIN.NOTIFICATIONS"
             (click)="hide()"
             class="menu-item">
            <i class="pi pi-bell"></i>
            <span>{{ 'admin.navigation.notifications' | translate }}</span>
          </a>
        </div>
      </div>
    </p-dialog>
  `,
  styles: [`
    :host ::ng-deep {
      .p-dialog-mask {
        background: rgba(255, 255, 255, 0.95) !important;
        backdrop-filter: blur(20px) !important;
        -webkit-backdrop-filter: blur(20px) !important;
      }

      .p-dialog {
        margin: 0 !important;
        border-radius: 1.5rem 1.5rem 0 0;
        overflow: hidden;
        width: 100vw !important;
        max-width: 100vw !important;
        left: 0 !important;
        right: 0 !important;
      }

      .p-dialog-content {
        padding: 0;
        border-radius: 1.5rem 1.5rem 0 0;
        overflow: hidden;
      }

      .p-dialog-wrapper {
        padding: 0 !important;
      }
    }

    .admin-menu-content {
      padding: 1.5rem;
      padding-bottom: calc(1.5rem + env(safe-area-inset-bottom));
    }

    .menu-grid {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .menu-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      border-radius: 12px;
      text-decoration: none;
      color: var(--text-color);
      transition: all 0.2s ease;
      font-weight: 500;
      background: var(--surface-ground);
    }

    .menu-item:hover {
      background: rgba(46, 108, 183, 0.1);
      color: var(--primary-color);
    }

    .menu-item i {
      font-size: 1.25rem;
      color: var(--primary-color);
      width: 24px;
      text-align: center;
    }
  `]
})
export class MobileAdminMenuComponent {
  private authService = inject(AuthService);
  visible = false;
  readonly routes = ROUTES;

  show() {
    this.visible = true;
  }

  hide() {
    this.visible = false;
  }

  isAdmin(): boolean {
    return this.authService.isAdmin();
  }
}
