import { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';

import { Router } from '@angular/router';
import { AuthService } from './services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.getCurrentUser();
  
  if (!user) {
    // Not logged in, redirect to login
    router.navigate(['/login']);
    return false;
  }

  // Check route rules
  const isAdminRoute = state.url.startsWith('/admin');

  if (isAdminRoute && user.role !== 'Admin') {
    // Logged in but not admin trying to access admin route
    router.navigate(['/login']);
    return false;
  }

  // Logged in and either:
  // - accessing account/orders (normal user)
  // - or admin accessing admin page
  return true;
};
