import { Component, input, output, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { NavigationService } from '../../../core/services/navigation.service';

@Component({
  selector: 'app-back-button',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './back-button.component.html',
  styleUrl: './back-button.component.scss'
})
export class BackButtonComponent {
  private nav = inject(NavigationService);

  route = input('/');
  label = input('actions.go_back');
  showLabel = input(true);
  circular = input(false);
  fixed = input(false);
  customHandler = input(false);
  buttonClick = output<void>();

  handleClick(event: Event): void {
    event.preventDefault();

    if (this.customHandler()) {
      this.buttonClick.emit();
      return;
    }

    // Always use NavigationService for correct backward animation
    this.nav.back(this.route());
  }
}
