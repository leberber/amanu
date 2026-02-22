import { Injectable } from '@angular/core';

/**
 * Service for managing overlay/modal body scroll state
 * Prevents body scroll when modals/overlays are open
 */
@Injectable({
  providedIn: 'root'
})
export class OverlayService {
  private activeOverlays = 0;

  /**
   * Lock body scroll when opening an overlay
   */
  open(className?: string): void {
    this.activeOverlays++;
    if (this.activeOverlays === 1) {
      document.body.style.overflow = 'hidden';
    }
    if (className) {
      document.body.classList.add(className);
    }
  }

  /**
   * Restore body scroll when closing an overlay
   */
  close(className?: string): void {
    this.activeOverlays = Math.max(0, this.activeOverlays - 1);
    if (this.activeOverlays === 0) {
      document.body.style.overflow = '';
    }
    if (className) {
      document.body.classList.remove(className);
    }
  }

  /**
   * Force close all overlays
   */
  closeAll(): void {
    this.activeOverlays = 0;
    document.body.style.overflow = '';
  }
}
