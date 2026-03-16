import {
  Directive,
  ElementRef,
  inject,
  input,
  output,
  signal,
  OnInit,
  OnDestroy
} from '@angular/core';

/**
 * Pull-to-refresh directive for mobile touch gestures.
 *
 * Usage:
 * ```html
 * <div
 *   appPullToRefresh
 *   [scrollContainer]="'.driver-content'"
 *   (refresh)="loadData()">
 * </div>
 * ```
 */
@Directive({
  selector: '[appPullToRefresh]',
  standalone: true,
  exportAs: 'pullToRefresh'
})
export class PullToRefreshDirective implements OnInit, OnDestroy {
  private readonly el = inject(ElementRef);

  /** CSS selector for the scroll container to check scroll position */
  scrollContainer = input<string>('');

  /** Emitted when pull threshold is reached and refresh should happen */
  refresh = output<void>();

  /** Current pull distance in pixels (for binding to UI) */
  readonly pullDistance = signal(0);

  /** Whether refresh is in progress */
  readonly isRefreshing = signal(false);

  // Configuration
  private readonly PULL_THRESHOLD = 60;
  private readonly PULL_MAX = 80;
  private readonly PULL_RESISTANCE = 0.4;
  private readonly REFRESH_INDICATOR_HEIGHT = 40;
  private readonly REFRESH_DURATION = 1000;

  // State
  private isPulling = false;
  private startY = 0;

  // Bound event handlers
  private boundTouchStart = this.onTouchStart.bind(this);
  private boundTouchMove = this.onTouchMove.bind(this);
  private boundTouchEnd = this.onTouchEnd.bind(this);

  ngOnInit(): void {
    const element = this.el.nativeElement as HTMLElement;
    element.addEventListener('touchstart', this.boundTouchStart, { passive: true });
    element.addEventListener('touchmove', this.boundTouchMove, { passive: true });
    element.addEventListener('touchend', this.boundTouchEnd, { passive: true });
  }

  ngOnDestroy(): void {
    const element = this.el.nativeElement as HTMLElement;
    element.removeEventListener('touchstart', this.boundTouchStart);
    element.removeEventListener('touchmove', this.boundTouchMove);
    element.removeEventListener('touchend', this.boundTouchEnd);
  }

  private onTouchStart(event: TouchEvent): void {
    const scrollTop = this.getScrollTop();
    if (scrollTop === 0) {
      this.startY = event.touches[0].clientY;
      this.isPulling = true;
    }
  }

  private onTouchMove(event: TouchEvent): void {
    if (!this.isPulling || this.isRefreshing()) return;

    const diff = event.touches[0].clientY - this.startY;
    if (diff > 0) {
      this.pullDistance.set(Math.min(diff * this.PULL_RESISTANCE, this.PULL_MAX));
    }
  }

  private onTouchEnd(): void {
    if (!this.isPulling) return;

    if (this.pullDistance() >= this.PULL_THRESHOLD) {
      this.isRefreshing.set(true);
      this.pullDistance.set(this.REFRESH_INDICATOR_HEIGHT);
      this.refresh.emit();

      setTimeout(() => {
        this.pullDistance.set(0);
        this.isRefreshing.set(false);
      }, this.REFRESH_DURATION);
    } else {
      this.pullDistance.set(0);
    }
    this.isPulling = false;
  }

  private getScrollTop(): number {
    const selector = this.scrollContainer();
    if (selector) {
      const container = document.querySelector(selector);
      return container?.scrollTop || 0;
    }
    return this.el.nativeElement.scrollTop || 0;
  }
}
