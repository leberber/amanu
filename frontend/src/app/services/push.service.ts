// src/app/services/push.service.ts
import { Injectable, inject } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { ApiService } from './api.service';
import { TranslationService } from './translation.service';
import { BehaviorSubject } from 'rxjs';

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
    this.swPush.subscription.subscribe(sub => {
      this.isSubscribed.next(sub !== null);
    });
  }

  async subscribe(): Promise<boolean> {
    if (!this.swPush.isEnabled) {
      return false;
    }

    try {
      // Get VAPID public key from backend
      const { publicKey } = await this.api.get<{ publicKey: string }>('/push/vapid-public-key').toPromise() as { publicKey: string };

      // Subscribe to push notifications
      const subscription = await this.swPush.requestSubscription({
        serverPublicKey: publicKey
      });

      // Get current language preference
      const language = this.translationService.getCurrentLanguage();

      // Send subscription to backend with language
      const subscriptionData = {
        ...subscription.toJSON(),
        language
      };
      await this.api.post('/push/subscribe', subscriptionData).toPromise();

      this.isSubscribed.next(true);
      return true;
    } catch (error) {
      console.error('Failed to subscribe:', error);
      return false;
    }
  }

  async unsubscribe(): Promise<boolean> {
    try {
      const subscription = await this.swPush.subscription.toPromise();
      if (subscription) {
        await subscription.unsubscribe();
        await this.api.delete(`/push/unsubscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`).toPromise();
      }
      this.isSubscribed.next(false);
      return true;
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
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
