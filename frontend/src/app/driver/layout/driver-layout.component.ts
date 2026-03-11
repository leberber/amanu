import { Component, inject, OnInit, signal, computed, DestroyRef } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd, NavigationStart } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { trigger, transition, style, animate, query, group } from '@angular/animations';
import { filter } from 'rxjs';

import { DriverService } from '../../services/driver.service';
import { AuthService } from '../../services/auth.service';
import { ROUTES } from '../../core/constants/routes.constants';
import { DRIVER_STATUS, DRIVER_STATUS_CONFIG } from '../../core/constants/driver.constants';

// Base styles for route animations
const baseStyles = [
  query(':enter, :leave', [
    style({
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%'
    })
  ], { optional: true })
];

// Forward animation - slide in from right
const slideForward = [
  ...baseStyles,
  group([
    query(':leave', [
      animate('300ms ease-in-out', style({ transform: 'translateX(-100%)' }))
    ], { optional: true }),
    query(':enter', [
      style({ transform: 'translateX(100%)' }),
      animate('300ms ease-in-out', style({ transform: 'translateX(0)' }))
    ], { optional: true })
  ])
];

// Backward animation - slide in from left
const slideBackward = [
  ...baseStyles,
  group([
    query(':leave', [
      animate('300ms ease-in-out', style({ transform: 'translateX(100%)' }))
    ], { optional: true }),
    query(':enter', [
      style({ transform: 'translateX(-100%)' }),
      animate('300ms ease-in-out', style({ transform: 'translateX(0)' }))
    ], { optional: true })
  ])
];

// Slide animation with direction support
const slideAnimation = trigger('driverRouteAnimation', [
  transition((from, to) => to?.toString().startsWith('backward'), slideBackward),
  transition((from, to) => to?.toString().startsWith('forward'), slideForward),
  transition('* <=> *', slideForward)
]);

@Component({
  selector: 'app-driver-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './driver-layout.component.html',
  styleUrl: './driver-layout.component.scss',
  animations: [slideAnimation]
})
export class DriverLayoutComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly driverService = inject(DriverService);
  private readonly authService = inject(AuthService);

  readonly routes = ROUTES;
  readonly statusConfig = DRIVER_STATUS_CONFIG;
  readonly DRIVER_STATUS = DRIVER_STATUS;

  // Driver state from service
  profile = this.driverService.profile;
  driverProfile = this.driverService.driverProfile;
  activeTrips = this.driverService.activeTrips;
  isAvailable = this.driverService.isAvailable;

  // Current status for display
  currentStatus = computed(() => {
    const profile = this.driverProfile();
    return profile?.status || DRIVER_STATUS.OFFLINE;
  });

  statusLabel = computed(() => {
    const status = this.currentStatus();
    return this.statusConfig[status]?.label || 'driver.status.offline';
  });

  statusColor = computed(() => {
    const status = this.currentStatus();
    return this.statusConfig[status]?.color || '#6b7280';
  });

  // Active orders count for badge
  activeOrdersCount = computed(() => this.activeTrips().length);

  // Track if on trip detail page to hide bottom nav
  hideBottomNav = signal(false);

  // Show back button instead of title on certain pages
  showBackButton = signal(false);

  // Current page title
  pageTitle = signal('Home');

  // Animation state tracking
  private animationCounter = 0;
  private nextDirection: 'forward' | 'backward' = 'forward';
  animationState = signal('forward-0');

  // Navigation items
  readonly navItems = [
    { path: '/driver', icon: 'pi pi-home', label: 'driver.navigation.dashboard', exact: true },
    { path: '/driver/active', icon: 'pi pi-truck', label: 'driver.navigation.active', exact: false, showBadge: true },
    { path: '/driver/history', icon: 'pi pi-history', label: 'driver.navigation.history', exact: false },
    { path: '/driver/profile', icon: 'pi pi-user', label: 'driver.navigation.profile', exact: false }
  ];

  ngOnInit(): void {
    // Initialize driver data
    this.driverService.initializeDriver();

    // Detect browser back button (popstate) for backward animation
    this.router.events.pipe(
      filter(event => event instanceof NavigationStart),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((event: NavigationStart) => {
      if (event.navigationTrigger === 'popstate') {
        this.nextDirection = 'backward';
      }
    });

    // Track route changes to hide bottom nav on certain pages
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((event: NavigationEnd) => {
      const url = event.urlAfterRedirects || event.url;
      this.hideBottomNav.set(this.shouldHideBottomNav(url));
      this.showBackButton.set(this.shouldShowBackButton(url));
      this.pageTitle.set(this.getPageTitle(url));
      // Update animation state for route transitions
      this.animationCounter++;
      this.animationState.set(`${this.nextDirection}-${this.animationCounter}`);
      this.nextDirection = 'forward'; // Reset to forward after navigation
    });

    // Initial check
    this.hideBottomNav.set(this.shouldHideBottomNav(this.router.url));
    this.showBackButton.set(this.shouldShowBackButton(this.router.url));
    this.pageTitle.set(this.getPageTitle(this.router.url));
  }

  goBack(): void {
    this.nextDirection = 'backward';
    this.router.navigate(['/driver']);
  }

  private shouldShowBackButton(url: string): boolean {
    return url.includes('/driver/active');
  }

  toggleStatus(): void {
    const current = this.currentStatus();
    if (current === DRIVER_STATUS.AVAILABLE) {
      this.driverService.goOffline().subscribe();
    } else if (current === DRIVER_STATUS.OFFLINE) {
      this.driverService.goOnline().subscribe();
    }
    // Can't toggle if BUSY or SUSPENDED
  }

  canToggleStatus(): boolean {
    const status = this.currentStatus();
    return status === DRIVER_STATUS.AVAILABLE || status === DRIVER_STATUS.OFFLINE;
  }

  private shouldHideBottomNav(url: string): boolean {
    // Hide bottom nav on detail pages
    return url.includes('/driver/trip/') || url.includes('/driver/earnings');
  }

  private getPageTitle(url: string): string {
    if (url === '/driver' || url === '/driver/') return 'driver.titles.home';
    if (url.includes('/driver/active')) return 'driver.titles.active';
    if (url.includes('/driver/history')) return 'driver.titles.history';
    if (url.includes('/driver/profile')) return 'driver.titles.profile';
    if (url.includes('/driver/earnings')) return 'driver.titles.earnings';
    return 'driver.titles.home';
  }

  logout(): void {
    this.driverService.clearState();
    this.authService.logout();
    this.router.navigate([ROUTES.LOGIN]);
  }
}
