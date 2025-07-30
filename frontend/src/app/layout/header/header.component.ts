// frontend/src/app/layout/header/header.component.ts
import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MenubarModule } from 'primeng/menubar';
import { MenuItem } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { MenuModule } from 'primeng/menu';
import { BadgeModule } from 'primeng/badge';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { RippleModule } from 'primeng/ripple';
import { DrawerModule } from 'primeng/drawer';
import { TooltipModule } from 'primeng/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { TranslationService } from '../../services/translation.service';
import { LanguageSelectorComponent } from '../../components/language-selector/language-selector.component';
import { User } from '../../models/user.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule, 
    RouterLink, 
    OverlayBadgeModule,
    BadgeModule,
    ButtonModule, 
    MenubarModule, 
    AvatarModule, 
    MenuModule,
    RippleModule,
    DrawerModule,
    TooltipModule,
    TranslateModule,
    LanguageSelectorComponent
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit, OnDestroy {
  // Dependency injection
  public authService = inject(AuthService);
  private cartService = inject(CartService);
  private translationService = inject(TranslationService);
  private translateService = inject(TranslateService);
  
  // UI state signals
  menuVisible = signal(false);
  isDarkMode = signal(false);
  
  // Data signals
  currentUser = signal<User | null>(null);
  items = signal<MenuItem[]>([]);
  mobileItems = signal<MenuItem[]>([]);
  userMenuItems = signal<MenuItem[]>([]);
  private cartItems = signal<any[]>([]);
  
  // Subscriptions
  private subscriptions: Subscription[] = [];
  
  // Style definitions
  avatarStyle = { 'background-color': '#ece9fc', color: '#2a1261' }
  
  // Computed signals
  isAdmin = computed(() => {
    return this.authService.isAdminOrStaff();
  });
  
  displayName = computed(() => this.currentUser()?.full_name || 'User');
  userEmail = computed(() => this.currentUser()?.email || '');
  
  cartCount = computed(() => {
    return this.cartItems().length > 0 
      ? this.cartItems().length.toString() 
      : null;
  });
  
  themeIcon = computed(() => this.isDarkMode() ? 'pi pi-sun' : 'pi pi-moon');

  // RTL support
  isRTL = computed(() => this.translationService.isRTL());

  ngOnInit() {
    this.initializeTheme();
    this.subscribeToUserChanges();
    this.subscribeToLanguageChanges();
    this.loadInitialUserData();
    this.loadCartItems();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private initializeTheme(): void {
    this.isDarkMode.set(document.querySelector('html')?.classList.contains('my-app-dark') || false);
  }

  private subscribeToUserChanges(): void {
    this.subscriptions.push(
      this.authService.currentUser$.subscribe(user => {
        this.currentUser.set(user);
        this.buildMenus(); // Rebuild menus when user changes
      })
    );
  }

  // 🌍 UPDATED: Enhanced language change handling
  private subscribeToLanguageChanges(): void {
    this.subscriptions.push(
      this.translationService.currentLanguage$.subscribe((newLanguage) => {
        
        // Rebuild menus with new translations
        this.buildMenus();
        
        // 🆕 Notify other components about language change
        // This triggers a refresh of data in product lists, home page, etc.
        this.notifyLanguageChange(newLanguage);
      })
    );
  }

  // 🆕 NEW: Method to notify other parts of app about language changes
  private notifyLanguageChange(newLanguage: string): void {
    // Dispatch a custom event that other components can listen to
    window.dispatchEvent(new CustomEvent('languageChanged', { 
      detail: { language: newLanguage } 
    }));
    
    // Alternative: Could also use a shared service to broadcast changes
  }

  private loadInitialUserData(): void {
    if (this.authService.isLoggedIn) {
      this.authService.loadCurrentUser().subscribe({
        error: err => console.error('Error loading user in header:', err)
      });
    }
  }

  private loadCartItems(): void {
    this.cartService.getCartItems().subscribe();
    
    this.subscriptions.push(
      this.cartService.cartItems$.subscribe(items => {
        this.cartItems.set(items || []);
      })
    );
  }

  // UI Actions
  toggleDarkMode(): void {
    this.isDarkMode.update(isDark => !isDark);
    const element = document.querySelector('html');
    if (element) {
      element.classList.toggle('my-app-dark');
    }
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

  // Helper method to execute menu item commands
  executeCommand(item: MenuItem, event: Event): void {
    if (item.command) {
      item.command({ originalEvent: event, item: item });
    }
  }

  // 🌍 UPDATED: Enhanced menu building with better translation handling
  private buildMenus(): void {
    const baseItems: MenuItem[] = [
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

    const isAdminUser = this.authService.isAdminOrStaff();

    // Desktop menu with sub-menus
    const desktopItems: MenuItem[] = [...baseItems];
    if (isAdminUser) {
      desktopItems.push(this.getAdminMenuItem());
    }
    this.items.set(desktopItems);

    // Mobile menu - flattened with direct links
    const mobileItems: MenuItem[] = [...baseItems];
    
    // Add Orders for logged-in users
    if (this.authService.isLoggedIn) {
      mobileItems.push({
        label: this.translateService.instant('header.orders'),
        icon: 'pi pi-list',
        routerLink: '/orders'
      });
    }
    
    // Add Admin for admin users
    if (isAdminUser) {
      mobileItems.push({
        label: this.translateService.instant('header.admin'),
        icon: 'pi pi-cog',
        routerLink: '/admin'
      });
    }
    
    this.mobileItems.set(mobileItems);

    // User dropdown menu items
    this.userMenuItems.set(
      this.authService.isLoggedIn ? this.getUserMenuItems() : []
    );

  }

  // Add trackBy function for better change detection
  trackByLabel(index: number, item: MenuItem): string {
    return item.label || index.toString();
  }
  
  private getAdminMenuItem(): MenuItem {
    const items: MenuItem[] = [];
    
    // Admin-only items (Dashboard and Users)
    if (this.authService.isAdmin()) {
      items.push({
        label: this.translateService.instant('admin.navigation.dashboard'),
        icon: 'pi pi-chart-bar',
        routerLink: '/admin'
      });
    }
    
    // Items for both admin and staff
    items.push({
      label: this.translateService.instant('admin.navigation.orders'),
      icon: 'pi pi-list',
      routerLink: '/admin/orders'
    });
    
    // Admin-only item (Users)
    if (this.authService.isAdmin()) {
      items.push({
        label: this.translateService.instant('admin.navigation.users'),
        icon: 'pi pi-users',
        routerLink: '/admin/users'
      });
    }
    
    // Items for both admin and staff
    items.push(
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
    
    return {
      label: this.translateService.instant('header.admin'),
      icon: 'pi pi-cog',
      items: items
    };
  }
  
  private getUserMenuItems(): MenuItem[] {
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
      },
      {
        label: this.translateService.instant('common.logout'),
        icon: 'pi pi-sign-out',
        command: () => this.logout()
      }
    ];
  }
}