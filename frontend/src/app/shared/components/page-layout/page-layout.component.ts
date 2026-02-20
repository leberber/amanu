import { Component, input } from '@angular/core';
import { BackButtonComponent } from '../back-button/back-button.component';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-page-layout',
  standalone: true,
  imports: [BackButtonComponent, TranslateModule],
  templateUrl: './page-layout.component.html',
  styleUrl: './page-layout.component.scss'
})
export class PageLayoutComponent {
  // Page title - displayed in top bar (optional if using pageHeader slot)
  title = input<string>('');

  // Back button configuration
  showBackButton = input(true);
  backRoute = input('/');

  // Optional: hide bottom nav padding (for fullscreen pages)
  fullscreen = input(false);
}
