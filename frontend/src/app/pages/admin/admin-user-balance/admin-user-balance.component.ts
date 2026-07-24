import { Component, inject, signal, computed, DestroyRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { trigger, transition, style, animate } from '@angular/animations';

import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { CurrencyDisplayComponent } from '../../../shared/components/currency-display/currency-display.component';
import { DateFormatPipe } from '../../../shared/pipes/date-format.pipe';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { environment } from '../../../../environments/environment';

export interface FinancialEvent {
  event_type: 'order' | 'payment' | 'return';
  date: string;
  order_id: number;
  description: string;
  debit: number;
  credit: number;
  method?: string;
  note?: string;
}

export interface UserFinancialHistory {
  user_id: number;
  user_name: string;
  user_email: string;
  user_phone?: string;
  current_balance: number;
  total_ordered: number;
  total_paid: number;
  total_returned: number;
  events: FinancialEvent[];
}

@Component({
  selector: 'app-admin-user-balance',
  standalone: true,
  imports: [
    ButtonModule,
    TagModule,
    TooltipModule,
    AgroclikPageContainerComponent,
    CurrencyDisplayComponent,
    DateFormatPipe,
  ],
  templateUrl: './admin-user-balance.component.html',
  styleUrl: './admin-user-balance.component.scss',
  animations: [
    trigger('pageAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class AdminUserBalanceComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);

  readonly ROUTES = ROUTES;

  loading = signal(true);
  history = signal<UserFinancialHistory | null>(null);

  /** Events displayed newest-first with a running balance column */
  ledger = computed(() => {
    const h = this.history();
    if (!h) return [];

    let running = 0;
    const rows = h.events.map(e => {
      running += e.debit - e.credit;
      return { ...e, running_balance: Math.round(running * 100) / 100 };
    });
    return rows.reverse(); // newest first for the table
  });

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.http
      .get<UserFinancialHistory>(`${environment.apiUrl}/admin/users/${id}/financial-history`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => { this.history.set(data); this.loading.set(false); },
        error: () => { this.loading.set(false); },
      });
  }

  goToOrder(orderId: number): void {
    this.router.navigate([RouteHelpers.adminOrderDetail(orderId)]);
  }

  goBack(): void {
    this.router.navigate([ROUTES.ADMIN.USERS]);
  }

  methodLabel(method?: string): string {
    const map: Record<string, string> = { cash: 'Espèces', virement: 'Virement', cheque: 'Chèque' };
    return method ? (map[method] ?? method) : '';
  }

  eventSeverity(type: string): 'success' | 'danger' | 'info' | 'secondary' {
    if (type === 'payment') return 'success';
    if (type === 'return') return 'info';
    return 'secondary';
  }

  eventLabel(type: string): string {
    if (type === 'payment') return 'Paiement';
    if (type === 'return') return 'Retour';
    return 'Commande';
  }
}
