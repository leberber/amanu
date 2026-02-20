import { Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-error-state',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './error-state.component.html',
  styleUrl: './error-state.component.scss'
})
export class ErrorStateComponent {
  // Signal inputs
  title = input('common.error_title');
  message = input('common.error_message');
  details = input('');
  showRetry = input(true);
  showGoBack = input(false);

  // Signal outputs
  retryClick = output<void>();
  goBackClick = output<void>();

  onRetry(): void {
    this.retryClick.emit();
  }

  onGoBack(): void {
    this.goBackClick.emit();
  }
}
