import { Component, input, output } from '@angular/core';
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

  // Subtitle - displayed below title on desktop
  subtitle = input<string>('');

  // Mobile short title (e.g., 'Produit' instead of 'Ajouter Nouveau Produit')
  mobileTitle = input<string>('');

  // Mobile short subtitle (e.g., 'ajouter')
  mobileSubtitle = input<string>('');

  // Icon class for desktop header (e.g., 'pi pi-box')
  icon = input<string>('');

  // Back button configuration
  showBackButton = input(true);
  backRoute = input('/');

  // Optional: hide bottom nav padding (for fullscreen pages)
  fullscreen = input(false);

  // Optional: add border around content area
  contentBorder = input(false);

  // Optional: hide icon on mobile and center text
  hideMobileIcon = input(false);

  // Optional: use static header instead of fixed (for use inside animated containers)
  staticHeader = input(false);

  // Optional: remove side margins and max-width from content area
  fullWidth = input(false);

  // Optional: intercept back button click instead of navigating
  backCustomHandler = input(false);
  backClick = output<void>();
}
