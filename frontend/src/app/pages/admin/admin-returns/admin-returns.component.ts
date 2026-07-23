import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { trigger, transition, style, animate } from '@angular/animations';

import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { CurrencyDisplayComponent } from '../../../shared/components/currency-display/currency-display.component';
import { DateFormatPipe } from '../../../shared/pipes/date-format.pipe';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { ReturnsService, OrderReturn } from '../../../core/services/returns.service';
import { RouteHelpers, ROUTES } from '../../../core/constants/routes.constants';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-returns',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TagModule,
    TooltipModule,
    AgroclikPageContainerComponent,
    CurrencyDisplayComponent,
    DateFormatPipe,
  ],
  templateUrl: './admin-returns.component.html',
  styleUrl: './admin-returns.component.scss',
  animations: [
    trigger('pageAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class AdminReturnsComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private toast = inject(ToastMessageService);
  private returnsService = inject(ReturnsService);
  private router = inject(Router);

  readonly ROUTES = ROUTES;

  loading = signal(true);
  returns = signal<OrderReturn[]>([]);

  totalRefunded = computed(() =>
    this.returns().reduce((sum, r) => sum + r.refund_amount, 0)
  );

  ngOnInit(): void {
    this.loadReturns();
  }

  loadReturns(): void {
    this.loading.set(true);
    this.returnsService.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => { this.returns.set(data); this.loading.set(false); },
      error: () => { this.toast.showError('Erreur lors du chargement des retours'); this.loading.set(false); }
    });
  }

  openCreatePage(): void {
    this.router.navigate([ROUTES.ADMIN.RETURNS_NEW]);
  }

  goToOrder(orderId: number): void {
    this.router.navigate([RouteHelpers.adminOrderDetail(orderId)]);
  }

}
