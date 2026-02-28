import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';

/**
 * Service to handle navigation with explicit animation direction.
 * Exposes the direction so AppComponent can read it for animations.
 */
@Injectable({
  providedIn: 'root'
})
export class NavigationService {
  private router = inject(Router);
  private location = inject(Location);

  // Navigation direction - read by AppComponent for animation
  direction: 'forward' | 'backward' | null = null;

  /**
   * Navigate backward (slide from left)
   * Uses history.back() if available, otherwise navigates to fallback route
   */
  back(fallbackRoute?: string): void {
    this.direction = 'backward';

    if (window.history.length > 1) {
      this.location.back();
    } else if (fallbackRoute) {
      this.router.navigate([fallbackRoute]);
    }
  }

  /**
   * Navigate backward to a specific route (slide from left)
   */
  backTo(route: string): void {
    this.direction = 'backward';
    this.router.navigate([route]);
  }

  /**
   * Clear direction after animation completes
   */
  clearDirection(): void {
    this.direction = null;
  }
}
