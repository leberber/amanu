import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { StorageService } from '../core/services/storage.service';
import { ROUTES } from '../core/constants/routes.constants';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const storage = inject(StorageService);

  // Skip auth endpoints
  if (req.url.includes('/auth/login')) {
    return next(req);
  }

  const token = storage.getAuthToken();

  if (token) {
    const cloned = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });

    // 401 handling with direct message
    return next(cloned).pipe(
      catchError((error) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          // Store the session expired message flag
          storage.setSessionExpired();

          // Log out and clear data
          authService.logout();

          // Navigate to login with return URL
          router.navigate([ROUTES.LOGIN], {
            queryParams: { returnUrl: router.url }
          });

          return throwError(() => new Error('Session expired. Please log in again.'));
        }
        return throwError(() => error);
      })
    );
  }

  return next(req);
};