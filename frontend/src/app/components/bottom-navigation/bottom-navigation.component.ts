// src/app/components/bottom-navigation/bottom-navigation.component.ts
import { Component, inject, OnInit, computed, signal, ViewChild, ViewChildren, QueryList, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { User } from '../../models/user.model';
import { MobileAdminMenuComponent } from '../mobile-admin-menu/mobile-admin-menu.component';
import { MobileUserMenuComponent } from '../mobile-user-menu/mobile-user-menu.component';


@Component({
  selector: 'app-bottom-navigation',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, TranslateModule, MobileAdminMenuComponent, MobileUserMenuComponent],
  template: `
    <div class="bottom-nav">
      <!-- Sliding Indicator -->
      <div class="nav-indicator" [style.left.px]="indicatorLeft" [style.width.px]="indicatorWidth"></div>

      <!-- Products -->
      <a #navItem routerLink="/products" routerLinkActive="active">
        <i class="pi pi-shopping-bag"></i>
        <span>{{ 'common.products' | translate }}</span>
      </a>

      <!-- Cart (only for customers) -->
      @if (!isAdminOrStaff()) {
        <a #navItem routerLink="/cart" routerLinkActive="active" class="cart-link">
          <div class="cart-icon">
            <i id="cart-icon-bottom" class="pi pi-shopping-cart"></i>
            @if (cartCount() > 0) {
              <span class="badge">{{cartCount() > 99 ? '99+' : cartCount()}}</span>
            }
          </div>
          <span>{{ 'common.cart' | translate }}</span>
        </a>
      }

      <!-- Orders (only for logged in customers) -->
      @if (authService.isLoggedIn && !isAdminOrStaff()) {
        <a #navItem routerLink="/orders" routerLinkActive="active">
          <i class="pi pi-list"></i>
          <span>{{ 'header.orders' | translate }}</span>
        </a>
      }

      <!-- Admin (for staff/admin) -->
      @if (isAdminOrStaff()) {
        <a #navItem (click)="showAdminMenu()" class="admin-link">
          <i class="pi pi-cog"></i>
          <span>{{ 'header.admin' | translate }}</span>
        </a>
      }

      <!-- Menu (for all users) -->
      <a #navItem (click)="showUserMenu()" class="menu-link">
        <i class="pi pi-bars"></i>
        <span>{{ 'common.menu' | translate }}</span>
      </a>
    </div>

    <!-- Mobile Admin Menu -->
    <app-mobile-admin-menu #adminMenu></app-mobile-admin-menu>

    <!-- Mobile User Menu -->
    <app-mobile-user-menu #userMenu></app-mobile-user-menu>
  `,
  styles: [`
    .bottom-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: white;
      border-top: 1px solid #e0e0e0;
      display: flex;
      padding: 8px 8px 12px 8px;
      z-index: 1000;
    }

    .nav-indicator {
      position: absolute;
      top: 0;
      height: 3px;
      background: #0F3C82;
      transition: left 0.3s ease, width 0.3s ease;
      z-index: 1;
    }

    .bottom-nav a {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-decoration: none;
      color: rgba(15, 60, 130, 0.9);
      padding: 8px 4px;
      border-radius: 12px;
      margin: 0 4px;
      transition: all 0.2s ease;
    }

    .bottom-nav a i,
    .bottom-nav a span {
      color: rgba(15, 60, 130, 0.9);
    }

    .bottom-nav a.active {
      color: #0F3C82;
      font-weight: 700;
    }

    .bottom-nav a.active i,
    .bottom-nav a.active span {
      color: #0F3C82;
    }
    
    .bottom-nav a.admin-link,
    .bottom-nav a.menu-link {
      cursor: pointer;
    }
    
    .bottom-nav i {
      font-size: 20px;
      margin-bottom: 4px;
    }
    
    .bottom-nav span {
      font-size: 12px;
      white-space: nowrap;
    }
    
    .cart-icon {
      position: relative;
    }
    
    .badge {
      position: absolute;
      top: -8px;
      right: -8px;
      background: red;
      color: white !important;
      border-radius: 50%;
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
    }
    
    /* Hide on desktop */
    @media (min-width: 768px) {
      .bottom-nav {
        display: none;
      }
    }
    
    /* Dark theme */
    :host-context(.my-app-dark) .bottom-nav {
      background: #1a1a1a;
      border-top-color: #333;
    }

    :host-context(.my-app-dark) .bottom-nav a {
      color: #5a8ac7;
    }

    :host-context(.my-app-dark) .bottom-nav a.active {
      color: #7ba3d4;
      font-weight: 700;
    }

    :host-context(.my-app-dark) .bottom-nav a.active i,
    :host-context(.my-app-dark) .bottom-nav a.active span {
      color: #7ba3d4;
    }
  `]
})
export class BottomNavigationComponent implements OnInit, AfterViewInit {
  authService = inject(AuthService);
  private cartService = inject(CartService);
  private router = inject(Router);
  translateService = inject(TranslateService);

  @ViewChild('adminMenu') adminMenu!: MobileAdminMenuComponent;
  @ViewChild('userMenu') userMenu!: MobileUserMenuComponent;
  @ViewChildren('navItem') navItems!: QueryList<ElementRef>;

  cartItems = signal<any[]>([]);
  currentUser = signal<User | null>(null);

  // Indicator position
  indicatorLeft = 0;
  indicatorWidth = 0;

  // Computed cart count - count distinct products (like cart component's cartItemCount)
  cartCount = computed(() => {
    return this.cartItems().length;
  });

  isAdminOrStaff(): boolean {
    return this.authService.isAdminOrStaff();
  }

  showAdminMenu(): void {
    if (this.adminMenu) {
      this.adminMenu.show();
    }
  }

  showUserMenu(): void {
    if (this.userMenu) {
      this.userMenu.show();
    }
  }

  ngOnInit() {
    // Subscribe to cart changes
    this.cartService.cartItems$.subscribe(items => {
      this.cartItems.set(items || []);
    });

    // Subscribe to user changes
    this.authService.currentUser$.subscribe(user => {
      this.currentUser.set(user);
    });

    // Update indicator on route changes
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      setTimeout(() => this.updateIndicator(), 0);
    });
  }

  ngAfterViewInit() {
    setTimeout(() => this.updateIndicator(), 0);

    // Re-update when nav items change (e.g., login/logout)
    this.navItems.changes.subscribe(() => {
      setTimeout(() => this.updateIndicator(), 0);
    });
  }

  updateIndicator(): void {
    const items = this.navItems?.toArray() || [];
    const activeItem = items.find(item =>
      item.nativeElement.classList.contains('active')
    );

    if (activeItem) {
      const el = activeItem.nativeElement;
      const fullWidth = el.offsetWidth;
      const indicatorWidth = fullWidth * 0.6;
      const offset = (fullWidth - indicatorWidth) / 2;
      this.indicatorLeft = el.offsetLeft + offset;
      this.indicatorWidth = indicatorWidth;
    } else {
      this.indicatorWidth = 0;
    }
  }
}