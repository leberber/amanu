import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, TranslateModule, ButtonModule, RouterLink],
  template: `
    <div class="empty-state text-center py-5">
      <i [class]="'pi ' + icon + ' text-6xl text-300 mb-4'" style="display: block;"></i>
      <h3 class="text-xl font-medium text-600 mb-3">
        {{ title | translate }}
      </h3>
      <p class="text-500 mb-4" *ngIf="description">
        {{ description | translate }}
      </p>
      
      <!-- Action button with router link -->
      <p-button 
        *ngIf="actionLabel && actionLink"
        [label]="actionLabel | translate"
        [routerLink]="actionLink"
        [icon]="actionIcon"
        styleClass="p-button-primary"
      ></p-button>
      
      <!-- Action button with click handler -->
      <p-button 
        *ngIf="actionLabel && action && !actionLink"
        [label]="actionLabel | translate"
        (onClick)="onActionClick()"
        [icon]="actionIcon"
        styleClass="p-button-primary"
      ></p-button>
      
      <!-- Custom action via content projection -->
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    .empty-state {
      padding: 3rem 1rem;
      max-width: 400px;
      margin: 0 auto;
    }
  `]
})
export class EmptyStateComponent {
  @Input() icon = 'pi-inbox';
  @Input() title = 'common.no_data';
  @Input() description?: string;
  @Input() actionLabel?: string;
  @Input() actionLink?: string | any[];
  @Input() actionIcon = 'pi pi-plus';
  @Input() action?: () => void;
  
  onActionClick(): void {
    if (this.action) {
      this.action();
    }
  }
}