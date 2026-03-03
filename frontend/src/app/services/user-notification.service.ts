import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap, catchError, of } from 'rxjs';
import { ApiService } from './api.service';
import { PAGINATION } from '../core/constants/pagination.constants';
import { UserNotification, UnreadCountResponse } from '../models/user-notification.model';
import { TranslationService } from './translation.service';

@Injectable({
  providedIn: 'root'
})
export class UserNotificationService {
  private api = inject(ApiService);
  private translationService = inject(TranslationService);

  // Signal for unread count (can be used for badge)
  unreadCount = signal(0);

  /**
   * Get current user's notifications
   */
  getNotifications(skip = 0, limit = PAGINATION.DEFAULT_NOTIFICATION_LIMIT, unreadOnly = false): Observable<UserNotification[]> {
    const lang = this.translationService.getCurrentLanguage();
    let url = `/notifications?skip=${skip}&limit=${limit}&lang=${lang}`;
    if (unreadOnly) {
      url += '&unread_only=true';
    }
    return this.api.get<UserNotification[]>(url);
  }

  /**
   * Get unread count
   */
  getUnreadCount(): Observable<UnreadCountResponse> {
    return this.api.get<UnreadCountResponse>('/notifications/unread-count').pipe(
      tap(response => this.unreadCount.set(response.count))
    );
  }

  /**
   * Mark a notification as read
   */
  markAsRead(notificationId: number): Observable<{ message: string }> {
    return this.api.post<{ message: string }>(`/notifications/${notificationId}/read`, {}).pipe(
      tap(() => {
        // Decrement unread count
        const current = this.unreadCount();
        if (current > 0) {
          this.unreadCount.set(current - 1);
        }
      })
    );
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead(): Observable<{ message: string }> {
    return this.api.post<{ message: string }>('/notifications/read-all', {}).pipe(
      tap(() => this.unreadCount.set(0))
    );
  }

  /**
   * Delete a notification
   */
  deleteNotification(notificationId: number): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/notifications/${notificationId}`);
  }

  /**
   * Refresh unread count (call this on app init or when needed)
   * Silently fails for inactive/unverified users
   */
  refreshUnreadCount(): void {
    this.getUnreadCount().pipe(
      catchError(() => {
        // Silently fail for inactive users or other errors
        this.unreadCount.set(0);
        return of({ count: 0 });
      })
    ).subscribe();
  }
}
