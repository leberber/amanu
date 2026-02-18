// src/app/app.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { HeaderComponent } from './layout/header/header.component';
import { BottomNavigationComponent } from './components/bottom-navigation/bottom-navigation.component';
import { ViewportService } from './services/viewport.service';
import { TranslationService } from './services/translation.service';
import { AuthService } from './services/auth.service';
import { TranslateModule } from '@ngx-translate/core';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet, 
    ButtonModule, 
    HeaderComponent,
    BottomNavigationComponent,
    TranslateModule
  ],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  title = 'Fresh Produce';
  showNavigation = false;
  showHeader = false;

  private viewportService = inject(ViewportService);
  private translationService = inject(TranslationService);
  private authService = inject(AuthService);
  private router = inject(Router);

  // Routes where header should be hidden (even when logged in)
  private hideHeaderRoutes = ['/cart', '/checkout'];
  private publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password'];

  ngOnInit() {
    // Check authentication status on route changes
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.updateNavigation(event.urlAfterRedirects || event.url);
    });

    // Check initial authentication status
    this.updateNavigation(this.router.url);
  }

  private updateNavigation(url: string): void {
    const isPublicRoute = this.publicRoutes.some(route => url.startsWith(route));
    const isHideHeaderRoute = this.hideHeaderRoutes.some(route => url.startsWith(route));

    this.showNavigation = this.authService.isLoggedIn && !isPublicRoute;
    this.showHeader = this.showNavigation && !isHideHeaderRoute;
  }
}