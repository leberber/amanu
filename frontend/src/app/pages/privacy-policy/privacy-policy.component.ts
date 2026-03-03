import { Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ROUTES } from '../../core/constants/routes.constants';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';

interface PrivacySection {
  number: number;
  titleKey: string;
  textKey: string;
  hasList?: boolean;
  listKey?: string;
}

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [TranslateModule, PageLayoutComponent],
  templateUrl: './privacy-policy.component.html',
  styleUrl: './privacy-policy.component.scss'
})
export class PrivacyPolicyComponent {
  readonly routes = ROUTES;

  readonly sections: PrivacySection[] = [
    { number: 1, titleKey: 'privacy.introduction_title', textKey: 'privacy.introduction_text' },
    { number: 2, titleKey: 'privacy.collection_title', textKey: 'privacy.collection_text' },
    { number: 3, titleKey: 'privacy.log_data_title', textKey: 'privacy.log_data_text' },
    { number: 4, titleKey: 'privacy.cookies_title', textKey: 'privacy.cookies_text' },
    { number: 5, titleKey: 'privacy.service_providers_title', textKey: 'privacy.service_providers_text', hasList: true, listKey: 'privacy.service_providers_list' },
    { number: 6, titleKey: 'privacy.security_title', textKey: 'privacy.security_text' },
    { number: 7, titleKey: 'privacy.children_title', textKey: 'privacy.children_text' },
    { number: 8, titleKey: 'privacy.changes_title', textKey: 'privacy.changes_text' }
  ];
}
