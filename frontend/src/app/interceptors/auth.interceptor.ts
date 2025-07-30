// src/app/interceptors/auth.interceptor.ts
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  // Skip auth endpoints
  if (req.url.includes('/auth/login')) {
    return next(req);
  }
  
  const token = localStorage.getItem('token');
  
  if (token) {
    const cloned = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
    
    // 401 handling with direct message
    return next(cloned).pipe(
      catchError((error) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          
          // Store the session expired message flag in localStorage
          localStorage.setItem('session_expired', 'true');
          
          // Log out and clear data
          authService.logout();
          
          // Navigate to login with return URL
          router.navigate(['/login'], { 
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