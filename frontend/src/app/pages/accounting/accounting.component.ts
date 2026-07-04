import { Component } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';

@Component({
  selector: 'app-accounting',
  standalone: true,
  imports: [PageLayoutComponent],
  template: `
    <app-page-layout
      title="accounting.title"
      subtitle="accounting.subtitle"
      icon="pi pi-calculator">
      <div @pageAnimation class="flex align-items-center justify-content-center p-6">
        <p class="text-color-secondary">Comptabilité — à venir</p>
      </div>
    </app-page-layout>
  `,
  animations: [
    trigger('pageAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class AccountingComponent {}
