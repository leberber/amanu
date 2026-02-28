import { Component, inject, OnInit, signal, DestroyRef, HostListener } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd, ChildrenOutletContexts, NavigationStart } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { trigger, transition, style, animate, query, group } from '@angular/animations';

import { BottomNavigationComponent } from './components/bottom-navigation/bottom-navigation.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { SidebarService } from './services/sidebar.service';
import { ROUTES } from './core/constants/routes.constants';
import { BREAKPOINTS } from './core/constants/app.constants';

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

// Route animation with direction support
const slideAnimation = trigger('routeAnimation', [
  transition('* => forward', slideForward),
  transition('* => backward', slideBackward),
  transition('* <=> *', slideForward) // Default to forward
]);

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    BottomNavigationComponent,
    SidebarComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  animations: [slideAnimation]
})
export class AppComponent implements OnInit {
  showNavigation = signal(false);
  hideBottomNav = signal(false);
  isMobile = signal(window.innerWidth < BREAKPOINTS.MD);

  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private sidebarService = inject(SidebarService);
  private contexts = inject(ChildrenOutletContexts);

  // Expose sidebar collapsed state for template
  sidebarCollapsed = this.sidebarService.collapsed;

  // Track navigation direction for animations
  private navigationDirection: 'forward' | 'backward' = 'forward';
  private isPopState = false;

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
    // Listen for browser back/forward button
    window.addEventListener('popstate', () => {
      this.isPopState = true;
    });

    // Listen to navigation start to detect direction
    this.router.events.pipe(
      filter(event => event instanceof NavigationStart),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((event: NavigationStart) => {
      // popstate means browser back/forward button
      if (this.isPopState) {
        this.navigationDirection = 'backward';
        this.isPopState = false;
      } else {
        this.navigationDirection = 'forward';
      }
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

    this.showNavigation.set(!isPublicRoute);
  }

  // Get animation direction for route transitions
  getRouteAnimationData(): string {
    return this.navigationDirection;
  }

  // Allow programmatic back navigation with correct animation
  navigateBack(): void {
    this.navigationDirection = 'backward';
    window.history.back();
  }
}
