import { Component, OnInit, OnDestroy, inject, signal, computed, DestroyRef, effect } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { catchError, of, finalize, forkJoin } from 'rxjs';
import { InputNumberModule } from 'primeng/inputnumber';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { PopoverModule } from 'primeng/popover';
import { DialogModule } from 'primeng/dialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { ADMIN_LIST_IMPORTS } from '../../shared/imports/admin-shared.imports';
import { TableSkeletonComponent, SkeletonColumn } from '../../shared/components/table-skeleton/table-skeleton.component';
import { AgroclikPageContainerComponent } from '../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { ApiService } from '../../services/api.service';
import {
  PurchaseOrderService,
  PurchaseOrderCreate,
  PurchaseOrderItemCreate
} from '../../services/purchase-order.service';

interface RestockRow {
  id: number;
  productId: number | null;
  brandId: number | null;
  categoryId: number | null;
  brand: string;
  category: string;
  name: string;
  image: string;
  description: string;
  supplier: string;
  phone: string;
  productUnit: string;
  packageType: string;
  volume: number | null;  // in liters (L)
  weight: number | null;  // in kilograms (kg)
  prixUniteAchat: number;
  uniteParCarton: number;
  prixCarton: number;
  nmbCarton: number;
  carry: boolean;
  priority: number;
  hidden: boolean;
  synced: boolean;
}

interface RestockData {
  items: RestockRow[];
}

interface BrandOption {
  id: number;
  name: string;
}

interface CategoryOption {
  id: number;
  name: string;
}

interface SupplierDetails {
  name: string;
  address: string;
  phone: string;
  email?: string;
  city?: string;
}

// Sample supplier details dictionary
const SUPPLIER_DETAILS: Record<string, SupplierDetails> = {
  'Cevital': {
    name: 'Cevital SPA',
    address: 'Zone Industrielle, Bejaia',
    phone: '034 20 50 00',
    email: 'contact@cevital.com',
    city: 'Bejaia'
  },
  'Condor': {
    name: 'Condor Electronics',
    address: 'Zone Industrielle Taharacht, Bordj Bou Arréridj',
    phone: '035 68 20 00',
    email: 'info@condor.dz',
    city: 'Bordj Bou Arréridj'
  },
  'Candia': {
    name: 'Tchin-Lait Candia',
    address: 'Zone Industrielle, Bejaia',
    phone: '034 21 50 50',
    city: 'Bejaia'
  },
  'Soummam': {
    name: 'Laiterie Soummam',
    address: 'Zone Industrielle Taharacht, Akbou',
    phone: '034 35 40 00',
    city: 'Akbou'
  },
  'Ifri': {
    name: 'SARL Ibrahim & Fils (IFRI)',
    address: 'Ighzer Amokrane, Ifri Ouzellaguen',
    phone: '034 35 10 10',
    city: 'Bejaia'
  },
  'Hamoud Boualem': {
    name: 'Hamoud Boualem SPA',
    address: 'Route Nationale N°5, Hussein Dey',
    phone: '021 77 20 20',
    city: 'Alger'
  },
  'La Belle': {
    name: 'La Belle SPA',
    address: 'Zone Industrielle, Rouiba',
    phone: '021 85 30 30',
    city: 'Alger'
  },
  'Amor Benamor': {
    name: 'Groupe Amor Benamor',
    address: 'Route de Constantine, Guelma',
    phone: '037 20 10 10',
    city: 'Guelma'
  }
};

@Component({
  selector: 'app-stock',
  standalone: true,
  imports: [
    ...ADMIN_LIST_IMPORTS,
    FormsModule,
    RouterLink,
    DecimalPipe,
    InputNumberModule,
    MultiSelectModule,
    SelectModule,
    PopoverModule,
    DialogModule,
    TableSkeletonComponent,
    AgroclikPageContainerComponent
  ],
  templateUrl: './stock.component.html',
  styleUrl: './stock.component.scss'
})
export class StockComponent implements OnInit, OnDestroy {
  private readonly DEFAULT_COLOR = { bg: 'rgba(100, 116, 139, 0.12)', text: '#64748b' };
  private readonly CART_STORAGE_KEY = 'stock_cart_items';
  private readonly ROWS_STORAGE_KEY = 'stock_rows_data';

  // Color caches to avoid recalculating on every change detection
  private readonly brandColorCache = new Map<string, { bg: string; text: string }>();
  private readonly categoryColorCache = new Map<string, { bg: string; text: string }>();

  private api = inject(ApiService);
  private http = inject(HttpClient);
  private toast = inject(ToastMessageService);
  private destroyRef = inject(DestroyRef);
  private orderService = inject(PurchaseOrderService);

  loading = signal(true);
  savingRow = signal<number | null>(null);
  tableInitialized = signal(false);
  isFullscreen = signal(true);
  searchQuery = signal('');
  dirtyRows = signal<Set<number>>(new Set());
  editingCell = signal<{ rowId: number; field: 'brand' | 'category' | 'priority' | 'packageType' | 'productUnit' | 'name' } | null>(null);
  lightboxImage = signal<string | null>(null);
  lightboxRow = signal<RestockRow | null>(null);
  isDragging = signal(false);
  isUploading = signal(false);
  syncingRow = signal<number | null>(null);
  private flashingRows = new Set<number>();
  syncDirtyRows = signal<Set<number>>(new Set()); // Tracks rows edited after sync
  allRows = signal<RestockRow[]>([]);

  // Auto-save rows to localStorage when they change
  private rowsSaveEffect = effect(() => {
    const rows = this.allRows();
    if (rows.length > 0) {
      this.saveRowsToStorage();
    }
  });

  brandsList = signal<BrandOption[]>([]);
  categoriesList = signal<CategoryOption[]>([]);
  categoryFilter = signal<string[]>([]);
  brandFilter = signal<string[]>([]);
  priorityFilter = signal<number[]>([]);
  sortField = signal<string>('brand');
  sortOrder = signal<'asc' | 'desc'>('asc');
  purchaseColumnsExpanded = signal(false);

  // Tab navigation
  currentTab = signal<'stock' | 'cart'>('stock');

  // Cart functionality
  cartItemIds = signal<Set<number>>(new Set());
  savingOrder = signal(false);
  lastSavedOrderRef = signal<string | null>(null);

  priorityOptions = [
    { label: '-', value: 0 },
    { label: '1', value: 1 },
    { label: '2', value: 2 },
    { label: '3', value: 3 },
    { label: '4', value: 4 },
    { label: '5', value: 5 }
  ];

  packageTypeOptions = [
    { label: 'Carton', value: 'Carton' },
    { label: 'Paquet', value: 'Paquet' },
    { label: 'Fardeau', value: 'Fardeau' },
    { label: 'Bouteille', value: 'Bouteille' },
    { label: 'Sachet', value: 'Sachet' },
    { label: 'Boîte', value: 'Boîte' },
    { label: 'Palette', value: 'Palette' }
  ];

