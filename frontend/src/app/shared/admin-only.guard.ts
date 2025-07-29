// src/app/shared/admin-only.guard.ts
import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user.model';

export const adminOnlyGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  
  if (!authService.isLoggedIn) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }
  
  const currentUser = authService.currentUserValue;
  
  // Only allow admin role
  if (currentUser && currentUser.role === UserRole.ADMIN) {
    return true;
  }
  
  // Redirect staff to orders page (their main work area)
  if (currentUser && currentUser.role === UserRole.STAFF) {
    router.navigate(['/admin/orders']);
    return false;
  }
  
  // Redirect customers to home
  router.navigate(['/']);
  return false;
};