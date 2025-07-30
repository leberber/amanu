import { Injectable, inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastMessageService } from './toast-message.service';

/**
 * Service to centralize authentication and role checking logic
 * Provides reusable guard functions for routes
 */
@Injectable({
  providedIn: 'root'
})
export class AuthGuardService {
  private authService = inject(AuthService);
  private router = inject(Router);
  private toastService = inject(ToastMessageService);

  /**
   * Check if user is authenticated
   * @param returnUrl - URL to return to after login
   * @returns True if authenticated, false otherwise
   */
  isAuthenticated(returnUrl?: string): boolean {
    const currentUser = this.authService.currentUserValue;
    
    if (currentUser) {
      return true;
    }
    
    // Navigate to login with return URL
    this.router.navigate(['/login'], {
      queryParams: { returnUrl: returnUrl || this.router.url }
    });
    return false;
  }

  /**
   * Check if user has specific role
   * @param roles - Array of allowed roles
   * @returns True if user has one of the roles, false otherwise
   */
  hasRole(roles: string[]): boolean {
    const currentUser = this.authService.currentUserValue;
    
    if (!currentUser) {
      return false;
    }
    
    return roles.includes(currentUser.role);
  }

  /**
   * Check if user has admin role
   * @returns True if user is admin
   */
  isAdmin(): boolean {
    return this.hasRole(['admin']);
  }

  /**
   * Check if user has staff or admin role
   * @returns True if user is staff or admin
   */
  isStaffOrAdmin(): boolean {
    return this.hasRole(['admin', 'staff']);
  }
}

/**
 * Guard function to check if user is authenticated
 */
export const authGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const authGuardService = inject(AuthGuardService);
  return authGuardService.isAuthenticated(state.url);
};

/**
 * Guard function to check if user is admin
 */
export const adminGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const authGuardService = inject(AuthGuardService);
  const toastService = inject(ToastMessageService);
  
  if (!authGuardService.isAuthenticated(state.url)) {
    return false;
  }
  
  if (!authGuardService.isAdmin()) {
    toastService.showPermissionDenied();
    inject(Router).navigate(['/']);
    return false;
  }
  
  return true;
};

/**
 * Guard function to check if user is staff or admin
 */
export const staffGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const authGuardService = inject(AuthGuardService);
  const toastService = inject(ToastMessageService);
  
  if (!authGuardService.isAuthenticated(state.url)) {
    return false;
  }
  
  if (!authGuardService.isStaffOrAdmin()) {
    toastService.showPermissionDenied();
    inject(Router).navigate(['/']);
    return false;
  }
  
  return true;
};

/**
 * Guard function to check if user is guest (not authenticated)
 */
export const guestGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  if (authService.currentUserValue) {
    // User is already authenticated, redirect to home
    router.navigate(['/']);
    return false;
  }
  
  return true;
};