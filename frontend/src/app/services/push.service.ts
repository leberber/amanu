// src/app/services/push.service.ts
import { Injectable } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { ApiService } from './api.service';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PushService {
  private isSubscribed = new BehaviorSubject<boolean>(false);
  isSubscribed$ = this.isSubscribed.asObservable();

  constructor(
    private swPush: SwPush,
    private api: ApiService
  ) {
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

      // Send subscription to backend
      await this.api.post('/push/subscribe', subscription.toJSON()).toPromise();

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
