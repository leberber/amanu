import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ROUTES } from '../core/constants/routes.constants';

export const driverGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  if (!authService.isLoggedIn) {
    router.navigate([ROUTES.LOGIN], { queryParams: { returnUrl: state.url } });
    return false;
  }

  if (authService.isDriver()) {
    return true;
  }

  // Redirect non-drivers to home
  router.navigate([ROUTES.HOME]);
  return false;
};
