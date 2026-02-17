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
    console.log('Subscribe called, swPush.isEnabled:', this.swPush.isEnabled);

    if (!this.swPush.isEnabled) {
      console.log('Push notifications not supported - service worker not active');
      return false;
    }

    try {
      // Get VAPID public key from backend
      console.log('Getting VAPID public key...');
      const { publicKey } = await this.api.get<{ publicKey: string }>('/push/vapid-public-key').toPromise() as { publicKey: string };
      console.log('Got public key:', publicKey);

      // Subscribe to push notifications
      console.log('Requesting subscription...');
      const subscription = await this.swPush.requestSubscription({
        serverPublicKey: publicKey
      });
      console.log('Got subscription:', subscription.toJSON());

      // Send subscription to backend
      console.log('Sending subscription to backend...');
      await this.api.post('/push/subscribe', subscription.toJSON()).toPromise();
      console.log('Subscription saved!');

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
