import { Directive, ElementRef, HostListener, input } from '@angular/core';

/**
 * Directive to handle image loading errors with fallback
 *
 * Usage:
 * <img [src]="imageUrl" appImageFallback>
 * <img [src]="imageUrl" appImageFallback="assets/images/custom-placeholder.jpg">
 */
@Directive({
  selector: 'img[appImageFallback]',
  standalone: true
})
export class ImageFallbackDirective {
  private static readonly DEFAULT_PRODUCT_PLACEHOLDER = 'assets/images/product-placeholder.jpg';
  private hasErrored = false;

  /**
   * Custom fallback image path. Defaults to product placeholder.
   */
  appImageFallback = input<string>(ImageFallbackDirective.DEFAULT_PRODUCT_PLACEHOLDER);

  constructor(private el: ElementRef<HTMLImageElement>) {}

  @HostListener('error')
  onError(): void {
    if (this.hasErrored) return;
    this.hasErrored = true;
    this.el.nativeElement.src = this.appImageFallback();
  }
}
