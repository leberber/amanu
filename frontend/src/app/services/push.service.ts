import { Injectable, inject } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { ApiService } from './api.service';
import { TranslationService } from './translation.service';
import { BehaviorSubject } from 'rxjs';
import { firstValueFrom } from 'rxjs';

export type PushSubscribeResult = {
  success: true;
} | {
  success: false;
  error: 'service_worker_disabled' | 'permission_denied' | 'vapid_error' | 'subscription_error' | 'server_error';
};

@Injectable({
  providedIn: 'root'
})
export class PushService {
  private isSubscribed = new BehaviorSubject<boolean>(false);
  isSubscribed$ = this.isSubscribed.asObservable();

  private swPush = inject(SwPush);
  private api = inject(ApiService);
  private translationService = inject(TranslationService);

  constructor() {
    this.checkSubscription();
  }

  private checkSubscription(): void {
    if (this.swPush.isEnabled) {
      this.swPush.subscription.subscribe(sub => {
        this.isSubscribed.next(sub !== null);
      });
    }
  }

  async subscribe(): Promise<PushSubscribeResult> {
    // Check if service worker is enabled
    if (!this.swPush.isEnabled) {
      return { success: false, error: 'service_worker_disabled' };
    }

    try {
      // Get VAPID public key from backend
      let publicKey: string;
      try {
        const response = await firstValueFrom(this.api.get<{ publicKey: string }>('/push/vapid-public-key'));
        publicKey = response.publicKey;
      } catch {
        return { success: false, error: 'vapid_error' };
      }

      // Subscribe to push notifications (this triggers browser permission prompt)
      let subscription;
      try {
        subscription = await this.swPush.requestSubscription({
          serverPublicKey: publicKey
        });
      } catch (err: unknown) {
        // User denied permission or other browser error
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
          return { success: false, error: 'permission_denied' };
        }
        return { success: false, error: 'subscription_error' };
      }

      // Get current language preference
      const language = this.translationService.getCurrentLanguage();

      // Send subscription to backend with language
      const subscriptionData = {
        ...subscription.toJSON(),
        language
      };

      try {
        await firstValueFrom(this.api.post('/push/subscribe', subscriptionData));
      } catch {
        return { success: false, error: 'server_error' };
      }

      this.isSubscribed.next(true);
      return { success: true };
    } catch {
      return { success: false, error: 'subscription_error' };
    }
  }

  async unsubscribe(): Promise<boolean> {
    try {
      const subscription = await firstValueFrom(this.swPush.subscription);
      if (subscription) {
        await subscription.unsubscribe();
        await firstValueFrom(this.api.delete(`/push/unsubscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`));
      }
      this.isSubscribed.next(false);
      return true;
    } catch {
      return false;
    }
  }

  // Listen for notification clicks
  listenForClicks(): void {
    this.swPush.notificationClicks.subscribe(({ action, notification }) => {
      const url = notification.data?.url || '/';
      window.open(url, '_blank');
    });
  }
}
