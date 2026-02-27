import { Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ROUTES } from '../../core/constants/routes.constants';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';

interface TermsSection {
  number: number;
  titleKey: string;
  textKey: string;
}

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [TranslateModule, PageLayoutComponent],
  templateUrl: './terms.component.html',
  styleUrl: './terms.component.scss'
})
export class TermsComponent {
  readonly routes = ROUTES;

  readonly sections: TermsSection[] = [
    { number: 1, titleKey: 'terms.acceptance_title', textKey: 'terms.acceptance_text' },
    { number: 2, titleKey: 'terms.services_title', textKey: 'terms.services_text' },
    { number: 3, titleKey: 'terms.account_title', textKey: 'terms.account_text' },
    { number: 4, titleKey: 'terms.orders_title', textKey: 'terms.orders_text' },
    { number: 5, titleKey: 'terms.payment_title', textKey: 'terms.payment_text' },
    { number: 6, titleKey: 'terms.delivery_title', textKey: 'terms.delivery_text' },
    { number: 7, titleKey: 'terms.returns_title', textKey: 'terms.returns_text' },
    { number: 8, titleKey: 'terms.liability_title', textKey: 'terms.liability_text' },
    { number: 9, titleKey: 'terms.changes_title', textKey: 'terms.changes_text' }
  ];
}
