import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { SelectModule } from 'primeng/select';
import { SliderModule } from 'primeng/slider';
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
  ExternalFactureCreate,
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
    SliderModule,
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
  printingPdf = signal<'all' | 'agro' | null>(null);

  // ── External facture inline editing ───────────────────────────────────────
  activeInlineGroup = signal<string | null>(null);
  inlineRowData = { merchantName: '', paymentMode: 'espece', extImpose: 0, extExonere: 0, totalTva: 0, timbre: 0 };
  savingInline = signal(false);
  deletingExternal = signal<number | null>(null);

  // ── Fiscal info dialog ────────────────────────────────────────────────────
  showFiscalDialog = signal(false);
  savingFiscal = signal(false);
  fiscalForm = { rc: '', na: '', nif: '', nis: '', montant_declare: null as number | null, marge_subv: 8 as number };

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
    const groups: { label: string; month: number; year: number; factures: typeof sorted; cumulative: { impose: number; exonere: number; total_tva: number; total_timbre: number; total_ttc: number } }[] = [];

    for (const f of sorted) {
      const d = new Date(f.created_at);
      const label = d.toLocaleDateString('fr-DZ', { month: 'long', year: 'numeric' });
      const last = groups[groups.length - 1];
      if (!last || last.label !== label) {
        groups.push({ label, month: d.getMonth(), year: d.getFullYear(), factures: [f], cumulative: { impose: 0, exonere: 0, total_tva: 0, total_timbre: 0, total_ttc: 0 } });
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

  margeSubv = signal<number>(8);
  margeSliderPct = computed(() => ((this.margeSubv() - 1) / 49 * 100).toFixed(1) + '%');

  // Extra planned purchases on top of what's already in factures
  subvAdditional = signal<number>(0);
  imposableAdditional = signal<number>(0);

  planningStats = computed(() => {
    const marge = this.margeSubv() / 100;
    const { remaining, caSubv, caImposable } = this.forfaitStats();
    const subvAdd = this.subvAdditional();
    const imposableAdd = this.imposableAdditional();

    const taxFromSubvAdd      = marge > 0 ? subvAdd      * 0.05 * marge / (1 + marge) : 0;
    const taxFromImposableAdd = imposableAdd * 0.05;

    // Max additional each can absorb given the other's current allocation
    const maxSubvAdd      = marge > 0 ? Math.max(remaining - taxFromImposableAdd, 0) * (1 + marge) / (0.05 * marge) : 0;
    const maxImposableAdd = Math.max(remaining - taxFromSubvAdd, 0) / 0.05;

    // Absolute max (current + additional capacity) — used as slider [max]
    const subvMax      = caSubv + maxSubvAdd;
    const imposableMax = caImposable + maxImposableAdd;

    return {
      caSubv, caImposable, subvAdd, imposableAdd,
      taxFromSubvAdd, taxFromImposableAdd,
      maxSubvAdd, maxImposableAdd, subvMax, imposableMax,
    };
  });

  // Gradient is relative to the ACTIVE (additional) portion only
  subvPlanGradient = computed(() => {
    const { subvAdd, maxSubvAdd } = this.planningStats();
    if (maxSubvAdd === 0) return '#d97706';
    const pct = (subvAdd / maxSubvAdd) * 100;
    return `linear-gradient(to right, #d97706 ${pct}%, rgba(0,0,0,0.08) ${pct}%)`;
  });

  imposablePlanGradient = computed(() => {
    const { imposableAdd, maxImposableAdd } = this.planningStats();
    if (maxImposableAdd === 0) return '#0891b2';
    const pct = (imposableAdd / maxImposableAdd) * 100;
    return `linear-gradient(to right, #0891b2 ${pct}%, rgba(0,0,0,0.08) ${pct}%)`;
  });

  // Combined view: base factures + whatever is planned on the sliders
  liveStats = computed(() => {
    const base = this.forfaitStats();
    const plan = this.planningStats();
    const taxSubv      = base.taxSubv      + plan.taxFromSubvAdd;
    const taxImposable = base.taxImposable + plan.taxFromImposableAdd;
    const totalTax     = taxSubv + taxImposable;
    const forfait      = 30_000;
    const remaining    = Math.max(forfait - totalTax, 0);
    const pct          = Math.min((totalTax / forfait) * 100, 100);
    return { ...base, taxSubv, taxImposable, totalTax, remaining, pct };
  });

  onSubvPlannedChange(add: number): void {
    // add = additional amount only (0 to maxSubvAdd) — slider min=0 handles the floor
    this.subvAdditional.set(add);
    const marge = this.margeSubv() / 100;
    const { remaining } = this.forfaitStats();
    const taxFromSubvAdd = marge > 0 ? add * 0.05 * marge / (1 + marge) : 0;
    const maxImposableAdd = Math.max(remaining - taxFromSubvAdd, 0) / 0.05;
    if (this.imposableAdditional() > maxImposableAdd) this.imposableAdditional.set(Math.round(maxImposableAdd));
  }

  onImposablePlannedChange(add: number): void {
    this.imposableAdditional.set(add);
    const marge = this.margeSubv() / 100;
    const { remaining } = this.forfaitStats();
    const taxFromImposableAdd = add * 0.05;
    const maxSubvAdd = marge > 0 ? Math.max(remaining - taxFromImposableAdd, 0) * (1 + marge) / (0.05 * marge) : 0;
    if (this.subvAdditional() > maxSubvAdd) this.subvAdditional.set(Math.round(maxSubvAdd));
  }

  forfaitStats = computed(() => {
    const facts = this.filteredFacturations();
    const marge = this.margeSubv() / 100;

    const caSubv = facts.reduce((s, f) =>
      s + (f.is_external
        ? (f.ext_exonere ?? 0)
        : (f.items ?? []).filter(i => i.tva_rate === 0).reduce((ss, i) => ss + i.total_ttc, 0)), 0);
    const profitSubv = marge > 0 ? caSubv * marge / (1 + marge) : 0;
    const taxSubv = profitSubv * 0.05;

    const caImposable = facts.reduce((s, f) =>
      s + (f.is_external
        ? (f.ext_impose ?? 0)
        : (f.items ?? []).filter(i => i.tva_rate > 0).reduce((ss, i) => ss + i.total_ttc, 0)), 0);
    const taxImposable = caImposable * 0.05;

    const forfait = 30_000;
    const totalTax = taxSubv + taxImposable;
    const remaining = Math.max(forfait - totalTax, 0);
    const pct = Math.min((totalTax / forfait) * 100, 100);

    return { caSubv, profitSubv, taxSubv, caImposable, taxImposable, totalTax, forfait, remaining, pct };
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
    const client = clientId != null ? this.clients().find(c => c.id === clientId) ?? null : null;
    this.margeSubv.set(client?.fiscal_info?.marge_subv ?? 8);
    this.subvAdditional.set(0);
    this.imposableAdditional.set(0);
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
    if (f.is_external) return f.ext_impose ?? 0;
    return (f.items ?? []).filter(i => i.tva_rate > 0).reduce((s, i) => s + i.total_ht * (1 + i.tva_rate / 100), 0);
  }

  getExonere(f: Facturation): number {
    if (f.is_external) return f.ext_exonere ?? 0;
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
      marge_subv: client.fiscal_info?.marge_subv ?? 8,
    };
    this.showFiscalDialog.set(true);
  }

  async printList(mode: 'all' | 'agro'): Promise<void> {
    const client = this.selectedClient;
    const company = this.companySettings();
    if (!client || !company) return;
    this.printingPdf.set(mode);
    try {
      let groups = this.facturationsGrouped();
      let stats = this.clientStats();

      if (mode === 'agro') {
        groups = groups
          .map(g => ({ ...g, factures: g.factures.filter(f => !f.is_external) }))
          .filter(g => g.factures.length > 0);
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
        const facts = groups.flatMap(g => g.factures);
        stats = {
          count: facts.length,
          impose: facts.reduce((s, f) => s + this.getImpose(f), 0),
          exonere: facts.reduce((s, f) => s + this.getExonere(f), 0),
          total_tva: facts.reduce((s, f) => s + f.total_tva, 0),
          total_timbre: facts.reduce((s, f) => s + (f.payment_mode === 'espece' ? (f.timbre ?? 0) : 0), 0),
          total_ttc: facts.reduce((s, f) => s + f.total_ttc, 0),
        };
      }

      await this.pdfService.generateAccountingListPdf(
        client, company, this.selectedYear(), groups, stats, mode === 'agro'
      );
    } finally {
      this.printingPdf.set(null);
    }
  }

  addExternalRow(group: { label: string; month: number; year: number }): void {
    this.inlineRowData = { merchantName: '', paymentMode: 'espece', extImpose: 0, extExonere: 0, totalTva: 0, timbre: 0 };
    this.activeInlineGroup.set(group.label);
  }

  cancelInlineRow(): void {
    this.activeInlineGroup.set(null);
  }

  saveInlineRow(group: { label: string; month: number; year: number }): void {
    const clientId = this.selectedClientId();
    if (!clientId || !this.inlineRowData.merchantName) return;
    this.savingInline.set(true);
    const d = this.inlineRowData;
    const payload: ExternalFactureCreate = {
      client_id: clientId,
      merchant_name: d.merchantName,
      payment_mode: d.paymentMode,
      ext_impose: d.extImpose,
      ext_exonere: d.extExonere,
      total_tva: d.totalTva,
      timbre: d.timbre,
      month: group.month,
      year: group.year,
    };
    this.facturationService.createExternalFacturation(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (f) => {
          this.facturations.update(list => [f, ...list]);
          this.activeInlineGroup.set(null);
          this.savingInline.set(false);
          this.toast.showSuccess('Facture externe ajoutée');
        },
        error: () => {
          this.savingInline.set(false);
          this.toast.showError('Erreur lors de l\'ajout');
        }
      });
  }

  deleteExternal(f: Facturation): void {
    this.deletingExternal.set(f.id);
    this.facturationService.deleteFacturation(f.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.facturations.update(list => list.filter(x => x.id !== f.id));
          this.deletingExternal.set(null);
        },
        error: () => {
          this.deletingExternal.set(null);
          this.toast.showError('Erreur lors de la suppression');
        }
      });
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
      marge_subv: this.fiscalForm.marge_subv,
    };
    this.facturationService.updateClientFiscalInfo(client.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.clients.update(list => list.map(c => c.id === updated.id ? { ...c, fiscal_info: updated.fiscal_info } : c));
          this.margeSubv.set(updated.fiscal_info?.marge_subv ?? 8);
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
