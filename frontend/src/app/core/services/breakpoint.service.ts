import { Injectable, signal, DestroyRef, inject } from '@angular/core';
import { BREAKPOINTS } from '../constants/app.constants';

/**
 * Centralized service for responsive breakpoint detection.
 * Eliminates duplicate window.innerWidth checks and resize listeners across components.
 *
 * Usage:
 *   private breakpoint = inject(BreakpointService);
 *
 *   // In template: @if (breakpoint.isMobile()) { ... }
 *   // In code: if (this.breakpoint.isMobile()) { ... }
 */
@Injectable({
  providedIn: 'root'
})
export class BreakpointService {
  /** True when viewport width <= 768px (MD breakpoint) */
  readonly isMobile = signal(this.checkMobile());

  /** True when viewport width <= 992px (LG breakpoint) */
  readonly isTablet = signal(this.checkTablet());

  /** True when viewport width > 992px */
  readonly isDesktop = signal(this.checkDesktop());

  /** Current viewport width */
  readonly width = signal(this.getWidth());

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.onResize.bind(this));
    }
  }

  private onResize(): void {
    this.width.set(this.getWidth());
    this.isMobile.set(this.checkMobile());
    this.isTablet.set(this.checkTablet());
    this.isDesktop.set(this.checkDesktop());
  }

  private getWidth(): number {
    return typeof window !== 'undefined' ? window.innerWidth : BREAKPOINTS.LG;
  }

  private checkMobile(): boolean {
    return this.getWidth() <= BREAKPOINTS.MD;
  }

  private checkTablet(): boolean {
    return this.getWidth() <= BREAKPOINTS.LG;
  }

  private checkDesktop(): boolean {
    return this.getWidth() > BREAKPOINTS.LG;
  }
}
