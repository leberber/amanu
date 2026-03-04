import { Component, inject, signal, computed } from '@angular/core';
import { NgClass } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';
import { CustomToastService, ToastMessage } from '../../../core/services/custom-toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [NgClass],
  template: `
    @for (toast of toasts(); track toast.id) {
      <div
        class="toast"
        [ngClass]="'toast--' + toast.severity"
        [@toastAnimation]="toast.state"
        (@toastAnimation.done)="onAnimationDone($event, toast)">

        <!-- Left accent stripe -->
        <div class="toast__accent"></div>

        <!-- Icon -->
        <div class="toast__icon" [ngClass]="'toast__icon--' + toast.severity">
          @switch (toast.severity) {
            @case ('success') {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            }
            @case ('error') {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            }
            @case ('warn') {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            }
            @case ('info') {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            }
          }
        </div>

        <!-- Content -->
        <div class="toast__content">
          <span class="toast__summary">{{ toast.summary }}</span>
          @if (toast.detail) {
            <span class="toast__detail">{{ toast.detail }}</span>
          }
        </div>

        <!-- Close button -->
        <button class="toast__close" (click)="close(toast)" type="button" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <!-- Progress bar -->
        <div
          class="toast__progress"
          [ngClass]="'toast__progress--' + toast.severity"
          [style.animation-duration]="toast.life + 'ms'">
        </div>
      </div>
    }
  `,
  styleUrl: './toast.component.scss',
  animations: [
    trigger('toastAnimation', [
      transition(':enter', [
        style({ transform: 'translateY(-100%)', opacity: 0 }),
        animate('400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          style({ transform: 'translateY(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('250ms cubic-bezier(0.4, 0, 1, 1)',
          style({ transform: 'translateY(-100%)', opacity: 0 }))
      ])
    ])
  ]
})
export class ToastComponent {
  private toastService = inject(CustomToastService);

  toasts = this.toastService.toasts;

  close(toast: ToastMessage): void {
    this.toastService.remove(toast.id);
  }

  onAnimationDone(event: any, toast: ToastMessage): void {
    // Animation callback if needed
  }
}
