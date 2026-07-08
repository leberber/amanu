import { Component, computed, inject, input } from '@angular/core';
import { CurrencyService } from '../../../core/services/currency.service';

@Component({
  selector: 'app-currency',
  standalone: true,
  host: { style: 'display: inline' },
  template: `
    <span>{{ parts().integer }}{{ parts().separator }}{{ parts().decimal }} {{ parts().symbol }}</span>
  `,
  styles: [`
    :host { white-space: nowrap; }
  `]
})
export class CurrencyDisplayComponent {
  value = input<number | null | undefined>(0);
  hideDecimals = input<boolean>(false);
  hideSymbol = input<boolean>(false);

  private currencyService = inject(CurrencyService);

  protected parts = computed(() => {
    const p = this.currencyService.formatCurrencyParts(this.value() ?? 0);
    const symbol = this.hideSymbol() ? '' : p.symbol;
    if (this.hideDecimals()) return { ...p, decimal: '', separator: '', symbol };
    return { ...p, symbol };
  });
}
