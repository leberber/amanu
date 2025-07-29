import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  template: `
    <div class="empty-state">
      <i [class]="'pi ' + icon + ' empty-state-icon'"></i>
      <p class="empty-state-message">{{ message }}</p>
      <p class="text-muted" *ngIf="description">{{ description }}</p>
      <button 
        *ngIf="actionLabel" 
        pButton 
        [label]="actionLabel"
        [icon]="actionIcon"
        (click)="onActionClick()"
        class="mt-3">
      </button>
    </div>
  `
})
export class EmptyStateComponent {
  @Input() icon = 'pi-inbox';
  @Input() message = 'No data available';
  @Input() description = '';
  @Input() actionLabel = '';
  @Input() actionIcon = '';
  @Input() action?: () => void;
  
  onActionClick(): void {
    if (this.action) {
      this.action();
    }
  }
}