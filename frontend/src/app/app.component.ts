import { Component, inject, OnInit, signal, DestroyRef } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd, NavigationStart } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { trigger, transition, style, animate, query, group } from '@angular/animations';

import { TranslateModule } from '@ngx-translate/core';
import { BottomNavigationComponent } from './components/bottom-navigation/bottom-navigation.component';
import { ToastComponent } from './shared/components/toast/toast.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { OnboardingComponent } from './components/onboarding/onboarding.component';
import { CrossSellNotificationComponent } from './shared/components/cross-sell-notification/cross-sell-notification.component';
import { PushNudgeBannerComponent } from './shared/components/push-nudge-banner/push-nudge-banner.component';
import { SidebarService } from './services/sidebar.service';
import { NavigationService } from './core/services/navigation.service';
import { StorageService } from './core/services/storage.service';
import { AuthService } from './services/auth.service';
import { ROUTES } from './core/constants/routes.constants';
import { ANIMATION } from './core/constants/ui.constants';
import { BreakpointService } from './core/services/breakpoint.service';
import { VolumeDiscountService } from './services/volume-discount.service';

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
  ], { optional: true }),
  query(':leave', [
    style({ pointerEvents: 'none' })
  ], { optional: true })
];

// Forward animation - slide in from right
const slideForward = [
  ...baseStyles,
  group([
    query(':leave', [
      animate('300ms ease-in-out', style({
        transform: 'translateX(-100%)'
      }))
    ], { optional: true }),
    query(':enter', [
      style({ transform: 'translateX(100%)' }),
      animate('300ms ease-in-out', style({
        transform: 'translateX(0)'
      }))
    ], { optional: true })
  ])
];

// Backward animation - slide in from left
const slideBackward = [
  ...baseStyles,
  group([
    query(':leave', [
      animate('300ms ease-in-out', style({
        transform: 'translateX(100%)'
      }))
    ], { optional: true }),
    query(':enter', [
      style({ transform: 'translateX(-100%)' }),
      animate('300ms ease-in-out', style({
        transform: 'translateX(0)'
      }))
    ], { optional: true })
  ])
];

// Route animation with direction support (using predicates to match 'forward-N' or 'backward-N')
const slideAnimation = trigger('routeAnimation', [
  transition((from, to) => to?.toString().startsWith('backward'), slideBackward),
  transition((from, to) => to?.toString().startsWith('forward'), slideForward),
  transition('* <=> *', slideForward) // Default to forward
]);

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    TranslateModule,
    BottomNavigationComponent,
    SidebarComponent,
    OnboardingComponent,
    ToastComponent,
    CrossSellNotificationComponent,
    PushNudgeBannerComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  animations: [slideAnimation]
})
export class AppComponent implements OnInit {
  private readonly storage = inject(StorageService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sidebarService = inject(SidebarService);
  private readonly navigationService = inject(NavigationService);
  private readonly breakpoint = inject(BreakpointService);
  private readonly volumeDiscountService = inject(VolumeDiscountService);
  private readonly authService = inject(AuthService);

  showNavigation = signal(false);
  hideBottomNav = signal(false);

  // Splash screen state - hide initially if onboarding will show or returning from background
  private hasSeenOnboarding = this.storage.hasSeenOnboarding();
  private isReturningFromBackground = this.checkReturningFromBackground();
  showSplash = signal(this.hasSeenOnboarding && !this.isReturningFromBackground);
  splashExiting = signal(false);

  // Expose breakpoint service for template
  isMobile = this.breakpoint.isMobile;

  // Expose sidebar collapsed state for template
  sidebarCollapsed = this.sidebarService.collapsed;

  // Track navigation direction for animations
  private navigationDirection = 'forward-0';
  private navCounter = 0;

  // Routes where navigation should be hidden (auth pages and driver app)
  private readonly publicRoutes = [
    ROUTES.LOGIN,
    ROUTES.REGISTER,
    ROUTES.FORGOT_PASSWORD,
    ROUTES.RESET_PASSWORD
  ];

  // Routes with their own navigation (driver app has its own layout)
  private readonly selfContainedRoutes = [
    ROUTES.DRIVER.BASE
  ];

  ngOnInit() {
    // Initialize volume discounts (fetch + auto-refresh every 20min)
    this.volumeDiscountService.init();

    // Refresh user data from server if logged in (ensures fresh status)
    if (this.authService.isLoggedIn) {
      this.authService.loadCurrentUser()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          // Redirect driver to driver app if they're on a client route
          this.redirectDriverIfNeeded();
        });
    }

