import { Injectable } from '@angular/core';

/**
 * Service for displaying row flash animations in tables.
 * Shows success/error feedback with overlay, badge, and swing animations.
 */
@Injectable({
  providedIn: 'root'
})
export class RowFlashService {
  private flashingRows = new Set<number>();

  /**
   * Flash a table row with success or error animation
   * @param rowId - The row ID (should match data-row-id attribute)
   * @param type - 'success' or 'error'
   * @param message - Message to display in the badge
   */
  flashRow(rowId: number, type: 'success' | 'error', message: string): void {
    // Prevent stacking animations on same row
    if (this.flashingRows.has(rowId)) return;
    this.flashingRows.add(rowId);

    const rowElement = document.querySelector(`tr[data-row-id="${rowId}"]`) as HTMLElement;
    if (!rowElement) {
      this.flashingRows.delete(rowId);
      return;
    }

    const isSuccess = type === 'success';
    const primaryColor = isSuccess ? '34, 197, 94' : '239, 68, 68';
    const gradientColors = isSuccess
      ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
      : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';

    // Get row position for fixed overlay (doesn't affect table layout)
    const rect = rowElement.getBoundingClientRect();

    // Swing animation on row cells (transform doesn't affect layout)
    const cells = rowElement.querySelectorAll('td');
    const swingKeyframes = isSuccess
      ? [
          { transform: 'translateX(0)' },
          { transform: 'translateX(-4px)' },
          { transform: 'translateX(3px)' },
          { transform: 'translateX(-2px)' },
          { transform: 'translateX(0)' }
        ]
      : [
          { transform: 'translateX(0)' },
          { transform: 'translateX(-6px)' },
          { transform: 'translateX(6px)' },
          { transform: 'translateX(-4px)' },
          { transform: 'translateX(4px)' },
          { transform: 'translateX(0)' }
        ];

    cells.forEach(cell => {
      cell.animate(swingKeyframes, {
        duration: isSuccess ? 300 : 400,
        easing: 'ease-out'
      });
    });

    // Create container for overlay elements (fixed position, outside table)
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      top: ${rect.top}px;
      left: ${rect.left}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      pointer-events: none;
      z-index: 1000;
      overflow: hidden;
    `;

    // Create overlay element for smooth animation
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute;
      inset: 0;
      background: rgba(${primaryColor}, 0.25);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s ease-out;
    `;

    // Create shine sweep effect
    const shine = document.createElement('div');
    shine.style.cssText = `
      position: absolute;
      top: 0;
      left: -100%;
      width: 60%;
      height: 100%;
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(255, 255, 255, 0.4) 50%,
        transparent 100%
      );
      pointer-events: none;
      transform: skewX(-20deg);
    `;

    // Create badge
    const badge = document.createElement('div');
    badge.innerHTML = `<i class="pi ${isSuccess ? 'pi-check' : 'pi-times'}" style="margin-right: 6px; font-size: 0.7rem;"></i>${message}`;
    badge.style.cssText = `
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%) scale(0.8);
      padding: 0.4rem 0.85rem;
      border-radius: 20px;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.03em;
      color: white;
      background: ${gradientColors};
      box-shadow: 0 4px 15px rgba(${primaryColor}, 0.4);
      z-index: 100;
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      display: flex;
      align-items: center;
    `;

    container.appendChild(overlay);
    container.appendChild(shine);
    container.appendChild(badge);
    document.body.appendChild(container);

    // Trigger animation (next frame)
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      badge.style.opacity = '1';
      badge.style.transform = 'translate(-50%, -50%) scale(1)';

      // Animate shine sweep
      shine.animate([
        { left: '-100%' },
        { left: '200%' }
      ], {
        duration: 600,
        easing: 'ease-in-out'
      });
    });

    // Timing based on type - errors stay longer
    const overlayFadeTime = isSuccess ? 500 : 800;
    const badgeFadeTime = isSuccess ? 1200 : 3000;
    const cleanupTime = isSuccess ? 1600 : 3500;

    // Fade out overlay
    setTimeout(() => {
      overlay.style.opacity = '0';
    }, overlayFadeTime);

    // Fade out badge
    setTimeout(() => {
      badge.style.opacity = '0';
      badge.style.transform = 'translate(-50%, -50%) scale(0.8)';
    }, badgeFadeTime);

    // Clean up
    setTimeout(() => {
      container.remove();
      this.flashingRows.delete(rowId);
    }, cleanupTime);
  }

  /**
   * Check if a row is currently flashing
   */
  isFlashing(rowId: number): boolean {
    return this.flashingRows.has(rowId);
  }
}
