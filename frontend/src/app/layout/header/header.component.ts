// src/app/pages/header/header.component.ts
import { Component, OnInit, OnDestroy, signal, computed, effect, inject } from '@angular/core';
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
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
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
    DrawerModule
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit, OnDestroy {
  // Dependency injection
  public authService = inject(AuthService);
  private cartService = inject(CartService);
  
  // UI state signals
  menuVisible = signal(false);
  isDarkMode = signal(false);
  
  // Data signals
  currentUser = signal<User | null>(null);
  items = signal<MenuItem[]>([]);
  mobileItems = signal<MenuItem[]>([]);
  userMenuItems = signal<MenuItem[]>([]);
  
  // Style definitions
  avatarStyle = {'background-color':'var(--primary-color)', 'color': 'var(--primary-text-color)'};
  
  // Subscriptions
  private subscriptions: Subscription[] = [];
  
  // Computed signals
  isAdmin = computed(() => 
    this.authService.isLoggedIn && 
    (this.currentUser()?.role === 'admin' || this.currentUser()?.role === 'staff')
  );
  
  displayName = computed(() => this.currentUser()?.full_name || 'User');
  
  userEmail = computed(() => this.currentUser()?.email || '');
  
  // Track cart items 
  private cartItems = signal<any[]>([]);
  
  // Display distinct items count in cart
  cartCount = computed(() => {
    // Use the cart items signal that we maintain
    return this.cartItems().length > 0 
      ? this.cartItems().length.toString() 
      : null;
  });
  
  themeIcon = computed(() => this.isDarkMode() ? 'pi pi-sun' : 'pi pi-moon');

  constructor() {
    // Effect to update menus when relevant values change
    effect(() => {
      // This effect depends on isAdmin and authService.isLoggedIn
      const admin = this.isAdmin();
      const loggedIn = this.authService.isLoggedIn;
      
      // Build menus when these dependencies change
      this.buildMenus();
    });
  }

  ngOnInit() {
    // Check for current theme
    this.isDarkMode.set(document.querySelector('html')?.classList.contains('my-app-dark') || false);
    
    // Subscribe to user changes
    this.subscriptions.push(
      this.authService.currentUser$.subscribe(user => {
        this.currentUser.set(user);
        this.buildMenus();
      })
    );
    
    // Always try to load user data on initialization
    if (this.authService.isLoggedIn) {
      this.authService.loadCurrentUser().subscribe({
        error: err => console.error('Error loading user in header:', err)
      });
    }
    
    // Load cart items and subscribe to cart changes
    this.loadCartItems();
  }
  
  /**
   * Load cart items and subscribe to changes
   */
  private loadCartItems(): void {
    // Initial cart load
    this.cartService.getCartItems().subscribe();
    
    // Subscribe to cart items changes
    this.subscriptions.push(
      this.cartService.cartItems$.subscribe(items => {
        // Update our local signal with the cart items
        this.cartItems.set(items || []);
      })
    );
  }

  // UI actions
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

  // Menu building
  private buildMenus(): void {
    // Base items for both menus
    const baseItems: MenuItem[] = [
      {
        label: 'Home',
        icon: 'pi pi-home',
        routerLink: '/'
      },
      {
        label: 'Products',
        icon: 'pi pi-shopping-bag',
        routerLink: '/products'
      }
    ];

    // Desktop menu with sub-menus
    const desktopItems: MenuItem[] = [...baseItems];
    
    // Add admin submenu for desktop (when appropriate)
    if (this.isAdmin()) {
      desktopItems.push(this.getAdminMenuItem());
    }
    this.items.set(desktopItems);

    // Mobile menu - flattened with direct links
    const mobileItems: MenuItem[] = [...baseItems];
    
    // Add direct admin link for mobile
    if (this.isAdmin()) {
      mobileItems.push({
        label: 'Admin',
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
  
  // Admin menu configuration
  private getAdminMenuItem(): MenuItem {
    return {
      label: 'Admin',
      icon: 'pi pi-cog',
      items: [
        {
          label: 'Dashboard',
          icon: 'pi pi-chart-bar',
          routerLink: '/admin'
        },
        {
          label: 'Orders',
          icon: 'pi pi-list',
          routerLink: '/admin/orders'
        },
        {
          label: 'Users',
          icon: 'pi pi-users',
          routerLink: '/admin/users'
        },
        {
          label: 'Products',
          icon: 'pi pi-tag',
          routerLink: '/admin/products'
        },
        {
          label: 'Categories',
          icon: 'pi pi-tags',
          routerLink: '/admin/categories'
        }
      ]
    };
  }
  
  // User menu configuration
  private getUserMenuItems(): MenuItem[] {
    return [
      {
        label: 'Profile',
        icon: 'pi pi-user',
        routerLink: '/profile'
      },
      {
        label: 'Orders',
        icon: 'pi pi-list',
        routerLink: '/orders'
      },
      {
        label: 'Logout',
        icon: 'pi pi-sign-out',
        command: () => this.logout()
      }
    ];
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}