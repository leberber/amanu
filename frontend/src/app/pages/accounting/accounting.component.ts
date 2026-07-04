import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';

import { SidebarService } from '../../services/sidebar.service';
import {
  FacturationService,
  Facturation,
  AccountingStats,
  CompanySettings
} from '../../core/services/facturation.service';
import { FacturationPdfService } from '../../services/facturation-pdf.service';
import { DateFormatPipe } from '../../shared/pipes/date-format.pipe';
import { CurrencyDisplayComponent } from '../../shared/components/currency-display/currency-display.component';

type Period = 'month' | 'year' | 'all';

@Component({
  selector: 'app-accounting',
  standalone: true,
  imports: [
    FormsModule,
    SelectModule,
    TagModule,
    TooltipModule,
    DateFormatPipe,
    CurrencyDisplayComponent,
  ],
  templateUrl: './accounting.component.html',
  styleUrl: './accounting.component.scss',
  animations: [
    trigger('pageAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class AccountingComponent implements OnInit {
  private sidebarService = inject(SidebarService);
  private facturationService = inject(FacturationService);
  private pdfService = inject(FacturationPdfService);
  private destroyRef = inject(DestroyRef);

  clients = signal<{ id: number; display_name: string }[]>([]);
  selectedClientId = signal<number | null>(null);
  facturations = signal<Facturation[]>([]);
  globalStats = signal<AccountingStats | null>(null);
  companySettings = signal<CompanySettings | null>(null);
  period = signal<Period>('month');
  loading = signal(false);
  loadingPdf = signal<number | null>(null);

  filteredFacturations = computed(() => {
    const facts = this.facturations();
    const p = this.period();
    if (p === 'all') return facts;
    const now = new Date();
    return facts.filter(f => {
      const d = new Date(f.created_at);
      if (p === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      return d.getFullYear() === now.getFullYear();
    });
  });

  displayStats = computed(() => {
    const clientId = this.selectedClientId();
    const period = this.period();

    if (clientId != null) {
      const facts = this.filteredFacturations();
      return {
        count: facts.length,
        total_ht: facts.reduce((s, f) => s + f.total_ht, 0),
        total_ttc: facts.reduce((s, f) => s + f.total_ttc, 0),
      };
    }

    const gs = this.globalStats();
    if (!gs) return { count: 0, total_ht: 0, total_ttc: 0 };
    if (period === 'month') return { count: gs.month_count, total_ht: gs.month_ht, total_ttc: gs.month_ttc };
    if (period === 'year') return { count: gs.year_count, total_ht: gs.year_ht, total_ttc: gs.year_ttc };
    return { count: gs.total_count, total_ht: gs.total_ht, total_ttc: gs.total_ttc };
  });

  readonly paymentLabels: Record<string, string> = {
    espece: 'Espèces',
    cheque: 'Chèque',
    virement: 'Virement',
  };

  ngOnInit() {
    this.sidebarService.collapsed.set(true);
    this.loading.set(true);
    forkJoin({
      clients: this.facturationService.getClients(),
      stats: this.facturationService.getAccountingStats(),
      facturations: this.facturationService.getFacturations(0, 200),
      company: this.facturationService.getCompanySettings(),
    }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ clients, stats, facturations, company }) => {
          this.clients.set(clients);
          this.globalStats.set(stats);
          this.facturations.set(facturations.facturations);
          this.companySettings.set(company);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onClientChange(clientId: number | null) {
    this.selectedClientId.set(clientId);
    if (clientId == null) {
      this.loading.set(true);
      forkJoin({
        stats: this.facturationService.getAccountingStats(),
        facturations: this.facturationService.getFacturations(0, 200),
      }).pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: ({ stats, facturations }) => {
            this.globalStats.set(stats);
            this.facturations.set(facturations.facturations);
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
    } else {
      this.loading.set(true);
      this.facturationService.getFacturations(0, 500, clientId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            this.facturations.set(res.facturations);
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
    }
  }

  setPeriod(p: Period) {
    this.period.set(p);
  }

  async downloadPdf(facture: Facturation) {
    const company = this.companySettings();
    if (!company) return;
    this.loadingPdf.set(facture.id);
    try {
      await this.pdfService.generateFacturePdf(facture, company, true);
    } finally {
      this.loadingPdf.set(null);
    }
  }

  docTypeLabel(type: string): string {
    return type === 'bon_de_livraison' ? 'BL' : 'Facture';
  }

  docTypeSeverity(type: string): 'info' | 'success' {
    return type === 'bon_de_livraison' ? 'info' : 'success';
  }
}
