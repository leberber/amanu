import { Component, inject, OnInit, computed, signal, DestroyRef, HostListener } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DrawerModule } from 'primeng/drawer';
import { filter } from 'rxjs/operators';

import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { SidebarService } from '../../services/sidebar.service';
import { LanguageSelectorComponent } from '../language-selector/language-selector.component';
import { UserPreferencesService } from '../../core/services/user-preferences.service';
import { onLanguageChange } from '../../core/utils/language-change.util';

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
  imports: [RouterLink, RouterLinkActive, TranslateModule, DrawerModule, LanguageSelectorComponent],
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
  isMobile = signal(window.innerWidth < 768);
  cartCount = signal(0);
  navItems = signal<NavItem[]>([]);
  adminNavItems = signal<NavItem[]>([]);

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

  @HostListener('window:resize')
  onResize() {
    this.isMobile.set(window.innerWidth < 768);
    // Close drawer when switching to desktop
    if (!this.isMobile()) {
      this.mobileDrawerVisible.set(false);
    }
  }

  ngOnInit() {
    this.buildNavItems();

    // Subscribe to cart changes
    this.cartService.cartItems$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(items => this.cartCount.set(items?.length || 0));

    // Subscribe to auth changes to rebuild nav
    this.authService.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.buildNavItems());

    // Rebuild nav on language change
    onLanguageChange(this.translateService, this.destroyRef, () => this.buildNavItems());

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
        route: '/products'
      },
      {
        label: this.translateService.instant('common.cart'),
        icon: 'pi pi-shopping-cart',
        route: '/cart',
        hideForAdmin: true
      },
      {
        label: this.translateService.instant('header.orders'),
        icon: 'pi pi-list',
        route: '/orders',
        authRequired: true,
        hideForAdmin: true
      },
      {
        label: this.translateService.instant('account.title'),
        icon: 'pi pi-user',
        route: '/account',
        authRequired: true
      }
    ]);

    // Admin navigation items
    this.adminNavItems.set([
      {
        label: this.translateService.instant('admin.navigation.dashboard'),
        icon: 'pi pi-chart-bar',
        route: '/admin',
        adminOnly: true
      },
      {
        label: this.translateService.instant('admin.navigation.orders'),
        icon: 'pi pi-list',
        route: '/admin/orders',
        staffOnly: true
      },
      {
        label: this.translateService.instant('admin.navigation.products'),
        icon: 'pi pi-tag',
        route: '/admin/products',
        staffOnly: true
      },
      {
        label: this.translateService.instant('admin.navigation.categories'),
        icon: 'pi pi-tags',
        route: '/admin/categories',
        staffOnly: true
      },
      {
        label: this.translateService.instant('admin.navigation.brands'),
        icon: 'pi pi-building',
        route: '/admin/brands',
        staffOnly: true
      },
      {
        label: this.translateService.instant('admin.navigation.promotions'),
        icon: 'pi pi-percentage',
        route: '/admin/promotions',
        staffOnly: true
      },
      {
        label: this.translateService.instant('admin.navigation.users'),
        icon: 'pi pi-users',
        route: '/admin/users',
        adminOnly: true
      },
      {
        label: this.translateService.instant('admin.navigation.notifications'),
        icon: 'pi pi-bell',
        route: '/admin/notifications',
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

  // Actions
  toggleViewMode() {
    this.preferencesService.toggleProductViewMode();
  }

  logout() {
    this.authService.logout();
    this.closeMobileDrawer();
  }
}
