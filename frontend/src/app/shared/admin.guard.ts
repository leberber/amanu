// src/app/shared/admin.guard.ts
import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ROUTES } from '../core/constants/routes.constants';

export const adminGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  
  if (!authService.isLoggedIn) {
    router.navigate([ROUTES.LOGIN], { queryParams: { returnUrl: state.url } });
    return false;
  }
  
  if (authService.isAdminOrStaff()) {
    return true;
  }
  
  router.navigate([ROUTES.HOME]);
  return false;
};