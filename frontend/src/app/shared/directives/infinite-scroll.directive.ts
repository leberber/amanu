import { Directive, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';

/**
 * Directive that emits an event when the user scrolls near the bottom of an element.
 * Used for implementing infinite scroll / lazy loading.
 *
 * Usage:
 * ```html
 * <div class="scrollable-container"
 *      appInfiniteScroll
 *      [scrollThreshold]="200"
 *      [disabled]="loadingMore() || !hasMore()"
 *      (scrolledToBottom)="loadMore()">
 * </div>
 * ```
 */
@Directive({
  selector: '[appInfiniteScroll]',
  standalone: true
})
export class InfiniteScrollDirective implements OnInit, OnDestroy {
  /** Distance from bottom (in pixels) to trigger the event. Default: 200px */
  @Input() scrollThreshold = 200;

  /** Disable scroll detection (e.g., when loading or no more items) */
  @Input() disabled = false;

  /** Emitted when user scrolls near the bottom */
  @Output() scrolledToBottom = new EventEmitter<void>();

  private elementRef = inject(ElementRef);
  private scrollListener: (() => void) | null = null;

  ngOnInit(): void {
    this.setupScrollListener();
  }

  ngOnDestroy(): void {
    this.removeScrollListener();
  }

  private setupScrollListener(): void {
    const element = this.elementRef.nativeElement;
    this.scrollListener = this.onScroll.bind(this);
    element.addEventListener('scroll', this.scrollListener);
  }

  private removeScrollListener(): void {
    if (this.scrollListener) {
      const element = this.elementRef.nativeElement;
      element.removeEventListener('scroll', this.scrollListener);
    }
  }

  private onScroll(): void {
    if (this.disabled) return;

    const element = this.elementRef.nativeElement;
    const { scrollTop, scrollHeight, clientHeight } = element;

    if (scrollTop + clientHeight >= scrollHeight - this.scrollThreshold) {
      this.scrolledToBottom.emit();
    }
  }
}
