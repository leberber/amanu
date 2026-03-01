import { Component, inject, OnInit, computed, signal, DestroyRef, HostListener } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DrawerModule } from 'primeng/drawer';
import { TooltipModule } from 'primeng/tooltip';
import { filter } from 'rxjs/operators';

import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { SidebarService } from '../../services/sidebar.service';
import { LanguageSelectorComponent } from '../language-selector/language-selector.component';
import { UserPreferencesService } from '../../core/services/user-preferences.service';
import { onLanguageChange } from '../../core/utils/language-change.util';
import { BREAKPOINTS } from '../../core/constants/app.constants';
import { ROUTES } from '../../core/constants/routes.constants';

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

  // State (drawer visibility comes from service)
  mobileDrawerVisible = this.sidebarService.drawerVisible;
  collapsed = this.sidebarService.collapsed;
  isMobile = signal(window.innerWidth < BREAKPOINTS.MD);
  navItems = signal<NavItem[]>([]);
  adminNavItems = signal<NavItem[]>([]);

  // Cart count from service signal
  cartCount = computed(() => this.cartService.items().length);

  // Computed
  isAdmin = computed(() => this.authService.isAdmin());
  isAdminOrStaff = computed(() => this.authService.isAdminOrStaff());
  isLoggedIn = computed(() => this.authService.isLoggedIn);
  currentUser = computed(() => this.authService.currentUserValue);
  userInitials = computed(() => {
    const name = this.currentUser()?.full_name || 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  });
  currentViewMode = computed(() => this.preferencesService.productViewMode());

  // Route constants for template
  readonly routes = ROUTES;

  @HostListener('window:resize')
  onResize() {
    this.isMobile.set(window.innerWidth < BREAKPOINTS.MD);
    // Close drawer when switching to desktop
    if (!this.isMobile()) {
      this.mobileDrawerVisible.set(false);
    }
  }

  ngOnInit() {
    this.buildNavItems();

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

    // Admin navigation items
    this.adminNavItems.set([
      {
        label: this.translateService.instant('admin.navigation.dashboard'),
        icon: 'pi pi-chart-bar',
        route: ROUTES.ADMIN.DASHBOARD,
        adminOnly: true
      },
      {
        label: this.translateService.instant('admin.navigation.orders'),
        icon: 'pi pi-list',
        route: ROUTES.ADMIN.ORDERS,
        staffOnly: true
      },
      {
        label: this.translateService.instant('admin.navigation.products'),
        icon: 'pi pi-tag',
        route: ROUTES.ADMIN.PRODUCTS,
        staffOnly: true
      },
      {
        label: this.translateService.instant('admin.navigation.categories'),
        icon: 'pi pi-tags',
        route: ROUTES.ADMIN.CATEGORIES,
        staffOnly: true
      },
      {
        label: this.translateService.instant('admin.navigation.brands'),
        icon: 'pi pi-building',
        route: ROUTES.ADMIN.BRANDS,
        staffOnly: true
      },
      {
        label: this.translateService.instant('admin.navigation.promotions'),
        icon: 'pi pi-percentage',
        route: ROUTES.ADMIN.PROMOTIONS,
        staffOnly: true
      },
      {
        label: this.translateService.instant('admin.navigation.users'),
        icon: 'pi pi-users',
        route: ROUTES.ADMIN.USERS,
        adminOnly: true
      },
      {
        label: this.translateService.instant('admin.navigation.notifications'),
        icon: 'pi pi-bell',
        route: ROUTES.ADMIN.NOTIFICATIONS,
        adminOnly: true
      }
    ]);
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
  openMobileDrawer() {
    this.sidebarService.openDrawer();
  }

  closeMobileDrawer() {
    this.sidebarService.closeDrawer();
  }

  toggleMobileDrawer() {
    this.sidebarService.toggleDrawer();
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