  productUnitOptions = [
    // Piece / Individual
    { label: 'Pièce', value: 'piece' },
    { label: 'Unité', value: 'unit' },
    { label: 'Portion', value: 'portion' },
    { label: 'Tranche', value: 'slice' },
    // Container
    { label: 'Bouteille', value: 'bottle' },
    { label: 'Canette', value: 'can' },
    { label: 'Bocal', value: 'jar' },
    { label: 'Boîte', value: 'box' },
    { label: 'Sachet', value: 'sachet' },
    { label: 'Barquette', value: 'tray' },
    { label: 'Pot', value: 'pot' },
    { label: 'Tube', value: 'tube' },
    // Weight
    { label: 'Kg', value: 'kg' },
    { label: 'Gramme', value: 'g' },
    // Volume
    { label: 'Litre', value: 'L' },
    { label: 'Millilitre', value: 'ml' },
    { label: 'Centilitre', value: 'cl' },
    // Bulk / Logistic
    { label: 'Carton', value: 'carton' },
    { label: 'Caisse', value: 'crate' },
    { label: 'Pack', value: 'pack' },
    { label: 'Douzaine', value: 'dozen' },
    { label: 'Botte', value: 'bunch' },
    { label: 'Livre', value: 'pound' }
  ];

  currentView = signal<'active' | 'inactive'>('active');

  columnOptions = [
    { field: 'synced', label: 'Sync', visible: true },
    { field: 'priority', label: 'P', visible: true },
    { field: 'image', label: 'Image', visible: true },
    { field: 'name', label: 'Produit', visible: true },
    { field: 'brand', label: 'Marque', visible: true },
    { field: 'category', label: 'Catégorie', visible: true },
    { field: 'productUnit', label: 'Unité', visible: true },
    { field: 'packageType', label: 'Emballage', visible: true },
    { field: 'volume', label: 'Volume', visible: true },
    { field: 'weight', label: 'Poids', visible: true },
    { field: 'supplier', label: 'Fournisseur', visible: false },
    { field: 'phone', label: 'Téléphone', visible: false },
    { field: 'description', label: 'Description', visible: false },
    { field: 'prixUniteAchat', label: 'Prix Achat', visible: true },
    { field: 'uniteParCarton', label: 'Unité/Carton', visible: true },
    { field: 'prixCarton', label: 'Prix Carton', visible: true },
    { field: 'nmbCarton', label: 'Nmb Carton', visible: true },
    { field: 'total', label: 'Total', visible: true }
  ];

  skeletonColumns: SkeletonColumn[] = [
    { width: '50px', type: 'image', headerWidth: '40px' },
    { width: '10%', type: 'pill', headerWidth: '60px' },
    { width: '10%', type: 'pill', headerWidth: '50px' },
    { width: '15%', type: 'text', headerWidth: '60px' },
    { width: '20%', type: 'text', headerWidth: '80px' },
    { width: '10%', type: 'text', headerWidth: '60px' },
    { width: '10%', type: 'text', headerWidth: '80px' },
    { width: '10%', type: 'text', headerWidth: '60px' }
  ];

  filteredRows = computed(() => {
    let rows = [...this.allRows()];
    const catFilter = this.categoryFilter();
    const brandFilter = this.brandFilter();
    const prioFilter = this.priorityFilter();

    if (this.currentView() === 'active') {
      rows = rows.filter(r => !r.hidden);
    } else {
      rows = rows.filter(r => r.hidden);
    }

    if (catFilter && catFilter.length > 0) {
      rows = rows.filter(r => catFilter.includes(r.category));
    }

    if (brandFilter && brandFilter.length > 0) {
      rows = rows.filter(r => brandFilter.includes(r.brand));
    }

    if (prioFilter && prioFilter.length > 0) {
      rows = rows.filter(r => prioFilter.includes(r.priority));
    }

    if (this.searchQuery().trim()) {
      const search = this.searchQuery().toLowerCase();
      rows = rows.filter(r =>
        r.name.toLowerCase().includes(search) ||
        r.category.toLowerCase().includes(search) ||
        r.brand.toLowerCase().includes(search)
      );
    }

    const field = this.sortField();
    const order = this.sortOrder();
    rows.sort((a, b) => {
      let compareA: string | number = '';
      let compareB: string | number = '';

      if (field === 'total') {
        compareA = a.prixCarton * a.nmbCarton;
        compareB = b.prixCarton * b.nmbCarton;
      } else {
        const valA = a[field as keyof RestockRow];
        const valB = b[field as keyof RestockRow];

        if (typeof valA === 'string') compareA = valA.toLowerCase();
        else if (typeof valA === 'number') compareA = valA;

        if (typeof valB === 'string') compareB = valB.toLowerCase();
        else if (typeof valB === 'number') compareB = valB;
      }

      let result = 0;
      if (compareA < compareB) result = -1;
      else if (compareA > compareB) result = 1;

      return order === 'asc' ? result : -result;
    });

    return rows;
  });

  totalCartons = computed(() => this.filteredRows().reduce((sum, r) => sum + (r.nmbCarton || 0), 0));

  totalValue = computed(() => this.filteredRows().reduce((sum, r) => sum + ((r.prixCarton || 0) * (r.nmbCarton || 0)), 0));

  // Options from API for dropdowns (selecting by ID)
  categorySelectOptions = computed(() => {
    return this.categoriesList().map(c => ({ label: c.name, value: c.id }));
  });

  brandSelectOptions = computed(() => {
    return this.brandsList().map(b => ({ label: b.name, value: b.id }));
  });

  // Filter options (from category/brand tables)
  categoryFilterOptions = computed(() => {
    return this.categoriesList().map(c => ({ label: c.name, value: c.name }));
  });

  brandFilterOptions = computed(() => {
    return this.brandsList().map(b => ({ label: b.name, value: b.name }));
  });

  hiddenCount = computed(() => this.allRows().filter(r => r.hidden).length);

  activeCount = computed(() => this.allRows().filter(r => !r.hidden).length);

  // Cart computed properties
  cartItems = computed(() => {
    const ids = this.cartItemIds();
    return this.allRows().filter(r => ids.has(r.id));
  });

  cartCount = computed(() => this.cartItemIds().size);

  cartTotalValue = computed(() =>
    this.cartItems().reduce((sum, r) => sum + (r.prixCarton * r.nmbCarton), 0)
  );

  cartGroupedBySupplier = computed(() => {
    const rows = this.cartItems();
    const groups = new Map<string, RestockRow[]>();

    rows.forEach(row => {
      const supplier = row.supplier || '';
      if (!groups.has(supplier)) {
        groups.set(supplier, []);
      }
      groups.get(supplier)!.push(row);
    });

    return groups;
  });

  // Supplier selection for PDF generation
  selectedSupplier: string | null = null;

  // PDF Preview
  private sanitizer = inject(DomSanitizer);
  pdfPreviewUrl = signal<SafeResourceUrl | null>(null);
  private pdfBlobUrl: string | null = null;
  pdfDoc: jsPDF | null = null;
  showPdfPreview = false;
  private logoImage: HTMLImageElement | null = null;

  supplierOptions = computed(() => {
    const suppliers = new Set<string>();

    // Add suppliers from cart items
    this.cartItems().forEach(item => {
      if (item.supplier) {
        suppliers.add(item.supplier);
      }
    });

    // Add all suppliers from SUPPLIER_DETAILS dictionary
    Object.keys(SUPPLIER_DETAILS).forEach(supplier => {
      suppliers.add(supplier);
    });

    return Array.from(suppliers).sort().map(s => {
      const details = SUPPLIER_DETAILS[s];
      return {
        label: details ? `${s} - ${details.city || ''}` : s,
        value: s
      };
    });
  });

  getSupplierItemCount(supplier: string): number {
    return this.cartItems().filter(item => item.supplier === supplier).length;
  }

  getSupplierTotalValue(supplier: string): number {
    return this.cartItems()
      .filter(item => item.supplier === supplier)
      .reduce((sum, r) => sum + (r.prixCarton * r.nmbCarton), 0);
  }

