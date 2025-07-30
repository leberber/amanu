import { Injectable, inject } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { ToastMessageService } from '../services/toast-message.service';
import { AuthService } from '../../services/auth.service';

/**
 * Interceptor for consistent API error handling
 * Centralizes error responses and authentication handling
 */
@Injectable()
export class ApiErrorInterceptor implements HttpInterceptor {
  private router = inject(Router);
  private toastService = inject(ToastMessageService);
  private authService = inject(AuthService);

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.error instanceof ErrorEvent) {
          // Client-side error
          console.error('Client-side error:', error.error.message);
        } else {
          // Server-side error
          console.error(`Server error ${error.status}:`, error.error);
          
          switch (error.status) {
            case 401:
              // Unauthorized - session expired or invalid token
              this.handleUnauthorized();
              break;
              
            case 403:
              // Forbidden - insufficient permissions
              this.toastService.showPermissionDenied();
              break;
              
            case 404:
              // Not found - resource doesn't exist
              this.toastService.showError('common.not_found');
              break;
              
            case 422:
              // Validation error - handled by individual components
              // Don't show generic message for validation errors
              break;
              
            case 500:
              // Internal server error
              this.toastService.showError('common.server_error');
              break;
              
            case 0:
              // Network error or server unreachable
              this.toastService.showError('common.network_error');
              break;
              
            default:
              // Other errors
              if (error.error?.detail) {
                this.toastService.showError(error.error.detail);
              } else {
                this.toastService.showError('common.unexpected_error');
              }
          }
        }
        
        return throwError(() => error);
      })
    );
  }

  private handleUnauthorized(): void {
    // Clear auth state
    this.authService.logout();
    
    // Set session expired flag
    localStorage.setItem('session_expired', 'true');
    
    // Navigate to login with return URL
    this.router.navigate(['/login'], {
      queryParams: { returnUrl: this.router.url }
    });
  }
}