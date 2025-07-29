import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

@Component({
  selector: 'app-loading-state',
  standalone: true,
  imports: [CommonModule, ProgressSpinnerModule],
  template: `
    <div class="loading-container">
      <p-progressSpinner 
        *ngIf="type === 'spinner'"
        [style]="{width: size, height: size}"
        strokeWidth="4"
        animationDuration=".5s">
      </p-progressSpinner>
      
      <div *ngIf="type === 'skeleton'" class="skeleton-container">
        <div class="skeleton skeleton-header mb-3" style="height: 2rem; width: 60%;"></div>
        <div class="skeleton skeleton-line mb-2" style="height: 1rem;"></div>
        <div class="skeleton skeleton-line mb-2" style="height: 1rem; width: 80%;"></div>
        <div class="skeleton skeleton-line" style="height: 1rem; width: 90%;"></div>
      </div>
      
      <p class="text-muted mt-3" *ngIf="message">{{ message }}</p>
    </div>
  `
})
export class LoadingStateComponent {
  @Input() type: 'spinner' | 'skeleton' = 'spinner';
  @Input() size = '50px';
  @Input() message = '';
}