  closePdfPreview(): void {
    this.showPdfPreview = false;
    if (this.pdfBlobUrl) {
      URL.revokeObjectURL(this.pdfBlobUrl);
      this.pdfBlobUrl = null;
    }
    this.pdfPreviewUrl.set(null);
    this.pdfDoc = null;
  }

  downloadPdf(): void {
    if (this.pdfDoc) {
      const today = new Date().toLocaleDateString('fr-FR');
      const supplierName = this.selectedSupplier || 'tous';
      this.pdfDoc.save(`bon-de-commande-${supplierName}-${today}.pdf`);
      this.toast.showSuccess('PDF téléchargé avec succès');
      this.closePdfPreview();
    }
  }

  saveBonDeCommande(): void {
    if (this.cartCount() === 0) {
      this.toast.showWarn('Le panier est vide');
      return;
    }

    const items = this.cartItems();
    const supplierKey = this.selectedSupplier || 'Cevital';
    const supplierInfo = SUPPLIER_DETAILS[supplierKey];

    // Build order items with product_id for stock sync
    const orderItems: PurchaseOrderItemCreate[] = items.map(row => ({
      product_id: row.productId ?? undefined,  // Link to products table for stock sync
      product_name: row.name,
      brand: row.brand,
      units_per_carton: row.uniteParCarton,
      quantity_ordered: row.nmbCarton,
      unit_price: row.prixCarton,
      total_price: row.prixCarton * row.nmbCarton
    }));

    // Build order
    const orderData: PurchaseOrderCreate = {
      supplier_name: supplierInfo?.name || supplierKey,
      supplier_address: supplierInfo?.address,
      supplier_phone: supplierInfo?.phone,
      supplier_email: supplierInfo?.email,
      supplier_city: supplierInfo?.city,
      items: orderItems
    };

    this.savingOrder.set(true);

    this.orderService.createOrder(orderData).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.savingOrder.set(false))
    ).subscribe({
      next: (order) => {
        this.lastSavedOrderRef.set(order.reference);
        this.toast.showSuccess(`Commande ${order.reference} enregistrée`);
        // Generate PDF with the saved reference
        this.generateBonDeCommandeWithRef(order.reference);
      },
      error: () => {
        this.toast.showError('Erreur lors de l\'enregistrement');
      }
    });
  }

  generateBonDeCommandeWithRef(reference: string): void {
    this.generateBonDeCommandeInternal(reference);
  }

  generateBonDeCommande(): void {
    // Generate a temporary reference for preview (not saved)
    const today = new Date();
    const tempRef = `BC-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-XXX`;
    this.generateBonDeCommandeInternal(tempRef);
  }

  private generateBonDeCommandeInternal(orderRef: string): void {
    if (this.cartCount() === 0) {
      this.toast.showWarn('Le panier est vide');
      return;
    }

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 12;
      const today = new Date();
      const items = this.cartItems();

      // ===== HEADER =====
      // Logo on the right
      if (this.logoImage) {
        const logoHeight = 12;
        const aspectRatio = this.logoImage.width / this.logoImage.height;
        const logoWidth = logoHeight * aspectRatio;
        doc.addImage(this.logoImage, 'PNG', pageWidth - margin - logoWidth, 8, logoWidth, logoHeight);
      }

      // Document title on the left
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 40, 40);
      doc.text('BON DE COMMANDE', margin, 14);

      // Reference and date below title
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`${orderRef}  |  ${this.formatDate(today.toISOString())}`, margin, 20);

      // Thin separator line
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(margin, 24, pageWidth - margin, 24);

      // ===== SUPPLIER INFO (Left side) - Always show =====
      let yPosition = 30;

      // Use selected supplier or default to first one (Cevital)
      const supplierKey = this.selectedSupplier || 'Cevital';
      const supplierInfo = SUPPLIER_DETAILS[supplierKey];

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(120, 120, 120);
      doc.text('FOURNISSEUR', margin, yPosition);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 40, 40);
      doc.text(this.normalizeText(supplierInfo?.name || supplierKey), margin, yPosition + 5);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      let infoY = yPosition + 10;

      if (supplierInfo?.address) {
        doc.text(this.normalizeText(supplierInfo.address), margin, infoY);
        infoY += 4;
      }
      if (supplierInfo?.city) {
        doc.text(this.normalizeText(supplierInfo.city), margin, infoY);
        infoY += 4;
      }
      if (supplierInfo?.phone) {
        doc.text(`Tel: ${supplierInfo.phone}`, margin, infoY);
      }

      yPosition += 24;

      // ===== PRODUCTS TABLE =====
      const tableData = items.map((row, index) => [
        (index + 1).toString(),
        this.normalizeText(row.name),
        this.normalizeText(row.brand),
        row.uniteParCarton.toString(),
        row.nmbCarton.toString(),
        this.formatNumber(row.prixCarton),
        this.formatNumber(row.prixCarton * row.nmbCarton)
      ]);

      const totalValue = items.reduce((sum, r) => sum + (r.prixCarton * r.nmbCarton), 0);
      const totalItems = items.reduce((sum, r) => sum + r.nmbCarton, 0);

      autoTable(doc, {
        startY: yPosition,
        head: [[
          { content: '#', styles: { halign: 'center' } },
          { content: 'Designation', styles: { halign: 'left' } },
          { content: 'Marque', styles: { halign: 'left' } },
          { content: 'U/C', styles: { halign: 'center' } },
          { content: 'Qte', styles: { halign: 'center' } },
          { content: 'P.U', styles: { halign: 'right' } },
          { content: 'Total', styles: { halign: 'right' } }
        ]],
        body: tableData,
        theme: 'plain',
        headStyles: {
          fillColor: [55, 55, 55],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7,
          cellPadding: 2
        },
        bodyStyles: {
          fontSize: 7,
          cellPadding: 1.8,
          textColor: [60, 60, 60]
        },
        alternateRowStyles: {
          fillColor: [248, 248, 248]
        },
        margin: { left: margin, right: margin },
        tableWidth: pageWidth - 2 * margin,
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 30 },
          3: { cellWidth: 12, halign: 'center' },
          4: { cellWidth: 12, halign: 'center' },
          5: { cellWidth: 22, halign: 'right' },
          6: { cellWidth: 25, halign: 'right', fontStyle: 'bold' }
        }
      });

      // Get final Y position after table
      let finalY = (doc as any).lastAutoTable.finalY + 8;

      // ===== TOTALS (Right aligned) =====
      const totalsX = pageWidth - margin - 50;

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`${items.length} produits  |  ${totalItems} articles`, totalsX, finalY, { align: 'left' });

      finalY += 6;
      doc.setFillColor(50, 50, 50);
      doc.roundedRect(totalsX - 3, finalY - 4, 53, 10, 2, 2, 'F');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('TOTAL', totalsX, finalY + 2);
      doc.text(`${this.formatNumber(totalValue)} DA`, pageWidth - margin - 5, finalY + 2, { align: 'right' });

      // ===== SIGNATURES =====
      finalY += 20;

      if (finalY < pageHeight - 40) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120, 120, 120);

        // Left signature
        doc.text('Signature Fournisseur', margin, finalY);
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.2);
        doc.roundedRect(margin, finalY + 2, 55, 18, 2, 2, 'S');

        // Right signature
        doc.text('Signature Acheteur', pageWidth - margin - 55, finalY);
        doc.roundedRect(pageWidth - margin - 55, finalY + 2, 55, 18, 2, 2, 'S');
      }

      // ===== FOOTER =====
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150, 150, 150);
      doc.text('Document genere automatiquement', pageWidth / 2, pageHeight - 5, { align: 'center' });

      // Show preview
      this.pdfDoc = doc;
      const pdfBlob = doc.output('blob');
      this.pdfBlobUrl = URL.createObjectURL(pdfBlob);
      this.pdfPreviewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfBlobUrl));
      this.showPdfPreview = true;
    } catch (error) {
      console.error('Error generating PDF:', error);
      this.toast.showError('Erreur lors de la génération du PDF');
    }
  }

  ngOnInit(): void {
    document.body.classList.add('fullscreen-active');
    this.loadCartFromStorage();
    this.loadData();
    this.loadLogo();
  }

  private loadLogo(): void {
    const img = new Image();
    img.src = 'logo.png';
    img.onload = () => {
      this.logoImage = img;
    };
  }

  ngOnDestroy(): void {
    document.body.classList.remove('fullscreen-active');
  }

  // Cart methods
  private loadCartFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.CART_STORAGE_KEY);
      if (stored) {
        const ids = JSON.parse(stored) as number[];
        this.cartItemIds.set(new Set(ids));
      }
    } catch {
      // Ignore parse errors
    }
  }

  private saveCartToStorage(): void {
    const ids = Array.from(this.cartItemIds());
    localStorage.setItem(this.CART_STORAGE_KEY, JSON.stringify(ids));
  }

  // Rows persistence methods
  private loadRowsFromStorage(): RestockRow[] | null {
    try {
      const stored = localStorage.getItem(this.ROWS_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as RestockRow[];
      }
    } catch {
      // Ignore parse errors
    }
    return null;
  }

  private saveRowsToStorage(): void {
    const rows = this.allRows();
    localStorage.setItem(this.ROWS_STORAGE_KEY, JSON.stringify(rows));
  }

  addToCart(row: RestockRow): void {
    this.cartItemIds.update(set => {
      const newSet = new Set(set);
      newSet.add(row.id);
      return newSet;
    });
    this.saveCartToStorage();
    this.toast.showSuccess(`${row.name} ajouté au panier`);
  }

  removeFromCart(row: RestockRow): void {
    this.cartItemIds.update(set => {
      const newSet = new Set(set);
      newSet.delete(row.id);
      return newSet;
    });
    this.saveCartToStorage();
  }

  toggleCart(row: RestockRow): void {
    if (this.isInCart(row.id)) {
      this.removeFromCart(row);
    } else {
      this.addToCart(row);
    }
  }

  isInCart(rowId: number): boolean {
    return this.cartItemIds().has(rowId);
  }

  clearCart(): void {
    this.cartItemIds.set(new Set());
    this.saveCartToStorage();
    this.toast.showSuccess('Panier vidé');
  }

  loadData(): void {
    this.loading.set(true);

    // Try to load rows from localStorage first
    const cachedRows = this.loadRowsFromStorage();

    forkJoin({
      restock: this.api.get<RestockData>('/restock').pipe(catchError(() => of({ items: [] }))),
      brands: this.api.get<BrandOption[]>('/brands').pipe(catchError(() => of([]))),
      categories: this.api.get<CategoryOption[]>('/categories').pipe(catchError(() => of([])))
    }).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: ({ restock, brands, categories }) => {
        this.brandsList.set(brands);
        this.categoriesList.set(categories);

        // Use cached rows if available, otherwise use API data
        if (cachedRows && cachedRows.length > 0) {
          this.allRows.set(cachedRows);
        } else {
          const rows: RestockRow[] = restock.items.map(item => ({
            id: item.id,
            productId: item.productId ?? null,
            brandId: item.brandId ?? null,
            categoryId: item.categoryId ?? null,
            brand: item.brand || '-',
            category: item.category || '-',
            name: item.name || '',
            image: item.image || '',
            description: item.description || '',
            supplier: item.supplier || '',
            phone: item.phone || '',
            productUnit: item.productUnit || 'piece',
            packageType: item.packageType || 'Carton',
            volume: item.volume ?? null,
            weight: item.weight ?? null,
            prixUniteAchat: item.prixUniteAchat || 0,
            uniteParCarton: item.uniteParCarton || 1,
            prixCarton: item.prixCarton || 0,
            nmbCarton: item.nmbCarton || 0,
            carry: item.carry ?? false,
            priority: item.priority || 0,
            hidden: item.hidden ?? false,
            synced: item.synced ?? false
          }));

          this.allRows.set(rows);
          this.saveRowsToStorage();
        }

        this.loading.set(false);
        this.tableInitialized.set(true);
      },
      error: () => {
        // If API fails, try to use cached data
        if (cachedRows && cachedRows.length > 0) {
          this.allRows.set(cachedRows);
          this.loading.set(false);
          this.tableInitialized.set(true);
          return;
        }
        this.toast.showError('Échec du chargement des données');
        this.loading.set(false);
      }
    });
  }

  onCategoryChange(value: string[] | null): void {
    this.categoryFilter.set(value ?? []);
  }

  onBrandChange(value: string[] | null): void {
    this.brandFilter.set(value ?? []);
  }

  onPriorityChange(value: number[] | null): void {
    this.priorityFilter.set(value ?? []);
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.categoryFilter.set([]);
    this.brandFilter.set([]);
    this.priorityFilter.set([]);
  }

  clearCategoryFilter(): void {
    this.categoryFilter.set([]);
  }

  clearBrandFilter(): void {
    this.brandFilter.set([]);
  }

  clearPriorityFilter(): void {
    this.priorityFilter.set([]);
  }

  hasActiveFilters(): boolean {
    const catFilter = this.categoryFilter();
    const brandFilter = this.brandFilter();
    const prioFilter = this.priorityFilter();
    return this.searchQuery().trim() !== '' || (catFilter?.length ?? 0) > 0 || (brandFilter?.length ?? 0) > 0 || (prioFilter?.length ?? 0) > 0;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (!img.src.includes('product-placeholder')) {
      img.src = 'assets/images/product-placeholder.png';
    }
  }

  selectOnFocus(event: Event): void {
    const input = event.target as HTMLInputElement;
    input?.select();
  }

  onPriceChange(row: RestockRow): void {
    row.prixCarton = row.prixUniteAchat * row.uniteParCarton;
    this.markRowDirty(row.id);
  }

  onFieldChange(row: RestockRow): void {
    this.markRowDirty(row.id);
  }

  onNmbCartonChange(row: RestockRow): void {
    row.carry = row.nmbCarton > 0;
    this.markRowDirty(row.id);
    this.allRows.update(rows => [...rows]);
  }

  refresh(): void {
    this.loadData();
  }

  private newRowCounter = 0;

  addRow(): void {
    this.newRowCounter++;
    const newId = -this.newRowCounter;

    const newRow: RestockRow = {
      id: newId,
      productId: null,
      brandId: null,
      categoryId: null,
      brand: '',
      category: '',
      name: '',
      image: '',
      description: '',
      supplier: '',
      phone: '',
      productUnit: 'piece',
      packageType: 'Carton',
      volume: null,
      weight: null,
      prixUniteAchat: 0,
      uniteParCarton: 1,
      prixCarton: 0,
      nmbCarton: 0,
      carry: false,
      priority: 0,
      hidden: false,
      synced: false
    };

    this.allRows.update(rows => [newRow, ...rows]);

    setTimeout(() => {
      const tableWrapper = document.querySelector('.table-wrapper');
      tableWrapper?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
  }

  saveRow(row: RestockRow): void {
    if (!row.name || !row.brandId || !row.categoryId) {
      const missing = [];
      if (!row.name) missing.push('nom');
      if (!row.brandId) missing.push('marque');
      if (!row.categoryId) missing.push('catégorie');
      this.flashRow(row.id, 'error', `Manque: ${missing.join(', ')}`);
      return;
    }

    this.savingRow.set(row.id);

    const payload = {
      id: row.id > 0 ? row.id : null,
      brandId: row.brandId,
      categoryId: row.categoryId,
      name: row.name,
      image: row.image,
      description: row.description,
      supplier: row.supplier,
      phone: row.phone,
      productUnit: row.productUnit,
      packageType: row.packageType,
      volume: row.volume,
      weight: row.weight,
      prixUniteAchat: row.prixUniteAchat,
      uniteParCarton: row.uniteParCarton,
      prixCarton: row.prixCarton,
      nmbCarton: row.nmbCarton,
      carry: row.carry,
      priority: row.priority,
      hidden: row.hidden
    };

    this.api.post<{ success: boolean; id: number }>('/restock/item', payload).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        this.savingRow.set(null);
        const originalId = row.id; // Store original ID for DOM lookup
        if (response.success) {
          this.clearRowDirty(originalId); // Clear with original ID
          this.flashRow(originalId, 'success', 'Enregistré'); // Flash before ID change
          if (originalId < 0) {
            row.id = response.id;
            this.allRows.update(rows => [...rows]); // Trigger update for new ID
          }
        } else {
          this.flashRow(originalId, 'error', 'Échec sauvegarde');
        }
      },
      error: (err) => {
        this.savingRow.set(null);
        const errorMsg = this.extractErrorMessage(err);
        this.flashRow(row.id, 'error', errorMsg);
      }
    });
  }

  private flashRow(rowId: number, type: 'success' | 'error', message: string): void {
    // Prevent stacking animations on same row
    if (this.flashingRows.has(rowId)) return;
    this.flashingRows.add(rowId);

    const rowElement = document.querySelector(`tr[data-row-id="${rowId}"]`) as HTMLElement;
    if (!rowElement) {
      this.flashingRows.delete(rowId);
      return;
    }

    const isSuccess = type === 'success';
    const primaryColor = isSuccess ? '34, 197, 94' : '239, 68, 68';
    const gradientColors = isSuccess
      ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
      : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';

    // Get row position for fixed overlay (doesn't affect table layout)
    const rect = rowElement.getBoundingClientRect();

    // Swing animation on row cells (transform doesn't affect layout)
    const cells = rowElement.querySelectorAll('td');
    const swingKeyframes = isSuccess
      ? [
          { transform: 'translateX(0)' },
          { transform: 'translateX(-4px)' },
          { transform: 'translateX(3px)' },
          { transform: 'translateX(-2px)' },
          { transform: 'translateX(0)' }
        ]
      : [
          { transform: 'translateX(0)' },
          { transform: 'translateX(-6px)' },
          { transform: 'translateX(6px)' },
          { transform: 'translateX(-4px)' },
          { transform: 'translateX(4px)' },
          { transform: 'translateX(0)' }
        ];

    cells.forEach(cell => {
      cell.animate(swingKeyframes, {
        duration: isSuccess ? 300 : 400,
        easing: 'ease-out'
      });
    });

    // Create container for overlay elements (fixed position, outside table)
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      top: ${rect.top}px;
      left: ${rect.left}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      pointer-events: none;
      z-index: 1000;
      overflow: hidden;
    `;

    // Create overlay element for smooth animation
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute;
      inset: 0;
      background: rgba(${primaryColor}, 0.25);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s ease-out;
    `;

    // Create shine sweep effect
    const shine = document.createElement('div');
    shine.style.cssText = `
      position: absolute;
      top: 0;
      left: -100%;
      width: 60%;
      height: 100%;
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(255, 255, 255, 0.4) 50%,
        transparent 100%
      );
      pointer-events: none;
      transform: skewX(-20deg);
    `;

    // Create badge
    const badge = document.createElement('div');
    badge.innerHTML = `<i class="pi ${isSuccess ? 'pi-check' : 'pi-times'}" style="margin-right: 6px; font-size: 0.7rem;"></i>${message}`;
    badge.style.cssText = `
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%) scale(0.8);
      padding: 0.4rem 0.85rem;
      border-radius: 20px;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.03em;
      color: white;
      background: ${gradientColors};
      box-shadow: 0 4px 15px rgba(${primaryColor}, 0.4);
      z-index: 100;
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      display: flex;
      align-items: center;
    `;

    container.appendChild(overlay);
    container.appendChild(shine);
    container.appendChild(badge);
    document.body.appendChild(container);

    // Trigger animation (next frame)
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      badge.style.opacity = '1';
      badge.style.transform = 'translate(-50%, -50%) scale(1)';

      // Animate shine sweep
      shine.animate([
        { left: '-100%' },
        { left: '200%' }
      ], {
        duration: 600,
        easing: 'ease-in-out'
      });
    });

    // Timing based on type - errors stay longer
    const overlayFadeTime = isSuccess ? 500 : 800;
    const badgeFadeTime = isSuccess ? 1200 : 3000;
    const cleanupTime = isSuccess ? 1600 : 3500;

    // Fade out overlay
    setTimeout(() => {
      overlay.style.opacity = '0';
    }, overlayFadeTime);

    // Fade out badge
    setTimeout(() => {
      badge.style.opacity = '0';
      badge.style.transform = 'translate(-50%, -50%) scale(0.8)';
    }, badgeFadeTime);

    // Clean up
    setTimeout(() => {
      container.remove();
      this.flashingRows.delete(rowId);
    }, cleanupTime);
  }

  deleteRow(row: RestockRow): void {
    if (this.isNewRow(row)) {
      this.allRows.update(rows => rows.filter(r => r.id !== row.id));
      this.toast.showSuccess('Produit supprimé');
    } else {
      this.api.delete<{ success: boolean }>(`/restock/item/${row.id}`).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: () => {
          this.allRows.update(rows => rows.filter(r => r.id !== row.id));
          this.toast.showSuccess('Produit supprimé');
        },
        error: (err) => {
          let errorMessage = 'Échec de la suppression';
          if (err.error?.detail) {
            errorMessage += ': ' + err.error.detail;
          }
          this.toast.showError(errorMessage);
        }
      });
    }
  }

  setRowHidden(row: RestockRow, hidden: boolean): void {
    row.hidden = hidden;
    this.markRowDirty(row.id);
    this.allRows.update(rows => [...rows]);
  }

  isNewRow(row: RestockRow): boolean {
    return row.id < 0;
  }

  // Sync single row to products
  syncRow(row: RestockRow): void {
    if (!row.name || !row.categoryId) {
      this.flashRow(row.id, 'error', 'Nom et catégorie requis');
      return;
    }

    this.syncingRow.set(row.id);

    this.api.post<{ success: boolean; restockId: number; productId?: number; message: string }>(`/restock/sync/${row.id}`, {}).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        this.syncingRow.set(null);
        if (response.success) {
          row.synced = true;
          row.productId = response.productId ?? null;
          // Clear sync dirty state
          this.syncDirtyRows.update(set => {
            const newSet = new Set(set);
            newSet.delete(row.id);
            return newSet;
          });
          this.allRows.update(rows => [...rows]);
          this.flashRow(row.id, 'success', 'Synchronisé');
        } else {
          this.flashRow(row.id, 'error', response.message || 'Échec sync');
        }
      },
      error: (err) => {
        this.syncingRow.set(null);
        const errorMsg = this.extractErrorMessage(err);
        this.flashRow(row.id, 'error', errorMsg);
      }
    });
  }

  private extractErrorMessage(err: any): string {
    if (typeof err?.error?.detail === 'string') {
      return err.error.detail;
    }
    if (Array.isArray(err?.error?.detail)) {
      const firstError = err.error.detail[0];
      if (firstError) {
        const field = firstError.loc?.slice(-1)[0] || '';
        const msg = firstError.msg || 'Erreur validation';
        return field ? `${field}: ${msg}` : msg;
      }
      return 'Erreur validation';
    }
    if (typeof err?.error === 'string') {
      return err.error;
    }
    if (typeof err?.message === 'string') {
      return err.message;
    }
    return 'Erreur serveur';
  }

  markRowDirty(rowId: number): void {
    this.dirtyRows.update(set => {
      const newSet = new Set(set);
      newSet.add(rowId);
      return newSet;
    });

    // Also mark as sync dirty if row was synced
    const row = this.allRows().find(r => r.id === rowId);
    if (row?.synced) {
      this.syncDirtyRows.update(set => {
        const newSet = new Set(set);
        newSet.add(rowId);
        return newSet;
      });
    }
  }

  clearRowDirty(rowId: number): void {
    this.dirtyRows.update(set => {
      const newSet = new Set(set);
      newSet.delete(rowId);
      return newSet;
    });
  }

  isRowDirty(rowId: number): boolean {
    return this.dirtyRows().has(rowId);
  }

  isRowSyncDirty(rowId: number): boolean {
    return this.syncDirtyRows().has(rowId);
  }

  startEditing(rowId: number, field: 'brand' | 'category' | 'priority' | 'packageType' | 'productUnit' | 'name'): void {
    this.editingCell.set({ rowId, field });
  }

  stopEditing(): void {
    this.editingCell.set(null);
  }

  isEditing(rowId: number, field: 'brand' | 'category' | 'priority' | 'packageType' | 'productUnit' | 'name'): boolean {
    const editing = this.editingCell();
    return editing !== null && editing.rowId === rowId && editing.field === field;
  }

  onBrandSelect(row: RestockRow, brandId: number): void {
    row.brandId = brandId;
    const brand = this.brandsList().find(b => b.id === brandId);
    row.brand = brand?.name || '';
    if (this.isNewRow(row)) {
      row.image = this.generateImageUrl(row);
    }
    this.markRowDirty(row.id);
    this.stopEditing();
  }

  onCategorySelect(row: RestockRow, categoryId: number): void {
    row.categoryId = categoryId;
    const category = this.categoriesList().find(c => c.id === categoryId);
    row.category = category?.name || '';
    if (this.isNewRow(row)) {
      row.image = this.generateImageUrl(row);
    }
    this.markRowDirty(row.id);
    this.stopEditing();
  }

  onInlineSelect(row: RestockRow, field: 'priority' | 'packageType' | 'productUnit', value: string | number): void {
    (row as any)[field] = value;
    this.markRowDirty(row.id);
    this.stopEditing();
  }

  getPriorityColor(priority: number): { bg: string; text: string } {
    const colors: { [key: number]: { bg: string; text: string } } = {
      0: this.DEFAULT_COLOR,
      1: { bg: 'rgba(239, 68, 68, 0.12)', text: '#dc2626' },
      2: { bg: 'rgba(249, 115, 22, 0.12)', text: '#ea580c' },
      3: { bg: 'rgba(234, 179, 8, 0.12)', text: '#ca8a04' },
      4: { bg: 'rgba(34, 197, 94, 0.12)', text: '#16a34a' },
      5: { bg: 'rgba(59, 130, 246, 0.12)', text: '#3b82f6' }
    };
    return colors[priority] || this.DEFAULT_COLOR;
  }

  getPriorityLabel(priority: number): string {
    return priority === 0 ? '-' : priority.toString();
  }

  getPackageTypeColor(packageType: string): { bg: string; text: string } {
    const colors: { [key: string]: { bg: string; text: string } } = {
      'Carton': { bg: 'rgba(139, 92, 246, 0.12)', text: '#7c3aed' },
      'Paquet': { bg: 'rgba(59, 130, 246, 0.12)', text: '#3b82f6' },
      'Fardeau': { bg: 'rgba(236, 72, 153, 0.12)', text: '#db2777' },
      'Bouteille': { bg: 'rgba(6, 182, 212, 0.12)', text: '#0891b2' },
      'Sachet': { bg: 'rgba(234, 179, 8, 0.12)', text: '#ca8a04' },
      'Boîte': { bg: 'rgba(249, 115, 22, 0.12)', text: '#ea580c' },
      'Palette': { bg: 'rgba(16, 185, 129, 0.12)', text: '#059669' }
    };
    return colors[packageType] || this.DEFAULT_COLOR;
  }

  getUnitColor(unit: string): { bg: string; text: string } {
    const colors: { [key: string]: { bg: string; text: string } } = {
      // Piece / Individual - Green tones
      'piece': { bg: 'rgba(34, 197, 94, 0.12)', text: '#22c55e' },
      'unit': { bg: 'rgba(34, 197, 94, 0.12)', text: '#22c55e' },
      'portion': { bg: 'rgba(16, 185, 129, 0.12)', text: '#10b981' },
      'slice': { bg: 'rgba(20, 184, 166, 0.12)', text: '#14b8a6' },
      // Container - Blue/Purple tones
      'bottle': { bg: 'rgba(6, 182, 212, 0.12)', text: '#06b6d4' },
      'can': { bg: 'rgba(14, 165, 233, 0.12)', text: '#0ea5e9' },
      'jar': { bg: 'rgba(59, 130, 246, 0.12)', text: '#3b82f6' },
      'box': { bg: 'rgba(99, 102, 241, 0.12)', text: '#6366f1' },
      'sachet': { bg: 'rgba(234, 179, 8, 0.12)', text: '#ca8a04' },
      'tray': { bg: 'rgba(139, 92, 246, 0.12)', text: '#8b5cf6' },
      'pot': { bg: 'rgba(217, 70, 239, 0.12)', text: '#d946ef' },
      'tube': { bg: 'rgba(236, 72, 153, 0.12)', text: '#ec4899' },
      // Weight - Red/Orange tones
      'kg': { bg: 'rgba(239, 68, 68, 0.12)', text: '#ef4444' },
      'g': { bg: 'rgba(249, 115, 22, 0.12)', text: '#f97316' },
      // Volume - Cyan tones
      'L': { bg: 'rgba(8, 145, 178, 0.12)', text: '#0891b2' },
      'ml': { bg: 'rgba(34, 211, 238, 0.12)', text: '#22d3ee' },
      'cl': { bg: 'rgba(103, 232, 249, 0.12)', text: '#06b6d4' },
      // Bulk / Logistic - Various
      'carton': { bg: 'rgba(124, 58, 237, 0.12)', text: '#7c3aed' },
      'crate': { bg: 'rgba(79, 70, 229, 0.12)', text: '#4f46e5' },
      'pack': { bg: 'rgba(37, 99, 235, 0.12)', text: '#2563eb' },
      'dozen': { bg: 'rgba(14, 165, 233, 0.12)', text: '#0ea5e9' },
      'bunch': { bg: 'rgba(16, 185, 129, 0.12)', text: '#10b981' },
      'pound': { bg: 'rgba(168, 85, 247, 0.12)', text: '#a855f7' }
    };
    return colors[unit] || this.DEFAULT_COLOR;
  }

  getUnitLabel(unit: string): string {
    const labels: { [key: string]: string } = {
      // Piece / Individual
      'piece': 'Pièce',
      'unit': 'Unité',
      'portion': 'Portion',
      'slice': 'Tranche',
      // Container
      'bottle': 'Bouteille',
      'can': 'Canette',
      'jar': 'Bocal',
      'box': 'Boîte',
      'sachet': 'Sachet',
      'tray': 'Barquette',
      'pot': 'Pot',
      'tube': 'Tube',
      // Weight
      'kg': 'Kg',
      'g': 'Gramme',
      // Volume
      'L': 'Litre',
      'ml': 'Millilitre',
      'cl': 'Centilitre',
      // Bulk / Logistic
      'carton': 'Carton',
      'crate': 'Caisse',
      'pack': 'Pack',
      'dozen': 'Douzaine',
      'bunch': 'Botte',
      'pound': 'Livre'
    };
    return labels[unit] || unit;
  }

  onProductNameChange(row: RestockRow, newName: string): void {
    const targetRow = this.allRows().find(r => r.id === row.id);
    if (targetRow) {
      targetRow.name = newName;
      if (this.isNewRow(row)) {
        targetRow.image = this.generateImageUrl(targetRow);
      }
      this.markRowDirty(row.id);
    }
  }

  generateImageUrl(row: RestockRow): string {
    if (!row.brand || !row.name) return '';
    const slugify = (str: string) => str.toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `https://agroclik.s3.eu-west-3.amazonaws.com/products/${slugify(row.brand)}/${slugify(row.name)}.webp`;
  }

  downloadStock(): void {
    const rows = this.filteredRows();
    const headers = ['À Vendre', 'Sync', 'Produit', 'Marque', 'Catégorie', 'Volume', 'Poids', 'Fournisseur', 'Téléphone', 'Prix Achat', 'Unité/Carton', 'Prix Carton', 'Nmb Carton', 'Total'];

    const csvContent = [
      headers.join(','),
      ...rows.map(row => [
        row.carry ? 'Oui' : 'Non',
        row.synced ? 'Oui' : 'Non',
        `"${row.name}"`,
        `"${row.brand}"`,
        `"${row.category}"`,
        `"${row.volume}"`,
        `"${row.weight}"`,
        `"${row.supplier}"`,
        `"${row.phone}"`,
        row.prixUniteAchat,
        row.uniteParCarton,
        row.prixCarton,
        row.nmbCarton,
        row.prixCarton * row.nmbCarton
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `restock_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  toggleFullscreen(): void {
    this.isFullscreen.update(v => !v);
    document.body.classList.toggle('fullscreen-active', this.isFullscreen());
  }

  toggleColumn(field: string): void {
    const col = this.columnOptions.find(c => c.field === field);
    if (col) {
      col.visible = !col.visible;
    }
  }

  sort(field: string): void {
    if (this.sortField() === field) {
      this.sortOrder.update(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortOrder.set('asc');
    }
  }

  isColumnVisible(field: string): boolean {
    const col = this.columnOptions.find(c => c.field === field);
    return col ? col.visible : true;
  }

  private colorPalette = [
    { bg: 'rgba(59, 130, 246, 0.12)', text: '#3b82f6' },
    { bg: 'rgba(37, 99, 235, 0.12)', text: '#2563eb' },
    { bg: 'rgba(29, 78, 216, 0.12)', text: '#1d4ed8' },
    { bg: 'rgba(96, 165, 250, 0.12)', text: '#3b82f6' },
    { bg: 'rgba(139, 92, 246, 0.12)', text: '#8b5cf6' },
    { bg: 'rgba(124, 58, 237, 0.12)', text: '#7c3aed' },
    { bg: 'rgba(167, 139, 250, 0.12)', text: '#7c3aed' },
    { bg: 'rgba(192, 132, 252, 0.12)', text: '#9333ea' },
    { bg: 'rgba(99, 102, 241, 0.12)', text: '#6366f1' },
    { bg: 'rgba(79, 70, 229, 0.12)', text: '#4f46e5' },
    { bg: 'rgba(129, 140, 248, 0.12)', text: '#4f46e5' },
    { bg: 'rgba(16, 185, 129, 0.12)', text: '#10b981' },
    { bg: 'rgba(34, 197, 94, 0.12)', text: '#22c55e' },
    { bg: 'rgba(5, 150, 105, 0.12)', text: '#059669' },
    { bg: 'rgba(20, 184, 166, 0.12)', text: '#14b8a6' },
    { bg: 'rgba(13, 148, 136, 0.12)', text: '#0d9488' },
    { bg: 'rgba(132, 204, 22, 0.12)', text: '#65a30d' },
    { bg: 'rgba(163, 230, 53, 0.12)', text: '#65a30d' },
    { bg: 'rgba(6, 182, 212, 0.12)', text: '#06b6d4' },
    { bg: 'rgba(8, 145, 178, 0.12)', text: '#0891b2' },
    { bg: 'rgba(34, 211, 238, 0.12)', text: '#06b6d4' },
    { bg: 'rgba(245, 158, 11, 0.12)', text: '#d97706' },
    { bg: 'rgba(217, 119, 6, 0.12)', text: '#b45309' },
    { bg: 'rgba(251, 191, 36, 0.12)', text: '#d97706' },
    { bg: 'rgba(234, 179, 8, 0.12)', text: '#ca8a04' },
    { bg: 'rgba(249, 115, 22, 0.12)', text: '#ea580c' },
    { bg: 'rgba(234, 88, 12, 0.12)', text: '#c2410c' },
    { bg: 'rgba(251, 146, 60, 0.12)', text: '#ea580c' },
    { bg: 'rgba(239, 68, 68, 0.12)', text: '#dc2626' },
    { bg: 'rgba(220, 38, 38, 0.12)', text: '#b91c1c' },
    { bg: 'rgba(248, 113, 113, 0.12)', text: '#dc2626' },
    { bg: 'rgba(236, 72, 153, 0.12)', text: '#db2777' },
    { bg: 'rgba(219, 39, 119, 0.12)', text: '#be185d' },
    { bg: 'rgba(244, 114, 182, 0.12)', text: '#db2777' },
    { bg: 'rgba(244, 63, 94, 0.12)', text: '#e11d48' },
    { bg: 'rgba(225, 29, 72, 0.12)', text: '#be123c' },
    { bg: 'rgba(251, 113, 133, 0.12)', text: '#e11d48' },
    { bg: 'rgba(217, 70, 239, 0.12)', text: '#c026d3' },
    { bg: 'rgba(192, 38, 211, 0.12)', text: '#a21caf' },
    { bg: 'rgba(100, 116, 139, 0.12)', text: '#475569' },
    { bg: 'rgba(71, 85, 105, 0.12)', text: '#334155' },
    { bg: 'rgba(14, 165, 233, 0.12)', text: '#0284c7' },
    { bg: 'rgba(2, 132, 199, 0.12)', text: '#0369a1' },
    { bg: 'rgba(168, 85, 247, 0.12)', text: '#9333ea' },
    { bg: 'rgba(74, 222, 128, 0.12)', text: '#16a34a' },
    { bg: 'rgba(45, 212, 191, 0.12)', text: '#0d9488' },
    { bg: 'rgba(253, 186, 116, 0.12)', text: '#ea580c' },
    { bg: 'rgba(252, 165, 165, 0.12)', text: '#dc2626' },
    { bg: 'rgba(196, 181, 253, 0.12)', text: '#7c3aed' },
  ];

  private getColorForString(value: string): { bg: string; text: string } {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = value.charCodeAt(i) + ((hash << 5) - hash);
    }
    return this.colorPalette[Math.abs(hash) % this.colorPalette.length];
  }

  getBrandColor(brand: string): { bg: string; text: string } {
    if (!brand) return this.DEFAULT_COLOR;
    let color = this.brandColorCache.get(brand);
    if (!color) {
      color = this.getColorForString(brand);
      this.brandColorCache.set(brand, color);
    }
    return color;
  }

  getCategoryColor(category: string): { bg: string; text: string } {
    if (!category) return this.DEFAULT_COLOR;
    let color = this.categoryColorCache.get(category);
    if (!color) {
      color = this.getColorForString(category + '_cat');
      this.categoryColorCache.set(category, color);
    }
    return color;
  }

  openLightbox(imageUrl: string, row?: RestockRow): void {
    if (imageUrl && !imageUrl.includes('placeholder')) {
      this.lightboxImage.set(imageUrl);
      this.lightboxRow.set(row ?? null);
    }
  }

  closeLightbox(): void {
    this.lightboxImage.set(null);
    this.lightboxRow.set(null);
    this.isDragging.set(false);
  }

  // Drag & Drop handlers
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.uploadImage(files[0]);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.uploadImage(input.files[0]);
      input.value = ''; // Reset for same file selection
    }
  }

  private uploadImage(file: File): void {
    const row = this.lightboxRow();
    if (!row) {
      this.toast.showError('Aucun produit sélectionné');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      this.toast.showError('Veuillez sélectionner une image');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      this.toast.showError('L\'image est trop grande (max 10MB)');
      return;
    }

    // Validate row has required fields
    if (!row.brand || !row.name) {
      this.toast.showError('Le produit doit avoir une marque et un nom');
      return;
    }

    this.isUploading.set(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('brand', row.brand);
    formData.append('name', row.name);
    formData.append('restockId', row.id.toString());

    this.http.post<{ success: boolean; url: string; restockId: number }>('/api/v1/restock/upload-image', formData)
      .pipe(
        finalize(() => this.isUploading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          if (response.success) {
            // Update the row's image URL with cache buster
            const targetRow = this.allRows().find(r => r.id === response.restockId);
            if (targetRow) {
              // Add timestamp to bust browser cache
              const cacheBuster = '?t=' + Date.now();
              targetRow.image = response.url + cacheBuster;
              // Move row to top of list
              this.allRows.update(rows => {
                const filtered = rows.filter(r => r.id !== response.restockId);
                return [targetRow, ...filtered];
              });
              this.lightboxImage.set(response.url + cacheBuster);
              this.markRowDirty(targetRow.id);
            }
            this.closeLightbox();
            // Scroll to top and bounce the image
            setTimeout(() => {
              const tableWrapper = document.querySelector('.table-wrapper');
              tableWrapper?.scrollTo({ top: 0, behavior: 'smooth' });
              this.bounceImage(response.restockId);
            }, 50);
            this.toast.showSuccess('Image mise à jour');
          }
        },
        error: (err) => {
          const message = err.error?.detail || 'Échec du téléchargement';
          this.toast.showError(message);
        }
      });
  }

  private bounceImage(rowId: number): void {
    setTimeout(() => {
      const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
      if (!row) return;

      const img = row.querySelector('.product-thumbnail') as HTMLElement;
      if (!img) return;

      img.classList.add('image-bounce');
      setTimeout(() => {
        img.classList.remove('image-bounce');
      }, 600);
    }, 100);
  }

  private formatNumber(value: number): string {
    // Use simple formatting for PDF compatibility
    return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  private formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  private normalizeText(text: string): string {
    // Remove accents for PDF compatibility (é → e, è → e, etc.)
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  getSupplierTotal(rows: RestockRow[]): number {
    return rows.reduce((sum, r) => sum + (r.prixCarton * r.nmbCarton), 0);
  }

  downloadCartPDF(): void {
    if (this.cartCount() === 0) {
      this.toast.showWarn('Le panier est vide');
      return;
    }

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const today = new Date();

      // Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Bon de Commande', 14, 20);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Date: ${this.formatDate(today.toISOString())}`, 14, 28);

      let yPosition = 40;
      const groups = this.cartGroupedBySupplier();

      groups.forEach((rows, supplier) => {
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 20;
        }

        // Get supplier details from dictionary or use defaults
        const supplierInfo = SUPPLIER_DETAILS[supplier];

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Fournisseur: ${this.normalizeText(supplierInfo?.name || supplier)}`, 14, yPosition);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        let detailsY = yPosition + 6;

        if (supplierInfo?.address) {
          doc.text(`Adresse: ${this.normalizeText(supplierInfo.address)}${supplierInfo.city ? ', ' + this.normalizeText(supplierInfo.city) : ''}`, 14, detailsY);
          detailsY += 5;
        }

        const phone = supplierInfo?.phone || rows[0]?.phone;
        if (phone) {
          doc.text(`Tel: ${phone}`, 14, detailsY);
          detailsY += 5;
        }

        if (supplierInfo?.email) {
          doc.text(`Email: ${supplierInfo.email}`, 14, detailsY);
          detailsY += 5;
        }

        yPosition = detailsY + 5;

        const tableData = rows.map(row => [
          this.normalizeText(row.name),
          this.normalizeText(row.brand),
          row.nmbCarton.toString(),
          this.formatNumber(row.prixCarton),
          this.formatNumber(row.prixCarton * row.nmbCarton)
        ]);

        const supplierTotal = rows.reduce((sum, r) => sum + (r.prixCarton * r.nmbCarton), 0);

        autoTable(doc, {
          startY: yPosition,
          head: [['Produit', 'Marque', 'Qté', 'Prix/Carton', 'Total']],
          body: tableData,
          foot: [['', '', '', 'Total:', this.formatNumber(supplierTotal)]],
          theme: 'plain',
          headStyles: {
            fillColor: [245, 245, 245],
            textColor: [40, 40, 40],
            fontStyle: 'bold',
            lineWidth: 0.5,
            lineColor: [200, 200, 200]
          },
          bodyStyles: {
            lineWidth: 0.25,
            lineColor: [220, 220, 220]
          },
          footStyles: {
            fillColor: [250, 250, 250],
            textColor: [30, 30, 30],
            fontStyle: 'bold',
            lineWidth: 0.5,
            lineColor: [200, 200, 200]
          },
          alternateRowStyles: {
            fillColor: [252, 252, 252]
          },
          margin: { left: 14, right: 14 },
          styles: {
            fontSize: 9,
            cellPadding: 4,
            lineColor: [220, 220, 220],
            lineWidth: 0.25
          },
          columnStyles: {
            0: { cellWidth: 60 },
            1: { cellWidth: 40 },
            2: { cellWidth: 20, halign: 'center' },
            3: { cellWidth: 30, halign: 'right' },
            4: { cellWidth: 30, halign: 'right' }
          }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;
      });

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`Total Général: ${this.formatNumber(this.cartTotalValue())} DA`, pageWidth - 14, yPosition, { align: 'right' });

      const fileName = `bon_commande_${today.toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      this.toast.showSuccess('PDF téléchargé avec succès');
    } catch {
      this.toast.showError('Erreur lors de la génération du PDF');
    }
  }
}
