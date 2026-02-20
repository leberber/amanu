import { Component, inject, OnInit, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { onLanguageChange } from '../../core/utils/language-change.util';
import { AuthService } from '../../services/auth.service';
import { LanguageSelectorComponent } from '../language-selector/language-selector.component';
import { UserPreferencesService, ViewMode } from '../../core/services/user-preferences.service';

interface NavItem {
  label: string;
  icon: string;
  routerLink: string;
}

interface SettingItem {
  id: string;
  label: string;
  icon: string;
  type: 'toggle' | 'select';
  options?: { value: string; label: string; icon: string }[];
  getValue: () => string;
  onToggle?: () => void;
}

@Component({
  selector: 'app-mobile-user-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, DrawerModule, ButtonModule, TranslateModule, LanguageSelectorComponent],
  template: `
    <p-drawer
      [(visible)]="visible"
      position="full"
      [showCloseIcon]="false"
      [modal]="false"
      styleClass="mobile-menu-drawer">

      <ng-template pTemplate="headless">
        <div class="drawer-container">
          <!-- Animated Background -->
          <div class="drawer-bg-decoration">
            <div class="drawer-blob drawer-blob-1"></div>
            <div class="drawer-blob drawer-blob-2"></div>
            <div class="drawer-blob drawer-blob-3"></div>
          </div>

          <div class="drawer-content">
            <!-- Drawer Header -->
            <div class="drawer-header">
              <img src="/logo.png" alt="AgroClik" class="drawer-logo">
              <div class="drawer-header-actions">
                <app-language-selector></app-language-selector>
                <a *ngIf="authService.isLoggedIn" routerLink="/account" class="drawer-profile-btn" (click)="hide()">
                  <i class="pi pi-user"></i>
                </a>
                <button class="drawer-close-btn" (click)="hide()">
                  <i class="pi pi-times"></i>
                </button>
              </div>
            </div>

            <!-- Scrollable content area -->
            <div class="drawer-scrollable">
              <!-- Navigation Items -->
              <div class="drawer-nav-section">
                <a
                  *ngFor="let item of navItems"
                  [routerLink]="item.routerLink"
                  (click)="hide()"
                  class="drawer-nav-item">
                  <div class="nav-icon">
                    <i [class]="item.icon"></i>
                  </div>
                  <span class="nav-label">{{ item.label }}</span>
                  <i class="pi pi-chevron-right nav-arrow"></i>
                </a>
              </div>

              <!-- Settings Section -->
              <div class="drawer-settings-section">
                <div class="settings-header">
                  <i class="pi pi-sliders-h"></i>
                  <span>{{ 'settings.title' | translate }}</span>
                </div>

                <div class="settings-list">
                  <div *ngFor="let setting of settingItems" class="setting-item">
                    <div class="setting-info">
                      <i [class]="setting.icon"></i>
                      <span>{{ setting.label }}</span>
                    </div>

                    <!-- Toggle type with options -->
                    <div *ngIf="setting.type === 'toggle' && setting.options" class="setting-toggle">
                      <button
                        *ngFor="let option of setting.options"
                        class="toggle-option"
                        [class.active]="setting.getValue() === option.value"
                        (click)="setting.onToggle && setting.onToggle()">
                        <i [class]="option.icon"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- User Section - Only show login buttons when not logged in -->
            <div class="drawer-user-section" *ngIf="!authService.isLoggedIn">
              <div class="login-card">
                <div class="login-header">
                  <div class="login-icon-wrapper">
                    <div class="login-icon-bg"></div>
                    <div class="login-icon-circle">
                      <i class="pi pi-user"></i>
                    </div>
                  </div>
                  <h3>{{ 'auth.welcome' | translate }}</h3>
                  <p>{{ 'auth.signInMessage' | translate }}</p>
                </div>

                <div class="login-actions">
                  <a routerLink="/login" class="mobile-auth-btn primary" (click)="hide()">
                    <span>{{ 'common.login' | translate }}</span>
                    <div class="btn-icon">
                      <i class="pi pi-sign-in"></i>
                    </div>
                  </a>
                  <a routerLink="/register" class="mobile-auth-btn outlined" (click)="hide()">
                    <i class="pi pi-user-plus"></i>
                    <span>{{ 'common.register' | translate }}</span>
                  </a>
                </div>
              </div>
            </div>

            <!-- Logout button when logged in -->
            <div class="drawer-logout-section" *ngIf="authService.isLoggedIn">
              <button class="logout-btn" (click)="logout()">
                <i class="pi pi-sign-out"></i>
                <span>{{ 'common.logout' | translate }}</span>
              </button>
            </div>
          </div>
        </div>
      </ng-template>
    </p-drawer>
  `,
  styles: [`
    :host ::ng-deep {
      .mobile-menu-drawer {
        .p-drawer-content {
          padding: 0 !important;
          background: transparent !important;
        }
      }
    }

    .drawer-container {
      position: relative;
      width: 100%;
      height: 100%;
      background: white;
      overflow: hidden;
    }

    // Animated Background Blobs
    .drawer-bg-decoration {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      overflow: hidden;
      pointer-events: none;
      z-index: 0;
    }

    .drawer-blob {
      position: absolute;
      border-radius: 50%;
      filter: blur(60px);
      opacity: 0.5;
      animation: drawerFloat 20s ease-in-out infinite;

      &.drawer-blob-1 {
        width: 300px;
        height: 300px;
        background: linear-gradient(135deg, rgba(46, 108, 183, 0.4) 0%, rgba(15, 60, 130, 0.4) 100%);
        top: 12%;
        right: -100px;
        animation-delay: 0s;
      }

      &.drawer-blob-2 {
        width: 250px;
        height: 250px;
        background: linear-gradient(135deg, rgba(17, 153, 142, 0.3) 0%, rgba(56, 239, 125, 0.3) 100%);
        bottom: 15%;
        left: -80px;
        animation-delay: -7s;
      }

      &.drawer-blob-3 {
        width: 200px;
        height: 200px;
        background: linear-gradient(135deg, rgba(255, 154, 158, 0.3) 0%, rgba(250, 208, 196, 0.3) 100%);
        bottom: -50px;
        right: 20%;
        animation-delay: -14s;
      }
    }

    @keyframes drawerFloat {
      0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
      25% { transform: translate(15px, -20px) rotate(5deg) scale(1.05); }
      50% { transform: translate(-15px, 15px) rotate(-5deg) scale(0.95); }
      75% { transform: translate(20px, 8px) rotate(3deg) scale(1.02); }
    }

    // Drawer Content
    .drawer-content {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 1.25rem;
      padding-top: calc(1.25rem + env(safe-area-inset-top, 0px));
      padding-bottom: calc(1.25rem + env(safe-area-inset-bottom, 0px));
    }

    // Drawer Header
    .drawer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 2rem;
    }

    .drawer-logo {
      height: 50px;
      width: auto;
      object-fit: contain;
    }

    .drawer-header-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .drawer-profile-btn {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      border: none;
      background: linear-gradient(135deg, #2E6CB7 0%, #0F3C82 100%);
      box-shadow: 0 4px 12px rgba(46, 108, 183, 0.3);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      text-decoration: none;

      i {
        font-size: 1.1rem;
        color: white !important;
      }

      &:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 16px rgba(46, 108, 183, 0.4);
      }

      &:active {
        transform: scale(0.95);
      }
    }

    .drawer-close-btn {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      border: none;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(10px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;

      i {
        font-size: 1.1rem;
        color: var(--text-color);
      }

      &:hover {
        background: white;
        transform: scale(1.05);
      }

      &:active {
        transform: scale(0.95);
      }
    }

    // Scrollable content area
    .drawer-scrollable {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
    }

    // Navigation Section
    .drawer-nav-section {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
      padding: 0.5rem;
    }

    // Settings Section
    .drawer-settings-section {
      margin-bottom: 1.5rem;
      padding: 0 0.5rem;
    }

    .settings-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      margin-bottom: 0.75rem;
      color: var(--text-color-secondary);
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;

      i {
        font-size: 0.85rem;
      }
    }

    .settings-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .setting-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.25rem;
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-radius: 16px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
      border: 1px solid rgba(46, 108, 183, 0.08);
    }

    .setting-info {
      display: flex;
      align-items: center;
      gap: 0.875rem;

      i {
        font-size: 1.1rem;
        color: var(--primary-color);
      }

      span {
        font-size: 0.95rem;
        font-weight: 500;
        color: var(--text-color);
      }
    }

    .setting-toggle {
      display: flex;
      background: var(--surface-100);
      border-radius: 10px;
      padding: 3px;
      gap: 2px;
    }

    .toggle-option {
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: var(--text-color-secondary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;

      i {
        font-size: 1rem;
      }

      &:hover:not(.active) {
        background: var(--surface-200);
        color: var(--text-color);
      }

      &.active {
        background: white;
        color: var(--primary-color);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }
    }

    .drawer-nav-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.125rem 1.25rem;
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-radius: 18px;
      text-decoration: none;
      color: var(--text-color);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
      border: 1px solid rgba(46, 108, 183, 0.08);

      &:hover, &:active {
        background: white;
        transform: translateX(6px);
        box-shadow: 0 6px 20px rgba(46, 108, 183, 0.12);
        border-color: rgba(46, 108, 183, 0.15);

        .nav-icon {
          background: linear-gradient(135deg, #2E6CB7 0%, #0F3C82 100%);
          box-shadow: 0 4px 12px rgba(46, 108, 183, 0.3);
          i { color: white; }
        }

        .nav-arrow {
          opacity: 1;
          transform: translateX(0);
          color: var(--primary-color);
        }
      }
    }

    .nav-icon {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      background: linear-gradient(135deg, rgba(46, 108, 183, 0.1) 0%, rgba(15, 60, 130, 0.1) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all 0.3s ease;

      i {
        font-size: 1.25rem;
        color: var(--primary-color);
        transition: color 0.3s ease;
      }
    }

    .nav-label {
      flex: 1;
      font-size: 1.05rem;
      font-weight: 600;
      letter-spacing: -0.01em;
    }

    .nav-arrow {
      font-size: 0.9rem;
      color: var(--text-color-secondary);
      opacity: 0.4;
      transform: translateX(-4px);
      transition: all 0.3s ease;
    }

    // User Section
    .drawer-user-section {
      margin-top: auto;
      padding: 0.5rem;
    }

    // Logout Section
    .drawer-logout-section {
      margin-top: auto;
      padding: 0.5rem;

      .logout-btn {
        width: 100%;
        padding: 1.125rem 1.5rem;
        border: none;
        border-radius: 16px;
        background: rgba(239, 68, 68, 0.08);
        color: #dc2626;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border: 1px solid rgba(239, 68, 68, 0.1);

        &:hover, &:active {
          background: rgba(239, 68, 68, 0.12);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15);
        }

        i {
          font-size: 1.15rem;
        }
      }
    }

    // Login Card
    .login-card {
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-radius: 24px;
      padding: 2rem 1.5rem;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
      border: 1px solid rgba(46, 108, 183, 0.08);

      .login-header {
        text-align: center;
        margin-bottom: 1.75rem;

        h3 {
          font-size: 1.35rem;
          font-weight: 700;
          margin: 0 0 0.5rem 0;
          color: var(--text-color);
          letter-spacing: -0.01em;
        }

        p {
          font-size: 0.95rem;
          color: var(--text-color-secondary);
          margin: 0;
          line-height: 1.4;
        }
      }

      .login-icon-wrapper {
        position: relative;
        width: 80px;
        height: 80px;
        margin: 0 auto 1.25rem;
      }

      .login-icon-bg {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: linear-gradient(135deg, rgba(46, 108, 183, 0.15) 0%, rgba(30, 79, 154, 0.15) 100%);
        animation: loginPulse 3s ease-in-out infinite;
      }

      .login-icon-circle {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 58px;
        height: 58px;
        border-radius: 50%;
        background: linear-gradient(135deg, #2E6CB7 0%, #0F3C82 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 8px 28px rgba(46, 108, 183, 0.4);

        i {
          font-size: 1.6rem;
          color: white;
        }
      }

      .login-actions {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
    }

    @keyframes loginPulse {
      0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.7; }
    }

    // Mobile auth buttons
    .mobile-auth-btn {
      width: 100%;
      padding: 1rem 1.5rem;
      border: none;
      border-radius: 16px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      text-decoration: none;

      &.primary {
        background: linear-gradient(135deg, #2E6CB7 0%, #0F3C82 100%);
        color: white !important;
        box-shadow: 0 6px 20px rgba(46, 108, 183, 0.35);

        span, i {
          color: white !important;
        }

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(46, 108, 183, 0.45);
          color: white !important;
        }

        .btn-icon {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.3s ease;

          i {
            font-size: 0.85rem;
            color: white !important;
          }
        }

        &:hover .btn-icon {
          transform: translateX(3px);
        }
      }

      &.outlined {
        background: rgba(255, 255, 255, 0.8);
        color: var(--primary-color);
        border: 2px solid rgba(46, 108, 183, 0.25);
        backdrop-filter: blur(10px);

        &:hover {
          background: rgba(46, 108, 183, 0.08);
          border-color: var(--primary-color);
          transform: translateY(-2px);
        }

        i {
          font-size: 1rem;
        }
      }

      &:active {
        transform: translateY(0);
      }
    }

    /* Dark theme support */
    :host-context(.my-app-dark) {
      .drawer-container {
        background: #1a1a1a;
      }

      .drawer-nav-item {
        background: rgba(30, 30, 30, 0.9);
        border-color: rgba(255, 255, 255, 0.08);
      }

      .login-card {
        background: rgba(30, 30, 30, 0.9);
        border-color: rgba(255, 255, 255, 0.08);
      }

      .setting-item {
        background: rgba(30, 30, 30, 0.9);
        border-color: rgba(255, 255, 255, 0.08);
      }

      .setting-toggle {
        background: rgba(50, 50, 50, 0.9);
      }

      .toggle-option.active {
        background: #333;
      }
    }
  `]
})
export class MobileUserMenuComponent implements OnInit {
  authService = inject(AuthService);
  private translateService = inject(TranslateService);
  private preferencesService = inject(UserPreferencesService);
  private destroyRef = inject(DestroyRef);

  visible = false;
  navItems: NavItem[] = [];
  settingItems: SettingItem[] = [];

  // Computed for reactive view mode
  currentViewMode = computed(() => this.preferencesService.productViewMode());

  ngOnInit() {
    this.updateNavItems();
    this.updateSettingItems();
    onLanguageChange(this.translateService, this.destroyRef, () => {
      this.updateNavItems();
      this.updateSettingItems();
    });
  }

  private updateSettingItems() {
    this.settingItems = [
      {
        id: 'viewMode',
        label: this.translateService.instant('settings.view_mode'),
        icon: 'pi pi-eye',
        type: 'toggle',
        options: [
          { value: 'list', label: this.translateService.instant('products.view.list'), icon: 'pi pi-list' },
          { value: 'grid', label: this.translateService.instant('products.view.grid'), icon: 'pi pi-th-large' }
        ],
        getValue: () => this.preferencesService.productViewMode(),
        onToggle: () => this.preferencesService.toggleProductViewMode()
      }
      // Add more settings here in the future:
      // {
      //   id: 'theme',
      //   label: 'Theme',
      //   icon: 'pi pi-sun',
      //   type: 'toggle',
      //   options: [...]
      // }
    ];
  }

  private updateNavItems() {
    this.navItems = [
      {
        label: this.translateService.instant('common.products'),
        icon: 'pi pi-shopping-bag',
        routerLink: '/products'
      }
    ];

    if (this.authService.isLoggedIn) {
      this.navItems.push({
        label: this.translateService.instant('header.orders'),
        icon: 'pi pi-list',
        routerLink: '/orders'
      });

      this.navItems.push({
        label: this.translateService.instant('account.title'),
        icon: 'pi pi-user',
        routerLink: '/account'
      });
    }

    if (this.authService.isAdminOrStaff()) {
      this.navItems.push({
        label: this.translateService.instant('header.admin'),
        icon: 'pi pi-cog',
        routerLink: '/admin'
      });
    }
  }

  show() {
    this.updateNavItems();
    this.visible = true;
  }

  hide() {
    this.visible = false;
  }

  logout() {
    this.authService.logout();
    this.hide();
  }
}
