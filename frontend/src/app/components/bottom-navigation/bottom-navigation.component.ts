import { Component, inject, OnInit, computed, signal, viewChildren, viewChild, ElementRef, AfterViewInit, DestroyRef } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { HomeScrollService } from '../../core/services/home-scroll.service';
import { CartService } from '../../services/cart.service';
import { SidebarService } from '../../services/sidebar.service';
import { UserNotificationService } from '../../services/user-notification.service';
import { MobileAdminMenuComponent } from '../mobile-admin-menu/mobile-admin-menu.component';
import { ROUTES } from '../../core/constants/routes.constants';

@Component({
  selector: 'app-bottom-navigation',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslateModule, MobileAdminMenuComponent],
  templateUrl: './bottom-navigation.component.html',
  styleUrl: './bottom-navigation.component.scss'
})
export class BottomNavigationComponent implements OnInit, AfterViewInit {
  authService = inject(AuthService);
  homeScroll = inject(HomeScrollService);
  private cartService = inject(CartService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private sidebarService = inject(SidebarService);
  private notificationService = inject(UserNotificationService);

  readonly routes = ROUTES;
  notificationCount = this.notificationService.unreadCount;

  // Signal-based view children
  navItems = viewChildren<ElementRef>('navItem');
  adminMenu = viewChild<MobileAdminMenuComponent>('adminMenu');

  // State signals
  indicatorLeft = signal(0);
  indicatorWidth = signal(0);

  // Computed values - use service signals directly
  cartCount = this.cartService.itemCount;
  isAdminOrStaff = computed(() => this.authService.isAdminOrStaff());

  openSidebar(): void {
    this.sidebarService.openDrawer();
  }

  showAdminMenu(): void {
    this.adminMenu()?.show();
  }

  ngOnInit() {
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        setTimeout(() => this.updateIndicator(), 0);
      });

    if (this.authService.isLoggedIn) {
      this.notificationService.refreshUnreadCount();
    }
  }

  goToNotifications(): void {
    this.router.navigate([ROUTES.NOTIFICATIONS]);
  }

  ngAfterViewInit() {
    setTimeout(() => this.updateIndicator(), 0);
  }

  updateIndicator(): void {
    const items = this.navItems();
    const activeItem = items.find(item =>
      item.nativeElement.classList.contains('active')
    );

    if (activeItem) {
      const el = activeItem.nativeElement;
      const fullWidth = el.offsetWidth;
      const indicatorW = fullWidth * 0.6;
      const offset = (fullWidth - indicatorW) / 2;
      this.indicatorLeft.set(el.offsetLeft + offset);
      this.indicatorWidth.set(indicatorW);
    } else {
      this.indicatorWidth.set(0);
    }
  }
}
