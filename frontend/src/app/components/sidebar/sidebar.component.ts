import { Component, inject, OnInit, computed, signal, DestroyRef, effect } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DrawerModule } from 'primeng/drawer';
import { TooltipModule } from 'primeng/tooltip';
import { filter, switchMap, tap, finalize, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { SidebarService } from '../../services/sidebar.service';
import { UserNotificationService } from '../../services/user-notification.service';
import { UserService } from '../../services/user.service';
import { LanguageSelectorComponent } from '../language-selector/language-selector.component';
import { onLanguageChange } from '../../core/utils/language-change.util';
import { ROUTES } from '../../core/constants/routes.constants';
import { ADMIN_NAV_ITEMS, DRAWER_CLOSE_ROUTES } from '../../core/constants/navigation.constants';
import { BreakpointService } from '../../core/services/breakpoint.service';
import { getInitials } from '../../core/utils/format.util';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  badge?: number;
  adminOnly?: boolean;
  staffOnly?: boolean;
  accountantOnly?: boolean;
  authRequired?: boolean;
  hideForAdmin?: boolean;
  hideForAccountant?: boolean;
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
  private sidebarService = inject(SidebarService);
  private notificationService = inject(UserNotificationService);
  private breakpoint = inject(BreakpointService);
  private userService = inject(UserService);

  // State (drawer visibility comes from service)
  mobileDrawerVisible = this.sidebarService.drawerVisible;
  collapsed = this.sidebarService.collapsed;
  isMobile = this.breakpoint.isTablet;
  isLoggedIn = signal(this.authService.isLoggedIn);
  refreshingStatus = signal(false);
  private currentUserSignal = signal(this.authService.currentUserValue);

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

  // Use service signals directly
  cartCount = this.cartService.itemCount;
  notificationCount = this.notificationService.unreadCount;

  // Computed
  isAdmin = computed(() => this.authService.isAdmin());
  isAdminOrStaff = computed(() => this.authService.isAdminOrStaff());
  isAccountant = computed(() => this.authService.isAccountant());
  currentUser = this.currentUserSignal.asReadonly();
  userInitials = computed(() => getInitials(this.currentUser()?.full_name));
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

    // Subscribe to auth changes to rebuild nav and update user signal
    this.authService.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        this.currentUserSignal.set(user);
        this.buildNavItems();
      });

    // Rebuild nav on language change
    onLanguageChange(this.translateService, this.destroyRef, () => {
      this.buildNavItems();
    });

    // Fallback: close drawer on navigation if click handler didn't catch it
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        if (this.mobileDrawerVisible()) {
          this.sidebarService.closeDrawer();
        }
      });
  }

  private buildNavItems() {
    // Main navigation items
    this.navItems.set([
      {
        label: this.translateService.instant('common.products'),
        icon: 'pi pi-shopping-bag',
        route: ROUTES.PRODUCTS,
        hideForAccountant: true
      },
      {
        label: this.translateService.instant('promotions_page.title'),
        icon: 'pi pi-percentage',
        route: ROUTES.PROMOTIONS,
        hideForAccountant: true
      },
      {
        label: this.translateService.instant('new_arrivals.title'),
        icon: 'pi pi-star',
        route: ROUTES.NEW_ARRIVALS,
        hideForAccountant: true
      },
      {
        label: this.translateService.instant('common.cart'),
        icon: 'pi pi-shopping-cart',
        route: ROUTES.CART,
        hideForAdmin: true,
        hideForAccountant: true
      },
      {
        label: this.translateService.instant('header.orders'),
        icon: 'pi pi-list',
        route: ROUTES.ORDERS,
        authRequired: true,
        hideForAdmin: true,
        hideForAccountant: true
      },
      {
        label: 'Mes factures',
        icon: 'pi pi-receipt',
        route: ROUTES.MES_FACTURES,
        authRequired: true,
        hideForAdmin: true,
        hideForAccountant: true
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
        staffOnly: item.staffOnly,
        accountantOnly: item.accountantOnly
      }))
    );
  }

  // Filter nav items based on user role (computed for efficiency)
  visibleNavItems = computed(() => {
    return this.navItems().filter(item => {
      if (item.authRequired && !this.isLoggedIn()) return false;
      if (item.hideForAdmin && this.isAdminOrStaff()) return false;
      if (item.hideForAccountant && this.isAccountant()) return false;
      return true;
    });
  });

  visibleAdminItems = computed(() => {
    const isAdmin = this.isAdmin();
    const isAdminOrStaff = this.isAdminOrStaff();
    const isAccountant = this.isAccountant();

    return this.adminNavItems().filter(item => {
      if (item.accountantOnly) return isAccountant || isAdmin;
      if (item.adminOnly) return isAdmin;
      if (item.staffOnly) return isAdminOrStaff;
      return true;
    });
  });

  // Mobile drawer controls (via service)
  closeMobileDrawer() {
    this.sidebarService.closeDrawer();
  }

  // Close drawer when navigating from menu, with smart back behavior
  onMenuNavigate(route: string): void {
    const shouldCloseForGood = DRAWER_CLOSE_ROUTES.includes(route);
    this.sidebarService.closeDrawerWithBackBehavior(!shouldCloseForGood);
  }

  // Desktop collapse controls
  toggleCollapsed() {
    this.sidebarService.toggleCollapsed();
  }

  logout() {
    this.authService.logout();
    this.closeMobileDrawer();
  }

  refreshUserStatus(event: Event): void {
    event.stopPropagation();
    this.refreshingStatus.set(true);

    // Use UserService to check status, then load full user if active
    this.userService.getCurrentUser().pipe(
      tap(user => {
        // Update our local signal immediately with fresh data
        this.currentUserSignal.set(user);
      }),
      switchMap(user => {
        if (user.is_active) {
          // User is now active, reload via AuthService to trigger notifications
          return this.authService.loadCurrentUser();
        }
        return of(user);
      }),
      catchError(() => of(null)),
      finalize(() => this.refreshingStatus.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();
  }
}
