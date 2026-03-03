import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ROUTES } from '../core/constants/routes.constants';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  if (authService.isLoggedIn) {
    return true;
  }
  
  // Redirect to login page with return url
  router.navigate([ROUTES.LOGIN], { queryParams: { returnUrl: state.url } });
  return false;
};