    // Splash screen animation sequence (only if not showing onboarding and not returning from background)
    if (this.hasSeenOnboarding && !this.isReturningFromBackground) {
      this.initSplashScreen();
    }

    // Listen to navigation start to detect direction
    this.router.events.pipe(
      filter(event => event instanceof NavigationStart),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((event: NavigationStart) => {
      const currentUrl = this.router.url;
      const targetUrl = event.url;

      // Skip animation for navigation within driver module (child routes)
      const isWithinDriver = currentUrl.startsWith('/driver') && targetUrl.startsWith('/driver');
      if (isWithinDriver) {
        return;
      }

      this.navCounter++;

      // Priority: 1) NavigationService explicit direction, 2) popstate detection, 3) default forward
      let direction: 'forward' | 'backward';
      if (this.navigationService.direction) {
        direction = this.navigationService.direction;
        this.navigationService.clearDirection();
      } else if (event.navigationTrigger === 'popstate') {
        direction = 'backward';
      } else {
        direction = 'forward';
      }

      this.navigationDirection = `${direction}-${this.navCounter}`;
    });

    // Listen to route changes
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((event: NavigationEnd) => {
      this.updateNavigation(event.urlAfterRedirects || event.url);
      this.updateRouteData();
    });

    // Check initial route
    this.updateNavigation(this.router.url);
    this.updateRouteData();
  }

  private updateRouteData(): void {
    let route = this.router.routerState.root;
    while (route.firstChild) {
      route = route.firstChild;
    }
    this.hideBottomNav.set(route.snapshot.data['hideBottomNav'] === true);
  }

  private updateNavigation(url: string): void {
    const isPublicRoute = this.publicRoutes.some(route => url.startsWith(route));
    const isSelfContained = this.selfContainedRoutes.some(route => url.startsWith(route));

    this.showNavigation.set(!isPublicRoute && !isSelfContained);
  }

  // Get animation direction for route transitions
  getRouteAnimationData(): string {
    return this.navigationDirection;
  }

  // Initialize splash screen animation
  private initSplashScreen(): void {
    // Logo appears and holds, then exit animation starts
    setTimeout(() => {
      this.splashExiting.set(true);
      // Remove splash after exit animation completes
      setTimeout(() => {
        this.showSplash.set(false);
      }, ANIMATION.SLOW);
    }, ANIMATION.SPLASH_DURATION);
  }

  // Called when onboarding completes - show splash then app
  onOnboardingComplete(): void {
    this.showSplash.set(true);
    this.splashExiting.set(false);
    this.initSplashScreen();
  }

  private checkReturningFromBackground(): boolean {
    // Check if there's saved registration state (user was in middle of registration)
    const saved = sessionStorage.getItem('registration_state');
    if (!saved) return false;
    try {
      const state = JSON.parse(saved);
      const tenMinutes = 10 * 60 * 1000;
      return Date.now() - state.timestamp < tenMinutes;
    } catch {
      return false;
    }
  }

  /**
   * Redirect driver users to driver app if they're currently on a client route
   */
  private redirectDriverIfNeeded(): void {
    if (!this.authService.isDriver()) {
      return;
    }

    const currentUrl = this.router.url;

    // Don't redirect if already in driver area or on auth pages
    if (currentUrl.startsWith('/driver') ||
        currentUrl.startsWith('/login') ||
        currentUrl.startsWith('/register')) {
      return;
    }

    // Driver is on a client route, redirect to driver app
    this.router.navigate([ROUTES.DRIVER.BASE]);
  }
}
