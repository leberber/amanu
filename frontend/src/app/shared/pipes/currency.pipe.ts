import { Pipe, PipeTransform, inject } from '@angular/core';
import { CurrencyService } from '../../core/services/currency.service';

@Pipe({
  name: 'appCurrency',
  standalone: true
})
export class CurrencyPipe implements PipeTransform {
  private currencyService = inject(CurrencyService);

  transform(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '';
    }
    return this.currencyService.formatCurrency(value);
  }
}
