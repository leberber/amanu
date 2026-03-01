import { Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { CurrencyPipe } from '../../pipes/currency.pipe';

@Component({
  selector: 'app-sticky-footer',
  standalone: true,
  imports: [TranslateModule, CurrencyPipe],
  templateUrl: './sticky-footer.component.html',
  styleUrl: './sticky-footer.component.scss'
})
export class StickyFooterComponent {
  // Inputs
  label = input<string>('common.total');
  amount = input<number>(0);
  buttonLabel = input<string>('cart.checkout');
  buttonIcon = input<string>('pi pi-arrow-right');
  showAmount = input<boolean>(true);
  disabled = input<boolean>(false);
  showBorder = input<boolean>(true);
  showShadow = input<boolean>(true);
  paddingBottom = input<string | undefined>(undefined);

  // Outputs
  buttonClick = output<void>();

  onButtonClick(): void {
    if (!this.disabled()) {
      this.buttonClick.emit();
    }
  }
}
