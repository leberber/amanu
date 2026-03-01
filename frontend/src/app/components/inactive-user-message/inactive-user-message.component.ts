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
  // Which button to show: 'login' or 'understood'
  buttonType = input<'login' | 'understood'>('understood');

  // Emit when button is clicked
  buttonClick = output<void>();

  onButtonClick(): void {
    this.buttonClick.emit();
  }
}
