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
  
  private viewportService = inject(ViewportService);
  private translationService = inject(TranslationService);
  private authService = inject(AuthService);
  private router = inject(Router);

  ngOnInit() {
    // Initialize translation service
    // The service will automatically load the saved language or default to French
    
    // Check authentication status on route changes
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      // Hide navigation on login and register pages
      const publicRoutes = ['/login', '/register'];
      this.showNavigation = this.authService.isLoggedIn && !publicRoutes.includes(event.url);
    });
    
    // Check initial authentication status
    const currentUrl = this.router.url;
    const publicRoutes = ['/login', '/register'];
    this.showNavigation = this.authService.isLoggedIn && !publicRoutes.includes(currentUrl);
  }
}