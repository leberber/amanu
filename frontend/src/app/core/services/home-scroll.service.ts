import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class HomeScrollService {
  /** True once user scrolls past the initial hero on the home page */
  scrolledDown = signal(false);
  /** True when the home footer is near the bottom of the viewport */
  nearFooter = signal(false);

  reset(): void {
    this.scrolledDown.set(false);
    this.nearFooter.set(false);
  }
}
