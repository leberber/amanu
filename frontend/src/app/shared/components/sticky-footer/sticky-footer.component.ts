import { Component, input, output, computed } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { CurrencyDisplayComponent } from '../currency-display/currency-display.component';

@Component({
  selector: 'app-sticky-footer',
  standalone: true,
  imports: [TranslateModule, CurrencyDisplayComponent],
  templateUrl: './sticky-footer.component.html',
  styleUrl: './sticky-footer.component.scss'
})
export class StickyFooterComponent {
  // Inputs
  label = input<string>('common.total');
  amount = input<number>(0);
  originalAmount = input<number | undefined>(undefined);
  buttonLabel = input<string>('cart.checkout');
  buttonIcon = input<string>('pi pi-arrow-right');
  showAmount = input<boolean>(true);
  disabled = input<boolean>(false);
  showBorder = input<boolean>(true);
  showShadow = input<boolean>(true);
  paddingBottom = input<string | undefined>(undefined);
  fullWidthButton = input<boolean>(false);

  // Outputs
  buttonClick = output<void>();

  // Computed
  hasDiscount = computed(() => {
    const original = this.originalAmount();
    const current = this.amount();
    return original !== undefined && original > current;
  });

  savings = computed(() => {
    const original = this.originalAmount();
    const current = this.amount();
    if (original !== undefined && original > current) {
      return original - current;
    }
    return 0;
  });

  onButtonClick(): void {
    if (!this.disabled()) {
      this.buttonClick.emit();
    }
  }
}
