import { Component, input } from '@angular/core';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

@Component({
  selector: 'app-loading-state',
  standalone: true,
  imports: [ProgressSpinnerModule],
  templateUrl: './loading-state.component.html',
  styleUrl: './loading-state.component.scss'
})
export class LoadingStateComponent {
  // Signal inputs
  type = input<'spinner' | 'skeleton'>('skeleton');
  size = input('50px');
  message = input('');

  // Skeleton configuration
  lines = input(3);
  showHeader = input(true);
}
