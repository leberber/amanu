// src/app/components/bottom-navigation/bottom-navigation.component.ts
import { Component, inject, OnInit, OnDestroy, computed, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { User } from '../../models/user.model';
import { MobileAdminMenuComponent } from '../mobile-admin-menu/mobile-admin-menu.component';


@Component({
  selector: 'app-bottom-navigation',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, TranslateModule, MobileAdminMenuComponent],
  template: `
    <div class="bottom-nav" [class.hidden]="isHidden" [style.opacity]="opacity">
      <!-- Home -->
      <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">
        <i class="pi pi-home"></i>
        <span>{{ 'common.home' | translate }}</span>
      </a>
      
      <!-- Products -->
      <a routerLink="/products" routerLinkActive="active">
        <i class="pi pi-shopping-bag"></i>
        <span>{{ 'common.products' | translate }}</span>
      </a>
      
      <!-- Cart (only for customers) -->
      <a *ngIf="!isAdminOrStaff()" routerLink="/cart" routerLinkActive="active" class="cart-link">
        <div class="cart-icon">
          <i class="pi pi-shopping-cart"></i>
          <span *ngIf="cartCount() > 0" class="badge">{{cartCount() > 99 ? '99+' : cartCount()}}</span>
        </div>
        <span>{{ 'common.cart' | translate }}</span>
      </a>
      
      <!-- Orders (only for logged in customers) -->
      <a *ngIf="authService.isLoggedIn && !isAdminOrStaff()" routerLink="/orders" routerLinkActive="active">
        <i class="pi pi-list"></i>
        <span>{{ 'header.orders' | translate }}</span>
      </a>
      
      <!-- Admin (for staff/admin) -->
      <a *ngIf="isAdminOrStaff()" (click)="showAdminMenu()" class="admin-link">
        <i class="pi pi-cog"></i>
        <span>{{ 'header.admin' | translate }}</span>
      </a>
      
      <!-- Account (for logged in users including staff) -->
      <a *ngIf="authService.isLoggedIn" routerLink="/account" routerLinkActive="active">
        <i class="pi pi-user"></i>
        <span>{{ translateService.currentLang === 'ar' ? 'حسابي' : ('account.title' | translate) }}</span>
      </a>
      
      <!-- Login (for non-logged in users) -->
      <a *ngIf="!authService.isLoggedIn" routerLink="/login" routerLinkActive="active">
        <i class="pi pi-sign-in"></i>
        <span>{{ 'common.login' | translate }}</span>
      </a>
    </div>
    
    <!-- Mobile Admin Menu -->
    <app-mobile-admin-menu #adminMenu></app-mobile-admin-menu>
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
      transform: translateY(0);
      transition: transform 0.3s ease, opacity 0.3s ease;
    }
    
    .bottom-nav.hidden {
      transform: translateY(100%);
    }
    
    .bottom-nav a {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-decoration: none;
      color: #666;
      padding: 8px 4px;
      border-radius: 12px;
      margin: 0 4px;
      transition: all 0.2s ease;
    }
    
    .bottom-nav a.active {
      color: var(--primary-color, #007bff);
      font-weight: 600;
    }
    
    .bottom-nav a.active i,
    .bottom-nav a.active span {
      color: var(--primary-color, #007bff);
    }
    
    .bottom-nav a.admin-link {
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
      color: white;
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
    
    :host-context(.my-app-dark) .bottom-nav a.active {
      color: #64b5f6;
    }
    
    :host-context(.my-app-dark) .bottom-nav a.active i {
      color: #64b5f6;
    }
  `]
})
export class BottomNavigationComponent implements OnInit, OnDestroy {
  authService = inject(AuthService);
  private cartService = inject(CartService);
  translateService = inject(TranslateService);
  
  @ViewChild('adminMenu') adminMenu!: MobileAdminMenuComponent;
  
  isHidden = false;
  opacity = 1;
  private lastScrollY = 0;
  private scrollAccumulator = 0; // Track continued scrolling
  cartItems = signal<any[]>([]);
  currentUser = signal<User | null>(null);
  
  // Computed cart count - count distinct products (like cart component's cartItemCount)
  cartCount = computed(() => {
    return this.cartItems().length; // Number of different products, not total quantities
  });
  
  isAdminOrStaff(): boolean {
    return this.authService.isAdminOrStaff();
  }
  
  showAdminMenu(): void {
    if (this.adminMenu) {
      this.adminMenu.show();
    }
  }
  
  ngOnInit() {
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', this.handleScroll, { passive: true });
    }
    
    // Subscribe to cart changes - same as cart component
    this.cartService.cartItems$.subscribe(items => {
      this.cartItems.set(items || []);
    });
    
    // Subscribe to user changes
    this.authService.currentUser$.subscribe(user => {
      this.currentUser.set(user);
    });
    
    // Load cart items
    this.cartService.getCartItems().subscribe();
  }
  
  ngOnDestroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', this.handleScroll);
    }
  }
  
  private handleScroll = () => {
    const currentScrollY = window.scrollY;
    const scrollDifference = currentScrollY - this.lastScrollY;
    
    if (currentScrollY <= 50) {
      // At the top - always show full opacity
      this.isHidden = false;
      this.opacity = 1;
      this.scrollAccumulator = 0;
    } else if (scrollDifference > 0) {
      // Scrolling down
      this.scrollAccumulator += scrollDifference;
      
      if (this.scrollAccumulator > 100 && this.scrollAccumulator < 300) {
        // Stage 1: Light scrolling - fade to low opacity
        this.isHidden = false;
        this.opacity = 0.3;
      } else if (this.scrollAccumulator >= 300) {
        // Stage 2: Continued scrolling - completely hide
        this.isHidden = true;
        this.opacity = 0.3;
      }
    } else if (scrollDifference < 0) {
      // Scrolling up - immediately show with full opacity
      this.isHidden = false;
      this.opacity = 1;
      this.scrollAccumulator = 0;
    }
    
    this.lastScrollY = currentScrollY;
  }
}