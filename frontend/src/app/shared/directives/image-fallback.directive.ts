import { Directive, ElementRef, HostListener, input, inject } from '@angular/core';
import { DEFAULTS } from '../../core/constants/app.constants';

/**
 * Directive for consistent image error handling.
 * Shows a fallback image or hides the image and shows an icon.
 *
 * Usage:
 *   <!-- Replace with fallback image -->
 *   <img [src]="product.image" appImageFallback>
 *
 *   <!-- Custom fallback image -->
 *   <img [src]="product.image" appImageFallback="assets/images/custom.png">
 *
 *   <!-- Hide image and show sibling icon (for admin tables) -->
 *   <img [src]="product.image" appImageFallback [hideOnError]="true">
 */
@Directive({
  selector: 'img[appImageFallback]',
  standalone: true
})
export class ImageFallbackDirective {
  private el = inject(ElementRef<HTMLImageElement>);
  private hasErrored = false;

  /** Fallback image URL. Defaults to product placeholder from constants. */
  appImageFallback = input<string>(DEFAULTS.PLACEHOLDER_IMAGE);

  /** If true, hides image and shows sibling icon instead of replacing src */
  hideOnError = input<boolean>(false);

  @HostListener('error')
  onError(): void {
    // Prevent infinite loop if fallback also fails
    if (this.hasErrored) return;
    this.hasErrored = true;

    const img = this.el.nativeElement;

    if (this.hideOnError()) {
      // Hide image and show sibling icon (used in admin tables)
      img.style.display = 'none';
      img.parentElement?.querySelector('i')?.classList.remove('hidden');
    } else {
      // Replace with fallback image
      img.src = this.appImageFallback();
    }
  }
}
