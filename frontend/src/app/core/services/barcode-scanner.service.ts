import { Injectable, inject, NgZone, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { Product } from '../../models/product.model';
import { Observable } from 'rxjs';

/**
 * Detects input from a USB HID barcode scanner (Tera D5100 and similar).
 * Scanners emulate keyboard input: they type characters very rapidly (<50ms between
 * keystrokes) and finish with Enter. We distinguish scanner input from real keyboard
 * input by timing and minimum character length.
 */
@Injectable({ providedIn: 'root' })
export class BarcodeScannerService implements OnDestroy {
  private apiService = inject(ApiService);
  private ngZone = inject(NgZone);

  /** Emits every confirmed barcode scan. */
  readonly scan$ = new Subject<string>();

  private buffer = '';
  private lastKeyTime = 0;
  private readonly MAX_INTER_KEY_MS = 50;  // scanner keystrokes arrive <50ms apart
  private readonly MIN_BARCODE_LENGTH = 6;

  private boundHandler = this.onKeyDown.bind(this);

  constructor() {
    // Run outside Angular zone so keydown events don't trigger unnecessary CD
    this.ngZone.runOutsideAngular(() => {
      document.addEventListener('keydown', this.boundHandler, true);
    });
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.boundHandler, true);
    this.scan$.complete();
  }

  /** Look up a product by barcode via the backend. */
  getProductByBarcode(code: string): Observable<Product> {
    return this.apiService.get<Product>(`/products/barcode/${encodeURIComponent(code)}`);
  }

  private onKeyDown(event: KeyboardEvent): void {
    // Ignore if focus is inside a regular text input that the user is typing in
    // (we still want to capture scanner input even in inputs, but we won't if
    //  the user is actively typing — scanner inter-key delay distinguishes them)
    const now = Date.now();
    const gap = now - this.lastKeyTime;
    this.lastKeyTime = now;

    if (event.key === 'Enter') {
      const code = this.buffer.trim();
      this.buffer = '';
      if (code.length >= this.MIN_BARCODE_LENGTH) {
        this.ngZone.run(() => this.scan$.next(code));
      }
      return;
    }

    // Only accumulate printable single characters
    if (event.key.length !== 1) {
      // Non-printable key (Shift, Ctrl, Alt…) — reset if too slow
      if (gap > this.MAX_INTER_KEY_MS) this.buffer = '';
      return;
    }

    if (gap > this.MAX_INTER_KEY_MS && this.buffer.length > 0) {
      // Too slow for a scanner — this is regular keyboard input; reset buffer
      this.buffer = '';
    }

    this.buffer += event.key;
  }
}
