import { Component, inject, OnInit, signal, DestroyRef, HostListener } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd, ChildrenOutletContexts } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { trigger, transition, style, animate, query, group } from '@angular/animations';

import { BottomNavigationComponent } from './components/bottom-navigation/bottom-navigation.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { SidebarService } from './services/sidebar.service';
import { ROUTES } from './core/constants/routes.constants';
import { BREAKPOINTS } from './core/constants/app.constants';

// Route animation - full slide from right
const slideAnimation = trigger('routeAnimation', [
  transition('* <=> *', [
    // Set up initial styles
    query(':enter, :leave', [
      style({
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%'
      })
    ], { optional: true }),

    // Animate entering and leaving views together
    group([
      query(':leave', [
        animate('300ms ease-in-out', style({
          opacity: 0,
          transform: 'translateX(-100%)'
        }))
      ], { optional: true }),
      query(':enter', [
        style({
          opacity: 0,
          transform: 'translateX(100%)'
        }),
        animate('300ms ease-in-out', style({
          opacity: 1,
          transform: 'translateX(0)'
        }))
      ], { optional: true })
    ])
  ])
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

  // Get unique route path for animation trigger
  getRouteAnimationData(): string {
    const context = this.contexts.getContext('primary');
    return context?.route?.snapshot?.url.toString() || '';
  }
}
