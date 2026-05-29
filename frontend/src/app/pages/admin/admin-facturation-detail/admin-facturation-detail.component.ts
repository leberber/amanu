import {
  Component, OnInit, inject, DestroyRef, signal
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConfirmationService } from 'primeng/api';
import { trigger, transition, style, animate } from '@angular/animations';

import { ADMIN_LIST_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { ConfirmationDialogService } from '../../../core/services/confirmation-dialog.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import {
  FacturationService, Facturation, FacturationCreate, FacturationItemCreate,
  CompanySettings, FacturationClient, FacturationCatalogItem
} from '../../../core/services/facturation.service';
import { FacturationPdfService } from '../../../services/facturation-pdf.service';
import { BrandService } from '../../../core/services/brand.service';
import { Brand } from '../../../models/brand.model';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';

import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';

interface InvoiceItem {
  product_id?: number;
  product_name: string;
  unit: string;
  pieces_per_box: number;
  quantity: number;
  facture_unit_price: number;  // prix facturé/pcs from purchase order (read-only)
  prix_vente_pcs: number;       // selling price per piece (editable, drives unit_price)
  unit_price: number;           // per-carton TTC = prix_vente_pcs × pieces_per_box × (1 + tva/100)
  tva_rate: number;
  image_url?: string;
}

interface FiscalInfo {
  rc: string;
  na: string;
  nif: string;
  nis: string;
}

