import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-error-state',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  template: `
    <div class="error-state text-center p-6">
      <i class="pi pi-exclamation-triangle text-error" 
         style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
      <h3 class="text-xl font-semibold mb-2">{{ title }}</h3>
      <p class="text-muted mb-4">{{ message }}</p>
      
      <div class="flex-center gap-2" *ngIf="showRetry || showGoBack">
        <button 
          *ngIf="showRetry"
          pButton 
          label="Try Again"
          icon="pi pi-refresh"
          (click)="onRetry()"
          class="p-button-primary">
        </button>
        <button 
          *ngIf="showGoBack"
          pButton 
          label="Go Back"
          icon="pi pi-arrow-left"
          (click)="onGoBack()"
          class="p-button-secondary">
        </button>
      </div>
      
      <details *ngIf="details" class="mt-4 text-left">
        <summary class="cursor-pointer text-muted">Technical Details</summary>
        <pre class="mt-2 p-3 bg-tertiary rounded text-sm">{{ details }}</pre>
      </details>
    </div>
  `
})
export class ErrorStateComponent {
  @Input() title = 'Something went wrong';
  @Input() message = 'An unexpected error occurred. Please try again.';
  @Input() details = '';
  @Input() showRetry = true;
  @Input() showGoBack = false;
  @Input() retry?: () => void;
  @Input() goBack?: () => void;
  
  onRetry(): void {
    if (this.retry) {
      this.retry();
    }
  }
  
  onGoBack(): void {
    if (this.goBack) {
      this.goBack();
    } else {
      window.history.back();
    }
  }
}