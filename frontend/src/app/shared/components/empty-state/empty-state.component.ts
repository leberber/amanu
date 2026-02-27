import { Component, input, output, computed } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';

type IconVariant = 'primary' | 'warning' | 'success' | 'danger' | 'purple';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [TranslateModule, RouterLink],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss'
})
export class EmptyStateComponent {
  icon = input('pi-inbox');
  iconVariant = input<IconVariant>('primary');
  title = input('common.no_data');
  description = input<string | undefined>();
  actionLabel = input<string | undefined>();
  actionLink = input<string | any[] | undefined>();
  actionIcon = input('pi pi-plus');
  compact = input(false);

  actionClick = output<void>();

  iconClass = computed(() => {
    const variant = this.iconVariant();
    return variant === 'primary' ? 'empty-state__icon' : `empty-state__icon empty-state__icon--${variant}`;
  });

  onActionClick(): void {
    this.actionClick.emit();
  }
}
