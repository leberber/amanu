import {
  Component, OnInit, inject, DestroyRef, signal
} from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConfirmationService } from 'primeng/api';
import { trigger, transition, style, animate } from '@angular/animations';

import { ADMIN_LIST_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { ConfirmationDialogService } from '../../../core/services/confirmation-dialog.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import {
  FacturationService, Facturation, CompanySettings
} from '../../../core/services/facturation.service';
import { FacturationPdfService } from '../../../services/facturation-pdf.service';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';

import { DialogModule } from 'primeng/dialog';

@Component({
  selector: 'app-admin-facturation',
  standalone: true,
  imports: [
    ...ADMIN_LIST_IMPORTS,
    AgroclikPageContainerComponent,
    DialogModule,
  ],
  providers: [ConfirmationService],
  templateUrl: './admin-facturation.component.html',
  styleUrl: './admin-facturation.component.scss',
  animations: [
    trigger('pageAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class AdminFacturationComponent implements OnInit {
  private router = inject(Router);
  private facturationService = inject(FacturationService);
  pdfService = inject(FacturationPdfService);
  private confirmDialog = inject(ConfirmationDialogService);
  private confirmationService = inject(ConfirmationService);
  private toast = inject(ToastMessageService);
  private destroyRef = inject(DestroyRef);

  facturations = signal<Facturation[]>([]);
  total = signal(0);
  loading = signal(false);
  company = signal<CompanySettings | null>(null);

  ngOnInit(): void {
    this.loadFacturations();
    this.loadCompanySettings();
  }

  loadFacturations(): void {
    this.loading.set(true);
    this.facturationService.getFacturations(0, 50)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.facturations.set(res.facturations);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.toast.showError('Erreur lors du chargement des factures');
        }
      });
  }

  private loadCompanySettings(): void {
    this.facturationService.getCompanySettings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (c) => this.company.set(c), error: () => {} });
  }

  createNew(): void {
    this.router.navigate([ROUTES.ADMIN.FACTURATION_NEW]);
  }

  openDetail(facture: Facturation): void {
    this.router.navigate([RouteHelpers.adminFacturationDetail(facture.id)]);
  }

  printFacture(event: Event, facture: Facturation): void {
    event.stopPropagation();
    const company = this.company();
    if (!company) { this.toast.showWarn('Paramètres société non chargés'); return; }
    this.pdfService.generateFacturePdf(facture, company, false);
  }

  downloadFacture(event: Event, facture: Facturation): void {
    event.stopPropagation();
    const company = this.company();
    if (!company) { this.toast.showWarn('Paramètres société non chargés'); return; }
    this.pdfService.generateFacturePdf(facture, company, true);
  }

  confirmDelete(event: Event, facture: Facturation): void {
    event.stopPropagation();
    this.confirmDialog.confirmDelete(
      this.confirmationService,
      `Facture ${facture.reference}`,
      () => this.deleteFacture(facture)
    );
  }

  private deleteFacture(facture: Facturation): void {
    this.facturationService.deleteFacturation(facture.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.facturations.update(list => list.filter(f => f.id !== facture.id));
          this.total.update(t => t - 1);
          this.toast.showSuccess('Facture supprimée');
        },
        error: () => this.toast.showError('Erreur lors de la suppression')
      });
  }

  closePdfPreview(): void { this.pdfService.closePdfPreview(); }
  downloadCurrentPdf(): void { this.pdfService.downloadPdf('facture'); }

  paymentLabel(mode: string): string {
    const opts = [
      { label: 'Espèces', value: 'espece' },
      { label: 'Chèque', value: 'cheque' },
      { label: 'Virement bancaire', value: 'virement' },
    ];
    return opts.find(o => o.value === mode)?.label ?? mode;
  }
  getPaymentSeverity(mode: string): 'success' | 'info' | 'secondary' {
    if (mode === 'espece') return 'success';
    if (mode === 'cheque') return 'info';
    return 'secondary';
  }
}
