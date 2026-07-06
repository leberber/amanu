import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';

import { SidebarService } from '../../services/sidebar.service';
import {
  FacturationService,
  Facturation,
  CompanySettings,
  FacturationClient,
  ClientTotal,
} from '../../core/services/facturation.service';
import { FacturationPdfService } from '../../services/facturation-pdf.service';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { DateFormatPipe } from '../../shared/pipes/date-format.pipe';
import { CurrencyDisplayComponent } from '../../shared/components/currency-display/currency-display.component';

type Period = 'month' | 'year' | 'pick';

@Component({
  selector: 'app-accounting',
  standalone: true,
  imports: [
    FormsModule,
    DecimalPipe,
    SelectModule,
    TooltipModule,
    DialogModule,
    ButtonModule,
    InputNumberModule,
    InputTextModule,
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
  private toast = inject(ToastMessageService);
  private destroyRef = inject(DestroyRef);

  clients = signal<FacturationClient[]>([]);
  clientTotals = signal<ClientTotal[]>([]);
  clientTotalMap = computed(() =>
    new Map(this.clientTotals().map(t => [t.client_id, t]))
  );
  selectedClientId = signal<number | null>(null);
  facturations = signal<Facturation[]>([]);
  companySettings = signal<CompanySettings | null>(null);
  period = signal<Period>('year');
  pickedMonthYear = signal<{ month: number; year: number } | null>(null);
  selectedYear = signal<number>(new Date().getFullYear());
  loading = signal(false);
  loadingPdf = signal<number | null>(null);
  printingList = signal(false);

  // ── Fiscal info dialog ────────────────────────────────────────────────────
  showFiscalDialog = signal(false);
  savingFiscal = signal(false);
  fiscalForm = { rc: '', na: '', nif: '', nis: '', montant_declare: null as number | null };

  get selectedClient(): FacturationClient | null {
    const id = this.selectedClientId();
    return id != null ? (this.clients().find(c => c.id === id) ?? null) : null;
  }

  isFiltered = computed(() => this.selectedClientId() != null);

  factures = computed(() => this.facturations().filter(f => f.document_type === 'facture'));

  availableYears = computed(() => {
    const years = new Set(this.factures().map(f => new Date(f.created_at).getFullYear()));
    return [...years].sort((a, b) => a - b);
  });

  monthsForYear = computed(() => {
    const facts = this.factures();
    const year = this.selectedYear();
    const now = new Date();

    const countByMonth = new Map<number, number>();
    facts.filter(f => new Date(f.created_at).getFullYear() === year)
         .forEach(f => {
           const m = new Date(f.created_at).getMonth();
           countByMonth.set(m, (countByMonth.get(m) ?? 0) + 1);
         });

    const lastMonth = year === now.getFullYear() ? now.getMonth() : 11;
    const result: { month: number; year: number; label: string; hasFactures: boolean; count: number }[] = [];
    for (let month = 0; month <= lastMonth; month++) {
      const count = countByMonth.get(month) ?? 0;
      result.push({
        month,
        year,
        label: new Date(year, month, 1).toLocaleDateString('fr-DZ', { month: 'short' }),
        hasFactures: count > 0,
        count,
      });
    }
    return result;
  });

  facturationsGrouped = computed(() => {
    // Sort ascending so we can accumulate oldest → newest
    const sorted = [...this.filteredFacturations()].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const groups: { label: string; factures: typeof sorted; cumulative: { impose: number; exonere: number; total_tva: number; total_timbre: number; total_ttc: number } }[] = [];
    let cumImpose = 0, cumExonere = 0, cumTva = 0, cumTimbre = 0, cumTtc = 0;

    for (const f of sorted) {
      const d = new Date(f.created_at);
      const label = d.toLocaleDateString('fr-DZ', { month: 'long', year: 'numeric' });
      const last = groups[groups.length - 1];
      if (!last || last.label !== label) {
        groups.push({ label, factures: [f], cumulative: { impose: 0, exonere: 0, total_tva: 0, total_timbre: 0, total_ttc: 0 } });
      } else {
        last.factures.push(f);
      }
    }

    // Compute per-month totals (not cumulative)
    for (const g of groups) {
      let mImpose = 0, mExonere = 0, mTva = 0, mTimbre = 0, mTtc = 0;
      for (const f of g.factures) {
        mImpose  += this.getImpose(f);
        mExonere += this.getExonere(f);
        mTva     += f.total_tva;
        mTimbre  += f.payment_mode === 'espece' ? (f.timbre ?? 0) : 0;
        mTtc     += f.total_ttc;
      }
      g.cumulative = { impose: mImpose, exonere: mExonere, total_tva: mTva, total_timbre: mTimbre, total_ttc: mTtc };
    }

    return groups;
  });

  filteredFacturations = computed(() => {
    const facts = this.factures();
    const picked = this.pickedMonthYear();
    if (picked !== null) {
      return facts.filter(f => {
        const d = new Date(f.created_at);
        return d.getFullYear() === picked.year && d.getMonth() === picked.month;
      });
    }
    const p = this.period();
    const year = this.selectedYear();
    const now = new Date();
    return facts.filter(f => {
      const d = new Date(f.created_at);
      if (p === 'month') return d.getFullYear() === year && d.getMonth() === now.getMonth();
      return d.getFullYear() === year; // 'year' mode
    });
  });

  clientStats = computed(() => {
    const facts = this.filteredFacturations();
    return {
      count:        facts.length,
      impose:       facts.reduce((s, f) => s + this.getImpose(f), 0),
      exonere:      facts.reduce((s, f) => s + this.getExonere(f), 0),
      total_tva:    facts.reduce((s, f) => s + f.total_tva, 0),
      total_timbre: facts.reduce((s, f) => s + (f.payment_mode === 'espece' ? (f.timbre ?? 0) : 0), 0),
      total_ttc:    facts.reduce((s, f) => s + f.total_ttc, 0),
    };
  });

  fiscalProgress = computed(() => {
    const declared = this.selectedClient?.fiscal_info?.montant_declare;
    if (!declared) return null;
    const currentYear = new Date().getFullYear();
    const used = this.factures()
      .filter(f => new Date(f.created_at).getFullYear() === currentYear)
      .reduce((s, f) => s + f.total_ttc, 0);
    const pct = Math.min((used / declared) * 100, 100);
    return { declared, used, remaining: Math.max(declared - used, 0), pct };
  });

  readonly currentYear = new Date().getFullYear();

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
      company: this.facturationService.getCompanySettings(),
      totals: this.facturationService.getClientTotals(),
    }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ clients, company, totals }) => {
          this.clients.set(clients);
          this.companySettings.set(company);
          this.clientTotals.set(totals);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onClientChange(clientId: number | null) {
    this.selectedClientId.set(clientId);
    this.selectedYear.set(new Date().getFullYear());
    this.pickedMonthYear.set(null);
    if (clientId == null) {
      this.facturations.set([]);
      return;
    }
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

  selectYear(year: number) {
    this.selectedYear.set(year);
    this.pickedMonthYear.set(null);
  }

  setPeriod(p: Period) {
    this.pickedMonthYear.set(null);
    this.period.set(p);
  }

  pickMonth(month: number, year: number) {
    this.pickedMonthYear.set({ month, year });
    this.period.set('pick');
  }

  isMonthPicked(month: number, year: number): boolean {
    const p = this.pickedMonthYear();
    return p !== null && p.month === month && p.year === year;
  }

  getImpose(f: Facturation): number {
    return (f.items ?? []).filter(i => i.tva_rate > 0).reduce((s, i) => s + i.total_ht * (1 + i.tva_rate / 100), 0);
  }

  getExonere(f: Facturation): number {
    return (f.items ?? []).filter(i => i.tva_rate === 0).reduce((s, i) => s + i.total_ht, 0);
  }

  async previewPdf(facture: Facturation) {
    const company = this.companySettings();
    if (!company) return;
    this.loadingPdf.set(facture.id);
    try {
      await this.pdfService.generateFacturePdf(facture, company, 'preview');
    } finally {
      this.loadingPdf.set(null);
    }
  }

  openFiscalDialog(): void {
    const client = this.selectedClient;
    if (!client) return;
    this.fiscalForm = {
      rc: client.fiscal_info?.rc ?? '',
      na: client.fiscal_info?.na ?? '',
      nif: client.fiscal_info?.nif ?? '',
      nis: client.fiscal_info?.nis ?? '',
      montant_declare: client.fiscal_info?.montant_declare ?? null,
    };
    this.showFiscalDialog.set(true);
  }

  async printList(): Promise<void> {
    const client = this.selectedClient;
    const company = this.companySettings();
    if (!client || !company) return;
    this.printingList.set(true);
    try {
      await this.pdfService.generateAccountingListPdf(
        client, company, this.selectedYear(),
        this.facturationsGrouped(), this.clientStats()
      );
    } finally {
      this.printingList.set(false);
    }
  }

  saveFiscalInfo(): void {
    const client = this.selectedClient;
    if (!client) return;
    this.savingFiscal.set(true);
    const payload = {
      rc: this.fiscalForm.rc || undefined,
      na: this.fiscalForm.na || undefined,
      nif: this.fiscalForm.nif || undefined,
      nis: this.fiscalForm.nis || undefined,
      montant_declare: this.fiscalForm.montant_declare ?? undefined,
    };
    this.facturationService.updateClientFiscalInfo(client.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.clients.update(list => list.map(c => c.id === updated.id ? { ...c, fiscal_info: updated.fiscal_info } : c));
          this.savingFiscal.set(false);
          this.showFiscalDialog.set(false);
          this.toast.showSuccess('Infos fiscales mises à jour');
        },
        error: () => {
          this.savingFiscal.set(false);
          this.toast.showError('Erreur lors de la mise à jour');
        }
      });
  }
}
