import { Component, computed, inject, input } from '@angular/core';
import { CurrencyService } from '../../../core/services/currency.service';

@Component({
  selector: 'app-currency',
  standalone: true,
  host: { style: 'display: contents' },
  template: `
    <span>{{ parts().integer }}</span><span class="currency-decimal">{{ parts().separator }}{{ parts().decimal }}</span><span> {{ parts().symbol }}</span>
  `,
  styles: [`
    .currency-decimal {
      opacity: 0.45;
    }
  `]
})
export class CurrencyDisplayComponent {
  value = input<number | null | undefined>(0);

  private currencyService = inject(CurrencyService);

  protected parts = computed(() => this.currencyService.formatCurrencyParts(this.value() ?? 0));
}
