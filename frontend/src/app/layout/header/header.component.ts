import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

// PrimeNG imports
import { ButtonModule } from 'primeng/button';
import { MenubarModule } from 'primeng/menubar';
import { MenuItem } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { MenuModule } from 'primeng/menu';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { DrawerModule } from 'primeng/drawer';

// Translation imports
import { TranslateModule, TranslateService } from '@ngx-translate/core';

// Service imports
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { TranslationService } from '../../services/translation.service';

// Component imports
import { LanguageSelectorComponent } from '../../components/language-selector/language-selector.component';

// Model imports
import { User } from '../../models/user.model';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    OverlayBadgeModule,
    ButtonModule,
    MenubarModule,
    AvatarModule,
    MenuModule,
    DrawerModule,
    TranslateModule,
    LanguageSelectorComponent
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit, OnDestroy {
  // Constants
  private readonly MOBILE_LINK_CLASS = 'flex align-items-center p-3 mb-2 border-round text-700 hover:surface-100 transition-colors transition-duration-150';
  
  // Services
  readonly authService = inject(AuthService);
  private readonly cartService = inject(CartService);
  private readonly translationService = inject(TranslationService);
  private readonly translateService = inject(TranslateService);
  
  // State signals
  menuVisible = signal(false);
  isDarkMode = signal(false);
  currentUser = signal<User | null>(null);
  items = signal<MenuItem[]>([]);
  mobileItems = signal<MenuItem[]>([]);
  userMenuItems = signal<MenuItem[]>([]);
  cartItems = signal<any[]>([]);
  
  // Subscriptions
  private subscriptions: Subscription[] = [];
  
  // Computed values
  isAdmin = computed(() => this.authService.isAdminOrStaff());
  displayName = computed(() => this.currentUser()?.full_name || 'User');
  userEmail = computed(() => this.currentUser()?.email || '');
  userInitials = computed(() => {
    const name = this.currentUser()?.full_name || 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  });
  cartCount = computed(() => {
    const count = this.cartItems().length;
    return count > 0 ? count.toString() : null;
  });
  themeIcon = computed(() => this.isDarkMode() ? 'pi pi-sun' : 'pi pi-moon');

  ngOnInit(): void {
    this.initializeTheme();
    this.setupSubscriptions();
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // Initialization methods
  private initializeTheme(): void {
    const isDark = document.querySelector('html')?.classList.contains('my-app-dark');
    this.isDarkMode.set(isDark || false);
  }

  private setupSubscriptions(): void {
    // User changes subscription
    this.subscriptions.push(
      this.authService.currentUser$.subscribe(user => {
        this.currentUser.set(user);
        this.buildMenus();
      })
    );

    // Language changes subscription
    this.subscriptions.push(
      this.translationService.currentLanguage$.subscribe(() => {
        this.buildMenus();
      })
    );

    // Cart items subscription
    this.subscriptions.push(
      this.cartService.cartItems$.subscribe(items => {
        this.cartItems.set(items || []);
      })
    );
  }

  private loadInitialData(): void {
    if (this.authService.isLoggedIn) {
      this.authService.loadCurrentUser().subscribe();
    }
    this.cartService.getCartItems().subscribe();
  }

  // UI Action methods
  toggleDarkMode(): void {
    this.isDarkMode.update(isDark => !isDark);
    document.querySelector('html')?.classList.toggle('my-app-dark');
  }

  toggleMobileMenu(): void {
    this.menuVisible.update(visible => !visible);
  }

  closeMenu(): void {
    this.menuVisible.set(false);
  }

  logout(): void {
    this.authService.logout();
    this.closeMenu();
  }

  // Menu building methods
  buildMenus(): void {
    const baseItems = this.getBaseMenuItems();
    const isAdminUser = this.authService.isAdminOrStaff();

    // Desktop menu
    this.items.set(
      isAdminUser ? [...baseItems, this.getAdminMenuItem()] : baseItems
    );

    // Mobile menu
    this.mobileItems.set(this.getMobileMenuItems(baseItems, isAdminUser));

    // User dropdown menu
    this.userMenuItems.set(
      this.authService.isLoggedIn ? this.getUserMenuItems() : []
    );
  }

  private getBaseMenuItems(): MenuItem[] {
    return [
      {
        label: this.translateService.instant('common.home'),
        icon: 'pi pi-home',
        routerLink: '/'
      },
      {
        label: this.translateService.instant('common.products'),
        icon: 'pi pi-shopping-bag',
        routerLink: '/products'
      }
    ];
  }

  private getMobileMenuItems(baseItems: MenuItem[], isAdminUser: boolean): MenuItem[] {
    const items = [...baseItems];
    
    if (this.authService.isLoggedIn) {
      items.push({
        label: this.translateService.instant('header.orders'),
        icon: 'pi pi-list',
        routerLink: '/orders'
      });
    }
    
    if (isAdminUser) {
      items.push({
        label: this.translateService.instant('header.admin'),
        icon: 'pi pi-cog',
        routerLink: '/admin'
      });
    }
    
    return items;
  }

  private getAdminMenuItem(): MenuItem {
    const items: MenuItem[] = [];
    const isAdmin = this.authService.isAdmin();
    
    // Admin-only items
    if (isAdmin) {
      items.push({
        label: this.translateService.instant('admin.navigation.dashboard'),
        icon: 'pi pi-chart-bar',
        routerLink: '/admin'
      });
    }
    
    // Admin and staff items
    items.push(
      {
        label: this.translateService.instant('admin.navigation.orders'),
        icon: 'pi pi-list',
        routerLink: '/admin/orders'
      },
      {
        label: this.translateService.instant('admin.navigation.products'),
        icon: 'pi pi-tag',
        routerLink: '/admin/products'
      },
      {
        label: this.translateService.instant('admin.navigation.categories'),
        icon: 'pi pi-tags',
        routerLink: '/admin/categories'
      }
    );
    
    // Admin-only items
    if (isAdmin) {
      items.splice(2, 0, {
        label: this.translateService.instant('admin.navigation.users'),
        icon: 'pi pi-users',
        routerLink: '/admin/users'
      });
    }
    
    return {
      label: this.translateService.instant('header.admin'),
      icon: 'pi pi-cog',
      items
    };
  }
  
  private getCommonUserMenuItems(): MenuItem[] {
    return [
      {
        label: this.translateService.instant('header.profile'),
        icon: 'pi pi-user',
        routerLink: '/account'
      },
      {
        label: this.translateService.instant('header.orders'),
        icon: 'pi pi-list',
        routerLink: '/orders'
      }
    ];
  }

  private getUserMenuItems(): MenuItem[] {
    return [
      ...this.getCommonUserMenuItems(),
      { separator: true },
      {
        label: this.isDarkMode() ? 'Light Mode' : 'Dark Mode',
        icon: this.themeIcon(),
        command: () => this.toggleDarkMode()
      },
      { separator: true },
      {
        label: this.translateService.instant('common.logout'),
        icon: 'pi pi-sign-out',
        command: () => this.logout()
      }
    ];
  }

  getMobileUserActions(): MenuItem[] {
    // Only return profile for mobile since Orders is already in the navigation menu
    return [
      {
        label: this.translateService.instant('header.profile'),
        icon: 'pi pi-user',
        routerLink: '/account'
      }
    ];
  }

  getMobileLinkClass(): string {
    return this.MOBILE_LINK_CLASS;
  }
}