import { Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [TranslateModule, RouterLink],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss'
})
export class EmptyStateComponent {
  // Signal inputs
  icon = input('pi-inbox');
  title = input('common.no_data');
  description = input<string | undefined>();
  actionLabel = input<string | undefined>();
  actionLink = input<string | any[] | undefined>();
  actionIcon = input('pi pi-plus');

  // Signal output
  actionClick = output<void>();

  onActionClick(): void {
    this.actionClick.emit();
  }
}
