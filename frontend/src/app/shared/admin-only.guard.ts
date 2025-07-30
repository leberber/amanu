// src/app/shared/admin-only.guard.ts
import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ROUTES, DefaultRedirects } from '../core/constants/routes.constants';

export const adminOnlyGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  
  if (!authService.isLoggedIn) {
    router.navigate([ROUTES.LOGIN], { queryParams: { returnUrl: state.url } });
    return false;
  }
  
  // Only allow admin role
  if (authService.isAdmin()) {
    return true;
  }
  
  // Redirect staff to orders page (their main work area)
  if (authService.isStaff()) {
    router.navigate([DefaultRedirects.STAFF_DEFAULT]);
    return false;
  }
  
  // Redirect customers to home
  router.navigate([DefaultRedirects.UNAUTHORIZED]);
  return false;
};