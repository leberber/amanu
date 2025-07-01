// src/app/shared/admin.guard.ts
import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user.model';

export const adminGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  
  if (!authService.isLoggedIn) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }
  
  const currentUser = authService.currentUserValue;
  
  if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'staff')) {
    return true;
  }
  
  router.navigate(['/']);
  return false;
};