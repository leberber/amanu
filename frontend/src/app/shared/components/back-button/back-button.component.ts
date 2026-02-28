import { Component, input, output, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Location } from '@angular/common';

@Component({
  selector: 'app-back-button',
  standalone: true,
  imports: [RouterLink, TranslateModule],
  templateUrl: './back-button.component.html',
  styleUrl: './back-button.component.scss'
})
export class BackButtonComponent {
  private location = inject(Location);
  private router = inject(Router);

  route = input('/');
  label = input('actions.go_back');
  showLabel = input(true);
  circular = input(false);
  fixed = input(false);
  useHistory = input(true); // Default to using history for proper backward animation
  customHandler = input(false); // Set to true when using buttonClick output
  buttonClick = output<void>();

  handleClick(event: Event): void {
    // If there's a custom click handler, use it
    if (this.customHandler()) {
      event.preventDefault();
      this.buttonClick.emit();
      return;
    }

    // Use history.back() for proper backward animation
    if (this.useHistory()) {
      event.preventDefault();
      // Check if we have history to go back to
      if (window.history.length > 1) {
        this.location.back();
      } else {
        // Fallback to route if no history
        this.router.navigate([this.route()]);
      }
    }
    // Otherwise let routerLink handle it
  }
}