@Component({
  selector: 'app-admin-facturation-detail',
  standalone: true,
  imports: [
    ...ADMIN_LIST_IMPORTS,
    PageLayoutComponent,
    DialogModule,
    InputNumberModule,
    SelectModule,
  ],
  providers: [ConfirmationService],
  templateUrl: './admin-facturation-detail.component.html',
  styleUrl: './admin-facturation-detail.component.scss',
  animations: [
    trigger('pageAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class AdminFacturationDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private facturationService = inject(FacturationService);
  pdfService = inject(FacturationPdfService);
  private brandService = inject(BrandService);
  private confirmDialog = inject(ConfirmationDialogService);
  private confirmationService = inject(ConfirmationService);
  private toast = inject(ToastMessageService);
  private destroyRef = inject(DestroyRef);

  // ── Mode ────────────────────────────────────────────────────────────────────
  isCreateMode = true;

  // ── State ───────────────────────────────────────────────────────────────────
  loading = signal(false);
  saving = signal(false);
  company = signal<CompanySettings | null>(null);
  facture = signal<Facturation | null>(null);

  // ── Client selection ─────────────────────────────────────────────────────────
  allClients: FacturationClient[] = [];
  selectedClient: FacturationClient | null = null;

  // Editable fiscal info (populated from selectedClient.fiscal_info, editable inline)
  fiscal: FiscalInfo = { rc: '', na: '', nif: '', nis: '' };

  // ── Catalog ─────────────────────────────────────────────────────────────────
  private allProducts: FacturationCatalogItem[] = [];
  brands: { label: string; value: number | null }[] = [];
  filterBrand: number | null = null;
  catalogExpanded = signal(true);
  notesExpanded = signal(false);

  get catalogProducts(): FacturationCatalogItem[] {
    if (this.filterBrand === null) return this.allProducts;
    return this.allProducts.filter(p => p.brand_id === this.filterBrand);
  }

  // ── Margin input state ────────────────────────────────────────────────────────
  activeMarginIndex = signal<number | null>(null);
  pendingMargin = 0;

  openMarginInput(index: number): void {
    this.pendingMargin = 0;
    this.activeMarginIndex.set(index);
  }

  applyMargin(item: InvoiceItem): void {
    if (this.pendingMargin !== 0) {
      item.prix_vente_pcs = item.prix_vente_pcs * (1 + this.pendingMargin / 100);
      this.recalculate(item);
    }
    this.activeMarginIndex.set(null);
  }

  // ── Invoice form ─────────────────────────────────────────────────────────────
  paymentMode = 'espece';
  remise = 0;
  timbre = 0;
  notes = '';
  items: InvoiceItem[] = [];

  // ── Totals ──────────────────────────────────────────────────────────────────
  get totalHt(): number {
    return this.items.reduce((sum, item) => sum + this.pCtnHt(item) * item.quantity, 0);
  }
  get totalTva(): number {
    return this.items.reduce((sum, item) => sum + (this.pCtnTtc(item) - this.pCtnHt(item)) * item.quantity, 0);
  }
  get totalTtc(): number {
    return this.totalHt + this.totalTva - this.remise + this.timbre;
  }

  paymentModeOptions = [
    { label: 'Espèces', value: 'espece' },
    { label: 'Chèque', value: 'cheque' },
    { label: 'Virement bancaire', value: 'virement' },
  ];
  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    if (id) {
      this.isCreateMode = false;
      this.loadFacture(+id);
    } else {
      this.isCreateMode = true;
      this.loadClients();
      this.loadCatalog();
    }
    this.loadCompanySettings();
  }

  private loadCompanySettings(): void {
    this.facturationService.getCompanySettings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (c) => this.company.set(c), error: () => {} });
  }

  private loadFacture(id: number): void {
    this.loading.set(true);
    this.facturationService.getFacturation(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (f) => { this.facture.set(f); this.loading.set(false); },
        error: () => {
          this.loading.set(false);
          this.toast.showError('Facture introuvable');
          this.router.navigate([ROUTES.ADMIN.FACTURATION]);
        }
      });
  }

  private loadClients(): void {
    this.facturationService.getClients()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (clients) => { this.allClients = clients; }, error: () => {} });
  }

  private loadCatalog(): void {
    this.facturationService.getCatalogProducts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (p) => { this.allProducts = p; }, error: () => {} });

    this.brandService.getBrands(true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (brands: Brand[]) => {
          this.brands = [
            { label: 'Toutes marques', value: null },
            ...brands.map(b => ({ label: b.name, value: b.id }))
          ];
        },
        error: () => {}
      });
  }

  onClientSelect(client: FacturationClient): void {
    this.selectedClient = client;
    // Pre-fill fiscal info from user's saved profile
    this.fiscal = {
      rc: client.fiscal_info?.rc ?? '',
      na: client.fiscal_info?.na ?? '',
      nif: client.fiscal_info?.nif ?? '',
      nis: client.fiscal_info?.nis ?? '',
    };
  }

  clearClient(): void {
    this.selectedClient = null;
    this.fiscal = { rc: '', na: '', nif: '', nis: '' };
  }

  // ── Catalog actions ──────────────────────────────────────────────────────────
  addProduct(product: FacturationCatalogItem): void {
    const existing = this.items.find(i => i.product_id === product.id);
    if (existing) {
      existing.quantity++;
    } else {
      const piecesPerBox = product.pieces_per_box ?? 1;
      const facture_unit_price = product.facture_unit_price ?? 0;
      const tva = product.tva_rate ?? 0;
      this.items.push({
        product_id: product.id,
        product_name: product.name,
        unit: this.mapPackagingType(product.packaging_type),
        pieces_per_box: piecesPerBox,
        quantity: 1,
        facture_unit_price,
        prix_vente_pcs: facture_unit_price,
        unit_price: facture_unit_price * piecesPerBox * (1 + tva / 100),
        tva_rate: tva,
        image_url: product.image_url,
      });
    }
  }

  removeItem(index: number): void {
    this.items.splice(index, 1);
  }

  isAdded(product: FacturationCatalogItem): boolean {
    return this.items.some(i => i.product_id === product.id);
  }

  itemQty(productId: number): number {
    return this.items.find(i => i.product_id === productId)?.quantity ?? 0;
  }

  private mapPackagingType(packagingType?: string): string {
    const map: Record<string, string> = {
      carton: 'Carton',
      box: 'Boîte',
      crate: 'Caisse',
      pack: 'Pack',
      bag: 'Sac',
      bundle: 'Fardeau',
      bottle: 'Bouteille',
      palette: 'Palette',
    };
    return packagingType ? (map[packagingType] ?? 'Carton') : 'Carton';
  }

  pCtnHt(item: InvoiceItem): number {
    return item.prix_vente_pcs * item.pieces_per_box;
  }

  pCtnTtc(item: InvoiceItem): number {
    return this.pCtnHt(item) * (1 + item.tva_rate / 100);
  }

  recalculate(item: InvoiceItem): void {
    item.unit_price = this.pCtnTtc(item);
  }

  syncToAchat(item: InvoiceItem): void {
    item.prix_vente_pcs = item.facture_unit_price / (1 + item.tva_rate / 100);
    this.recalculate(item);
  }

  // ── Save ─────────────────────────────────────────────────────────────────────
  save(): void {
    if (!this.selectedClient) {
      this.toast.showWarn('Sélectionnez un client');
      return;
    }
    if (this.items.length === 0) {
      this.toast.showWarn('Ajoutez au moins un article');
      return;
    }

    const fiscalPayload = {
      rc: this.fiscal.rc || undefined,
      na: this.fiscal.na || undefined,
      nif: this.fiscal.nif || undefined,
      nis: this.fiscal.nis || undefined,
    };

    const payload: FacturationCreate = {
      client_id: this.selectedClient.id,
      fiscal_info: fiscalPayload,
      payment_mode: this.paymentMode,
      remise: this.remise,
      timbre: this.timbre,
      notes: this.notes || undefined,
      items: this.items.map(item => ({
        product_id: item.product_id,
        reference: item.product_id?.toString() ?? '',
        product_name: item.product_name,
        unit: item.unit,
        pieces_per_box: item.pieces_per_box,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tva_rate: item.tva_rate,
      } as FacturationItemCreate))
    };

    this.saving.set(true);
    this.facturationService.createFacturation(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          this.saving.set(false);
          this.toast.showSuccess(`Facture ${created.reference} créée`);
          const company = this.company();
          if (company) this.pdfService.generateFacturePdf(created, company, false);
          this.router.navigate([RouteHelpers.adminFacturationDetail(created.id)]);
        },
        error: () => {
          this.saving.set(false);
          this.toast.showError('Erreur lors de la création de la facture');
        }
      });
  }

  // ── View mode actions ─────────────────────────────────────────────────────────
  print(): void {
    const f = this.facture(); const company = this.company();
    if (!f || !company) return;
    this.pdfService.generateFacturePdf(f, company, false);
  }

  download(): void {
    const f = this.facture(); const company = this.company();
    if (!f || !company) return;
    this.pdfService.generateFacturePdf(f, company, true);
  }

  confirmDelete(): void {
    const f = this.facture();
    if (!f) return;
    this.confirmDialog.confirmDelete(
      this.confirmationService,
      `Facture ${f.reference}`,
      () => this.deleteFacture(f)
    );
  }

  private deleteFacture(f: Facturation): void {
    this.facturationService.deleteFacturation(f.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.showSuccess('Facture supprimée');
          this.router.navigate([ROUTES.ADMIN.FACTURATION]);
        },
        error: () => this.toast.showError('Erreur lors de la suppression')
      });
  }

  closePdfPreview(): void { this.pdfService.closePdfPreview(); }
  downloadCurrentPdf(): void { this.pdfService.downloadPdf('facture'); }

  paymentLabel(mode: string): string {
    return this.paymentModeOptions.find(o => o.value === mode)?.label ?? mode;
  }
  getPaymentSeverity(mode: string): 'success' | 'info' | 'secondary' {
    if (mode === 'espece') return 'success';
    if (mode === 'cheque') return 'info';
    return 'secondary';
  }
}
