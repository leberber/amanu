import { Component, inject, OnInit, signal, DestroyRef, HostListener } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd, NavigationStart } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { trigger, transition, style, animate, query, group } from '@angular/animations';

import { TranslateModule } from '@ngx-translate/core';
import { BottomNavigationComponent } from './components/bottom-navigation/bottom-navigation.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { InactiveUserMessageComponent } from './components/inactive-user-message/inactive-user-message.component';
import { OnboardingComponent } from './components/onboarding/onboarding.component';
import { SidebarService } from './services/sidebar.service';
import { NavigationService } from './core/services/navigation.service';
import { AuthService } from './services/auth.service';
import { ROUTES } from './core/constants/routes.constants';
import { BREAKPOINTS, STORAGE_KEYS } from './core/constants/app.constants';

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
    InactiveUserMessageComponent,
    OnboardingComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  animations: [slideAnimation]
})
export class AppComponent implements OnInit {
  showNavigation = signal(false);
  hideBottomNav = signal(false);
  isMobile = signal(window.innerWidth < BREAKPOINTS.MD);
  showInactiveModal = false;

  // Splash screen state - hide initially if onboarding will show
  private hasSeenOnboarding = localStorage.getItem(STORAGE_KEYS.HAS_SEEN_ONBOARDING) === 'true';
  showSplash = signal(this.hasSeenOnboarding);
  splashExiting = signal(false);

  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private sidebarService = inject(SidebarService);
  private navigationService = inject(NavigationService);
  private authService = inject(AuthService);

  // Expose sidebar collapsed state for template
  sidebarCollapsed = this.sidebarService.collapsed;

  // Track navigation direction for animations
  private navigationDirection = 'forward-0';
  private navCounter = 0;

  // Routes where navigation should be hidden (auth pages)
  private readonly publicRoutes = [
    ROUTES.LOGIN,
    ROUTES.REGISTER,
    ROUTES.FORGOT_PASSWORD,
    ROUTES.RESET_PASSWORD
  ];

  @HostListener('window:resize')
  onResize(): void {
    this.isMobile.set(window.innerWidth < BREAKPOINTS.MD);
  }

  ngOnInit() {
    // Splash screen animation sequence (only if not showing onboarding)
    if (this.hasSeenOnboarding) {
      this.initSplashScreen();
    }

    // Listen to navigation start to detect direction
    this.router.events.pipe(
      filter(event => event instanceof NavigationStart),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((event: NavigationStart) => {
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

    // Watch for user changes to show inactive modal (but not on public routes like register)
    this.authService.currentUser$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(user => {
      const currentUrl = this.router.url;
      const isOnPublicRoute = this.publicRoutes.some(route => currentUrl.startsWith(route));

      if (user && !user.is_active && !isOnPublicRoute) {
        this.showInactiveModal = true;
      }
    });
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

    this.showNavigation.set(!isPublicRoute);
  }

  // Get animation direction for route transitions
  getRouteAnimationData(): string {
    return this.navigationDirection;
  }

  // Initialize splash screen animation
  private initSplashScreen(): void {
    // Logo appears and holds for 1.2s, then exit animation starts
    setTimeout(() => {
      this.splashExiting.set(true);
      // Remove splash after exit animation completes (500ms)
      setTimeout(() => {
        this.showSplash.set(false);
      }, 500);
    }, 1200);
  }

  // Called when onboarding completes - show splash then app
  onOnboardingComplete(): void {
    this.showSplash.set(true);
    this.splashExiting.set(false);
    this.initSplashScreen();
  }
}
