import { Component, inject, OnInit, computed, signal, DestroyRef, effect } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DrawerModule } from 'primeng/drawer';
import { TooltipModule } from 'primeng/tooltip';
import { filter } from 'rxjs/operators';

import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { SidebarService } from '../../services/sidebar.service';
import { UserNotificationService } from '../../services/user-notification.service';
import { LanguageSelectorComponent } from '../language-selector/language-selector.component';
import { UserPreferencesService } from '../../core/services/user-preferences.service';
import { onLanguageChange } from '../../core/utils/language-change.util';
import { ROUTES } from '../../core/constants/routes.constants';
import { ADMIN_NAV_ITEMS } from '../../core/constants/navigation.constants';
import { BreakpointService } from '../../core/services/breakpoint.service';
import { getInitials } from '../../core/utils/format.util';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  badge?: number;
  adminOnly?: boolean;
  staffOnly?: boolean;
  authRequired?: boolean;
  hideForAdmin?: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslateModule, DrawerModule, TooltipModule, LanguageSelectorComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent implements OnInit {
  // Services
  authService = inject(AuthService);
  private cartService = inject(CartService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private translateService = inject(TranslateService);
  private preferencesService = inject(UserPreferencesService);
  private sidebarService = inject(SidebarService);
  private notificationService = inject(UserNotificationService);
  private breakpoint = inject(BreakpointService);

  // State (drawer visibility comes from service)
  mobileDrawerVisible = this.sidebarService.drawerVisible;
  collapsed = this.sidebarService.collapsed;
  isMobile = this.breakpoint.isMobile;
  isLoggedIn = signal(this.authService.isLoggedIn);

  constructor() {
    // Close drawer when switching to desktop
    effect(() => {
      if (!this.isMobile()) {
        this.mobileDrawerVisible.set(false);
      }
    });
  }
  navItems = signal<NavItem[]>([]);
  adminNavItems = signal<NavItem[]>([]);

  // Cart count from service signal
  cartCount = this.cartService.itemCount;

  // Notification unread count from service signal
  notificationCount = computed(() => this.notificationService.unreadCount());

  // Computed
  isAdmin = computed(() => this.authService.isAdmin());
  isAdminOrStaff = computed(() => this.authService.isAdminOrStaff());
  currentUser = computed(() => this.authService.currentUserValue);
  userInitials = computed(() => getInitials(this.currentUser()?.full_name));
  currentViewMode = computed(() => this.preferencesService.productViewMode());

  // Route constants for template
  readonly routes = ROUTES;

  ngOnInit() {
    this.buildNavItems();

    // Subscribe to login state changes
    this.authService.isLoggedIn$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(loggedIn => {
        this.isLoggedIn.set(loggedIn);
        // Refresh notification count when user logs in
        if (loggedIn) {
          this.notificationService.refreshUnreadCount();
        }
      });

    // Subscribe to auth changes to rebuild nav
    this.authService.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.buildNavItems());

    // Rebuild nav on language change
    onLanguageChange(this.translateService, this.destroyRef, () => {
      this.buildNavItems();
    });

    // Close drawer on navigation
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.closeMobileDrawer());
  }

  private buildNavItems() {
    // Main navigation items
    this.navItems.set([
      {
        label: this.translateService.instant('common.products'),
        icon: 'pi pi-shopping-bag',
        route: ROUTES.PRODUCTS
      },
      {
        label: this.translateService.instant('promotions_page.title'),
        icon: 'pi pi-percentage',
        route: ROUTES.PROMOTIONS
      },
      {
        label: this.translateService.instant('common.cart'),
        icon: 'pi pi-shopping-cart',
        route: ROUTES.CART,
        hideForAdmin: true
      },
      {
        label: this.translateService.instant('header.orders'),
        icon: 'pi pi-list',
        route: ROUTES.ORDERS,
        authRequired: true,
        hideForAdmin: true
      },
      {
        label: this.translateService.instant('notifications_page.title'),
        icon: 'pi pi-bell',
        route: ROUTES.NOTIFICATIONS,
        authRequired: true
      },
      {
        label: this.translateService.instant('settings.title'),
        icon: 'pi pi-cog',
        route: ROUTES.SETTINGS,
        authRequired: true
      },
      {
        label: this.translateService.instant('account.title'),
        icon: 'pi pi-user',
        route: ROUTES.ACCOUNT,
        authRequired: true
      }
    ]);

    // Admin navigation items - derived from centralized config
    this.adminNavItems.set(
      ADMIN_NAV_ITEMS.map(item => ({
        label: this.translateService.instant(item.labelKey),
        icon: item.icon,
        route: item.route,
        adminOnly: item.adminOnly,
        staffOnly: item.staffOnly
      }))
    );
  }

  // Filter nav items based on user role
  getVisibleNavItems(): NavItem[] {
    return this.navItems().filter(item => {
      if (item.authRequired && !this.isLoggedIn()) return false;
      if (item.hideForAdmin && this.isAdminOrStaff()) return false;
      return true;
    });
  }

  getVisibleAdminItems(): NavItem[] {
    return this.adminNavItems().filter(item => {
      if (item.adminOnly && !this.isAdmin()) return false;
      if (item.staffOnly && !this.isAdminOrStaff()) return false;
      return true;
    });
  }

  // Mobile drawer controls (via service)
  closeMobileDrawer() {
    this.sidebarService.closeDrawer();
  }

  // Desktop collapse controls
  toggleCollapsed() {
    this.sidebarService.toggleCollapsed();
  }

  // Actions
  toggleViewMode() {
    this.preferencesService.toggleProductViewMode();
  }

  logout() {
    this.authService.logout();
    this.closeMobileDrawer();
  }
}
