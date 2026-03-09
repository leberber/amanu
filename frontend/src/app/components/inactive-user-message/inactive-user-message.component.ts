import { Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-inactive-user-message',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './inactive-user-message.component.html',
  styleUrl: './inactive-user-message.component.scss'
})
export class InactiveUserMessageComponent {
  // Which button to show: 'login', 'understood', 'home', or 'none' to hide
  buttonType = input<'login' | 'understood' | 'home' | 'none'>('understood');

  // User type: 'customer' or 'driver' for different messaging
  userType = input<'customer' | 'driver'>('customer');

  // Emit when button is clicked
  buttonClick = output<void>();

  onButtonClick(): void {
    this.buttonClick.emit();
  }
}
