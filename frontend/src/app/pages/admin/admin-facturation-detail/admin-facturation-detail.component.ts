import {
  Component, OnInit, inject, DestroyRef, signal
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { take } from 'rxjs';
import { ConfirmationService } from 'primeng/api';
import { trigger, transition, style, animate } from '@angular/animations';

import { ADMIN_LIST_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { ConfirmationDialogService } from '../../../core/services/confirmation-dialog.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import {
  FacturationService, Facturation, FacturationCreate, FacturationItemCreate,
  CompanySettings, FacturationClient, FacturationCatalogItem, FacturationDraft,
  TimbreTier,
} from '../../../core/services/facturation.service';
import { FacturationPdfService } from '../../../services/facturation-pdf.service';
import { BrandService } from '../../../core/services/brand.service';
import { Brand } from '../../../models/brand.model';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { CleanAddressPipe } from '../../../shared/pipes/clean-address.pipe';

import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { PopoverModule } from 'primeng/popover';
import { DialogModule } from 'primeng/dialog';

interface InvoiceItem {
  product_id?: number;
  product_name: string;
  brand_name?: string;
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
  montant_declare?: number;
}

@Component({
  selector: 'app-admin-facturation-detail',
  standalone: true,
  imports: [
    ...ADMIN_LIST_IMPORTS,
    PageLayoutComponent,
    InputNumberModule,
    SelectModule,
    PopoverModule,
    RouterLink,
    CleanAddressPipe,
    DialogModule,
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
  private pdfService = inject(FacturationPdfService);
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
  converting = signal(false);
  company = signal<CompanySettings | null>(null);
  facture = signal<Facturation | null>(null);

  // ── Client selection ─────────────────────────────────────────────────────────
  allClients: FacturationClient[] = [];
  selectedClient: FacturationClient | null = null;

  // Editable fiscal info (populated from selectedClient.fiscal_info, editable inline)
  fiscal: FiscalInfo = { rc: '', na: '', nif: '', nis: '', montant_declare: undefined };

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

  // ── Invoice form ─────────────────────────────────────────────────────────────
  documentType: 'facture' | 'bon_de_livraison' = 'facture';
  paymentMode = 'espece';
  marge = 0;
  remise = 0;
  notes = '';

  private static readonly DEFAULT_TIMBRE_TIERS: TimbreTier[] = [
    { max: 30000,  rate: 1   },
    { max: 100000, rate: 1.5 },
    { max: null,   rate: 2   },
  ];
  sourceBdlReference: string | null = null;
  showSaveConfirm = signal(false);
  items: InvoiceItem[] = [];

  readonly margeOptions = [0, 3, 5, 10, 15].map(v => ({
    label: v === 0 ? 'Aucune' : `${v}%`,
    value: v,
  }));

  // ── Totals ──────────────────────────────────────────────────────────────────
  get totalHt(): number {
    return this.items.reduce((sum, item) => sum + this.pCtnHt(item) * item.quantity, 0);
  }
  get totalTva(): number {
    return this.items.reduce((sum, item) => sum + (this.pCtnTtc(item) - this.pCtnHt(item)) * item.quantity, 0);
  }
  get timbre(): number {
    if (this.paymentMode !== 'espece') return 0;
    const base = this.totalHt + this.totalTva - this.remise;
    return this.computeTimbre(base);
  }

  private computeTimbre(base: number): number {
    if (base <= 0) return 0;
    const tiers = this.company()?.timbre_tiers?.length
      ? this.company()!.timbre_tiers!
      : AdminFacturationDetailComponent.DEFAULT_TIMBRE_TIERS;
    for (const tier of tiers) {
      if (tier.max === null || base <= tier.max) {
        return base * tier.rate / 100;
      }
    }
    return 0;
  }

  get totalTtc(): number {
    return this.totalHt + this.totalTva - this.remise + this.timbre;
  }
  get montantImpose(): number {
    return this.items.filter(i => i.tva_rate > 0)
      .reduce((sum, i) => sum + this.pCtnHt(i) * i.quantity, 0);
  }
  get montantExo(): number {
    return this.items.filter(i => i.tva_rate === 0)
      .reduce((sum, i) => sum + this.pCtnHt(i) * i.quantity, 0);
  }

  factureImpose(): number {
    return this.facture()?.items.filter(i => i.tva_rate > 0)
      .reduce((sum, i) => sum + i.total_ht, 0) ?? 0;
  }
  factureExo(): number {
    return this.facture()?.items.filter(i => i.tva_rate === 0)
      .reduce((sum, i) => sum + i.total_ht, 0) ?? 0;
  }

  readonly tvaRates = [0, 9, 19];

  paymentModeOptions = [
    { label: 'Espèces',  short: 'Espèces',  icon: 'pi pi-wallet', value: 'espece'   },
    { label: 'Chèque',   short: 'Chèque',   icon: 'pi pi-file',   value: 'cheque'   },
    { label: 'Virement bancaire', short: 'Virement', icon: 'pi pi-send', value: 'virement' },
  ];
  private static readonly DRAFT_KEY = 'facturation_new_draft';

  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    if (id) {
      this.isCreateMode = false;
      this.loadFacture(+id);
    } else {
      this.isCreateMode = true;
      this.loadClients();
      this.loadCatalog();
      const fromOrder = this.route.snapshot.queryParams['from_order'];
      const fromBdl = this.route.snapshot.queryParams['from_bdl'];
      if (fromOrder) {
        this.documentType = 'bon_de_livraison';
        this.loadFromOrder(+fromOrder);
      } else if (fromBdl) {
        this.loadFromBdl(+fromBdl);
      } else {
        this.restoreDraft();
      }

      // Auto-save draft to localStorage every 1.5s while in create mode
      const intervalId = setInterval(() => this.saveDraft(), 1500);
      this.destroyRef.onDestroy(() => clearInterval(intervalId));
    }
    this.loadCompanySettings();
  }

  private saveDraft(): void {
    try {
      localStorage.setItem(AdminFacturationDetailComponent.DRAFT_KEY, JSON.stringify({
        selectedClient: this.selectedClient,
        fiscal: this.fiscal,
        documentType: this.documentType,
        paymentMode: this.paymentMode,
        marge: this.marge,
        remise: this.remise,
        notes: this.notes,
        items: this.items,
        sourceBdlReference: this.sourceBdlReference,
      }));
    } catch { /* storage quota exceeded */ }
  }

  private restoreDraft(): void {
    try {
      const raw = localStorage.getItem(AdminFacturationDetailComponent.DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      this.selectedClient = draft.selectedClient ?? null;
      this.fiscal = draft.fiscal ?? { rc: '', na: '', nif: '', nis: '', montant_declare: undefined };
      this.documentType = draft.documentType ?? 'facture';
      this.paymentMode = draft.paymentMode ?? 'espece';
      this.marge = draft.marge ?? 0;
      this.remise = draft.remise ?? 0;
      this.notes = draft.notes ?? '';
      this.items = draft.items ?? [];
      this.sourceBdlReference = draft.sourceBdlReference ?? null;
      if (this.items.length > 0 || this.selectedClient) {
        this.toast.showInfo('Brouillon restauré');
      }
    } catch { /* corrupted data */ }
  }

  private clearDraft(): void {
    localStorage.removeItem(AdminFacturationDetailComponent.DRAFT_KEY);
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

  private loadFromOrder(orderId: number): void {
    this.loading.set(true);
    this.facturationService.getFacturationDraftFromOrder(orderId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (draft: FacturationDraft) => {
          this.selectedClient = draft.client;
          this.fiscal = this.fiscalFromClient(draft.client);
          this.items = draft.items.map(draftItem => {
            const item: InvoiceItem = {
              product_id: draftItem.product_id,
              product_name: draftItem.product_name,
              brand_name: draftItem.brand_name,
              unit: draftItem.unit,
              pieces_per_box: draftItem.pieces_per_box,
              quantity: draftItem.quantity,
              facture_unit_price: draftItem.original_unit_price,
              prix_vente_pcs: draftItem.prix_vente_pcs,
              unit_price: 0,
              tva_rate: draftItem.tva_rate,
              image_url: draftItem.image_url,
            };
            item.unit_price = this.pCtnTtc(item);
            return item;
          });
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.toast.showError('Erreur lors du chargement de la commande');
        }
      });
  }

  onClientSelect(client: FacturationClient): void {
    this.selectedClient = client;
    this.fiscal = this.fiscalFromClient(client);
  }

  private fiscalFromClient(client: FacturationClient): FiscalInfo {
    return {
      rc: client.fiscal_info?.rc ?? '',
      na: client.fiscal_info?.na ?? '',
      nif: client.fiscal_info?.nif ?? '',
      nis: client.fiscal_info?.nis ?? '',
      montant_declare: client.fiscal_info?.montant_declare,
    };
  }

  clearClient(): void {
    this.selectedClient = null;
    this.fiscal = { rc: '', na: '', nif: '', nis: '', montant_declare: undefined };
  }

  // ── Marge ────────────────────────────────────────────────────────────────────
  onMargeChange(): void {
    this.items.forEach(item => {
      item.prix_vente_pcs = item.facture_unit_price * (1 + this.marge / 100);
      this.recalculate(item);
    });
  }

  // ── Catalog actions ──────────────────────────────────────────────────────────
  addProduct(product: FacturationCatalogItem): void {
    const existing = this.items.find(i => i.product_id === product.id);
    if (existing) {
      existing.quantity++;
      return;
    }
    const basePrice = product.facture_unit_price ?? 0;
    const tvaRate = product.tva_rate ?? 0;
    const htCost = tvaRate ? basePrice / (1 + tvaRate / 100) : basePrice;
    const item: InvoiceItem = {
      product_id: product.id,
      product_name: product.name,
      brand_name: product.brand_name,
      unit: this.mapPackagingType(product.packaging_type),
      pieces_per_box: product.pieces_per_box ?? 1,
      quantity: 1,
      facture_unit_price: basePrice,
      prix_vente_pcs: htCost * (1 + this.marge / 100),
      unit_price: 0,
      tva_rate: tvaRate,
      image_url: product.image_url,
    };
    item.unit_price = this.pCtnTtc(item);
    this.items.push(item);
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

  onTvaChange(item: InvoiceItem): void {
    // Keep TTC per carton constant — back-calculate HT price per piece
    item.prix_vente_pcs = item.unit_price / item.pieces_per_box / (1 + item.tva_rate / 100);
  }

  tvaStyle(rate: number): Record<string, string> {
    if (rate === 9)  return { background: '#fff7ed', color: '#c2410c', borderColor: '#fed7aa' };
    if (rate === 19) return { background: '#fef2f2', color: '#b91c1c', borderColor: '#fecaca' };
    return { background: 'var(--surface-100)', color: 'var(--text-color-secondary)', borderColor: 'var(--surface-border)' };
  }


  // ── Save ─────────────────────────────────────────────────────────────────────
  confirmSave(): void {
    this.showSaveConfirm.set(true);
  }

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
      montant_declare: this.fiscal.montant_declare,
    };

    const payload: FacturationCreate = {
      client_id: this.selectedClient.id,
      document_type: this.documentType,
      fiscal_info: fiscalPayload,
      payment_mode: this.paymentMode,
      remise: this.remise,
      timbre: this.timbre,
      notes: this.notes || undefined,
      converted_from_bl_reference: this.sourceBdlReference ?? undefined,
      items: this.items.map(item => ({
        product_id: item.product_id,
        reference: item.product_id?.toString() ?? '',
        product_name: item.product_name,
        brand_name: item.brand_name,
        unit: item.unit,
        pieces_per_box: item.pieces_per_box,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tva_rate: item.tva_rate,
        image_url: item.image_url,
      } as FacturationItemCreate))
    };

    this.saving.set(true);
    this.facturationService.createFacturation(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          this.saving.set(false);
          this.clearDraft();
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

  createFromBdl(): void {
    const f = this.facture();
    if (!f) return;
    this.router.navigate([ROUTES.ADMIN.FACTURATION_NEW], { queryParams: { from_bdl: f.id } });
  }

  goToConvertedFacture(): void {
    const f = this.facture();
    if (!f?.converted_to_facture_id) return;
    this.router.navigate([RouteHelpers.adminFacturationDetail(f.converted_to_facture_id)]);
  }

  goToSourceBl(): void {
    const f = this.facture();
    if (!f?.converted_from_bl_reference) return;
    // Find the BL by reference from the list and navigate to it
    this.facturationService.getFacturations(0, 200).pipe(take(1)).subscribe({
      next: (res) => {
        const bl = res.facturations.find(x => x.reference === f.converted_from_bl_reference);
        if (bl) this.router.navigate([RouteHelpers.adminFacturationDetail(bl.id)]);
      }
    });
  }

  private loadFromBdl(bdlId: number): void {
    this.loading.set(true);
    this.facturationService.getFacturation(bdlId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (bdl) => {
          this.sourceBdlReference = bdl.reference;
          if (bdl.client_id) {
            this.selectedClient = {
              id: bdl.client_id,
              display_name: bdl.client_name,
              full_name: bdl.client_name,
              address: bdl.client_address,
              fiscal_info: {
                rc: bdl.client_rc,
                na: bdl.client_na,
                nif: bdl.client_nif,
                nis: bdl.client_nis,
              }
            };
            this.fiscal = this.fiscalFromClient(this.selectedClient);
          }
          this.items = bdl.items.map(item => {
            const prixVente = item.pieces_per_box > 0
              ? item.unit_price / item.pieces_per_box / (1 + item.tva_rate / 100)
              : 0;
            const inv: InvoiceItem = {
              product_id: item.product_id,
              product_name: item.product_name,
              brand_name: item.brand_name,
              unit: item.unit,
              pieces_per_box: item.pieces_per_box,
              quantity: item.quantity,
              facture_unit_price: prixVente,
              prix_vente_pcs: prixVente,
              unit_price: item.unit_price,
              tva_rate: item.tva_rate,
              image_url: item.image_url,
            };
            return inv;
          });
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.toast.showError('Erreur lors du chargement du bon de livraison');
        }
      });
  }

  // ── View mode actions ─────────────────────────────────────────────────────────
  print(): void    { this.generatePdf(false); }
  download(): void { this.generatePdf(true); }

  convertToFacture(): void {
    const f = this.facture();
    if (!f) return;
    this.confirmationService.confirm({
      message: `Voulez-vous convertir ${f.reference} en facture ? Cette action est irréversible.`,
      header: 'Confirmer la conversion',
      icon: 'pi pi-arrow-right-arrow-left',
      acceptLabel: 'Oui, convertir',
      rejectLabel: 'Annuler',
      acceptButtonStyleClass: 'p-button-success',
      accept: () => this.doConvert(f.id),
    });
  }

  private doConvert(id: number): void {
    this.converting.set(true);
    this.facturationService.convertToFacture(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          this.converting.set(false);
          this.toast.showSuccess(`Facture ${created.reference} créée`);
          const company = this.company();
          if (company) this.pdfService.generateFacturePdf(created, company, false);
          this.router.navigate([RouteHelpers.adminFacturationDetail(created.id)]);
        },
        error: () => {
          this.converting.set(false);
          this.toast.showError('Erreur lors de la conversion');
        }
      });
  }

  private generatePdf(download: boolean): void {
    const f = this.facture(); const company = this.company();
    if (!f || !company) return;
    this.pdfService.generateFacturePdf(f, company, download);
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

  paymentLabel(mode: string): string {
    return this.paymentModeOptions.find(o => o.value === mode)?.label ?? mode;
  }
  getPaymentSeverity(mode: string): 'success' | 'info' | 'secondary' {
    if (mode === 'espece') return 'success';
    if (mode === 'cheque') return 'info';
    return 'secondary';
  }
}
