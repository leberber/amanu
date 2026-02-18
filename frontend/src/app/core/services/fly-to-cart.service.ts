import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class FlyToCartService {
  private readonly ANIMATION_DURATION = 700; // milliseconds

  /**
   * Animate an element flying from a source position to the cart icon
   * @param sourceElement The element to animate from (e.g., add to cart button)
   * @param imageUrl Optional product image URL to show in the flying element
   */
  animate(sourceElement: HTMLElement, imageUrl?: string): void {
    // Find the visible cart icon (bottom nav preferred on mobile, then desktop header)
    const bottomNavIcon = document.querySelector('#cart-icon-bottom') as HTMLElement;
    const desktopIcon = document.querySelector('#cart-icon') as HTMLElement;
    const mobileHeaderIcon = document.querySelector('#cart-icon-mobile') as HTMLElement;

    // Check which icon is actually visible - prefer bottom nav on mobile
    let cartIcon: HTMLElement | null = null;

    if (bottomNavIcon && this.isElementVisible(bottomNavIcon)) {
      cartIcon = bottomNavIcon;
    } else if (desktopIcon && this.isElementVisible(desktopIcon)) {
      cartIcon = desktopIcon;
    } else if (mobileHeaderIcon && this.isElementVisible(mobileHeaderIcon)) {
      cartIcon = mobileHeaderIcon;
    }

    if (!cartIcon) {
      console.warn('No visible cart icon found');
      return;
    }

    const sourceRect = sourceElement.getBoundingClientRect();
    const targetRect = cartIcon.getBoundingClientRect();

    // Validate rects have valid dimensions
    if (targetRect.width === 0 || targetRect.height === 0) {
      console.warn('Cart icon has no dimensions');
      return;
    }

    // Calculate positions
    const startX = sourceRect.left + sourceRect.width / 2;
    const startY = sourceRect.top + sourceRect.height / 2;
    const endX = targetRect.left + targetRect.width / 2;
    const endY = targetRect.top + targetRect.height / 2;

    // Create the flying element
    const flyingElement = this.createFlyingElement(imageUrl);

    // Position it at the start
    flyingElement.style.left = `${startX}px`;
    flyingElement.style.top = `${startY}px`;

    document.body.appendChild(flyingElement);

    // Force reflow to ensure initial position is applied
    flyingElement.offsetHeight;

    // Calculate control point for bezier curve (arc above)
    const controlY = Math.min(startY, endY) - 100;

    // Animate using requestAnimationFrame for smooth bezier path
    const startTime = performance.now();

    const animateFrame = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / this.ANIMATION_DURATION, 1);

      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      // Quadratic bezier curve
      const t = easeProgress;
      const controlX = (startX + endX) / 2;

      const x = Math.pow(1 - t, 2) * startX + 2 * (1 - t) * t * controlX + Math.pow(t, 2) * endX;
      const y = Math.pow(1 - t, 2) * startY + 2 * (1 - t) * t * controlY + Math.pow(t, 2) * endY;

      // Scale down as it approaches target
      const scale = 1 - (easeProgress * 0.6);

      // Fade out near the end
      const opacity = progress > 0.7 ? 1 - ((progress - 0.7) / 0.3) : 1;

      flyingElement.style.left = `${x}px`;
      flyingElement.style.top = `${y}px`;
      flyingElement.style.transform = `translate(-50%, -50%) scale(${scale})`;
      flyingElement.style.opacity = `${opacity}`;

      if (progress < 1) {
        requestAnimationFrame(animateFrame);
      } else {
        flyingElement.remove();
        this.pulseCartIcon(cartIcon as HTMLElement);
      }
    };

    requestAnimationFrame(animateFrame);
  }

  private createFlyingElement(imageUrl?: string): HTMLElement {
    const element = document.createElement('div');
    element.className = 'fly-to-cart-element';

    // Base styles
    element.style.cssText = `
      position: fixed;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      pointer-events: none;
      z-index: 99999;
      transform: translate(-50%, -50%);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
      will-change: left, top, transform, opacity;
    `;

    if (imageUrl) {
      // Use product image
      element.style.backgroundImage = `url(${imageUrl})`;
      element.style.backgroundSize = 'cover';
      element.style.backgroundPosition = 'center';
      element.style.border = '3px solid var(--primary-color, #10b981)';
      element.style.backgroundColor = '#fff';
    } else {
      // Use a simple cart icon
      element.style.backgroundColor = 'var(--primary-color, #10b981)';
      element.style.display = 'flex';
      element.style.alignItems = 'center';
      element.style.justifyContent = 'center';
      element.innerHTML = '<i class="pi pi-shopping-cart" style="color: white; font-size: 1.2rem;"></i>';
    }

    return element;
  }

  private pulseCartIcon(cartIcon: HTMLElement): void {
    // Add a subtle pulse animation to the cart icon
    const originalTransform = cartIcon.style.transform;
    cartIcon.style.transition = 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    cartIcon.style.transform = 'scale(1.4)';

    setTimeout(() => {
      cartIcon.style.transform = originalTransform || 'scale(1)';
      setTimeout(() => {
        cartIcon.style.transition = '';
      }, 200);
    }, 200);
  }

  private isElementVisible(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0'
    );
  }
}
