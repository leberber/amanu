import { Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ROUTES } from '../../core/constants/routes.constants';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [TranslateModule, PageLayoutComponent],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss'
})
export class AboutComponent {
  readonly routes = ROUTES;
}
