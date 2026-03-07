import { Component, OnInit, OnDestroy, inject, signal, computed, DestroyRef } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
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
  prixUniteAchat: number;
  prixUniteVente: number;
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

@Component({
  selector: 'app-stock',
  standalone: true,
  imports: [
    ...ADMIN_LIST_IMPORTS,
    FormsModule,
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

  private api = inject(ApiService);
  private http = inject(HttpClient);
  private toast = inject(ToastMessageService);
  private destroyRef = inject(DestroyRef);

  loading = signal(true);
  savingRow = signal<number | null>(null);
  tableInitialized = signal(false);
  isFullscreen = signal(true);
  searchQuery = signal('');
  dirtyRows = signal<Set<number>>(new Set());
  editingCell = signal<{ rowId: number; field: 'brand' | 'category' | 'priority' | 'packageType' | 'productUnit' | 'name' } | null>(null);
  showInvoiceDialog = false;
  groupBySupplier = signal(true);
  invoiceDate = new Date();
  lightboxImage = signal<string | null>(null);
  lightboxRow = signal<RestockRow | null>(null);
  isDragging = signal(false);
  isUploading = signal(false);
  syncingRow = signal<number | null>(null);
  private flashingRows = new Set<number>();
  syncDirtyRows = signal<Set<number>>(new Set()); // Tracks rows edited after sync
  allRows = signal<RestockRow[]>([]);
  brandsList = signal<BrandOption[]>([]);
  categoriesList = signal<CategoryOption[]>([]);
  categoryFilter = signal<string[]>([]);
  brandFilter = signal<string[]>([]);
  priorityFilter = signal<number[]>([]);
  sortField = signal<string>('brand');
  sortOrder = signal<'asc' | 'desc'>('asc');
  purchaseColumnsExpanded = signal(false);

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
    { field: 'supplier', label: 'Fournisseur', visible: false },
    { field: 'phone', label: 'Téléphone', visible: false },
    { field: 'description', label: 'Description', visible: false },
    { field: 'prixUniteAchat', label: 'Prix Achat', visible: true },
    { field: 'prixUniteVente', label: 'Prix Vente', visible: true },
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

  selectedForInvoice = computed(() => this.allRows().filter(r => r.carry));

  selectedCount = computed(() => this.selectedForInvoice().length);

  selectedTotalValue = computed(() => this.selectedForInvoice().reduce((sum, r) => sum + (r.prixCarton * r.nmbCarton), 0));

  hiddenCount = computed(() => this.allRows().filter(r => r.hidden).length);

  activeCount = computed(() => this.allRows().filter(r => !r.hidden).length);

  rowsGroupedBySupplier = computed(() => {
    const rows = this.selectedForInvoice();
    const groups = new Map<string, RestockRow[]>();

    rows.forEach(row => {
      const supplier = row.supplier || 'Non spécifié';
      if (!groups.has(supplier)) {
        groups.set(supplier, []);
      }
      groups.get(supplier)!.push(row);
    });

    return groups;
  });


  ngOnInit(): void {
    document.body.classList.add('fullscreen-active');
    this.loadData();
  }

  ngOnDestroy(): void {
    document.body.classList.remove('fullscreen-active');
  }

  loadData(): void {
    this.loading.set(true);

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
          prixUniteAchat: item.prixUniteAchat || 0,
          prixUniteVente: item.prixUniteVente || 0,
          uniteParCarton: item.uniteParCarton || 1,
          prixCarton: item.prixCarton || 0,
          nmbCarton: item.nmbCarton || 0,
          carry: item.carry ?? false,
          priority: item.priority || 0,
          hidden: item.hidden ?? false,
          synced: item.synced ?? false
        }));

        this.allRows.set(rows);
        this.loading.set(false);
        this.tableInitialized.set(true);
      },
      error: () => {
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
    row.prixCarton = row.prixUniteVente * row.uniteParCarton;
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
      prixUniteAchat: 0,
      prixUniteVente: 0,
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
      prixUniteAchat: row.prixUniteAchat,
      prixUniteVente: row.prixUniteVente,
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
    const headers = ['À Vendre', 'Sync', 'Produit', 'Marque', 'Catégorie', 'Fournisseur', 'Téléphone', 'Prix Achat', 'Prix Vente', 'Unité/Carton', 'Prix Carton', 'Nmb Carton', 'Total'];

    const csvContent = [
      headers.join(','),
      ...rows.map(row => [
        row.carry ? 'Oui' : 'Non',
        row.synced ? 'Oui' : 'Non',
        `"${row.name}"`,
        `"${row.brand}"`,
        `"${row.category}"`,
        `"${row.supplier}"`,
        `"${row.phone}"`,
        row.prixUniteAchat,
        row.prixUniteVente,
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
    return this.getColorForString(brand);
  }

  getCategoryColor(category: string): { bg: string; text: string } {
    return this.getColorForString(category + '_cat');
  }

  openInvoicePreview(): void {
    if (this.selectedCount() === 0) {
      this.toast.showWarn('Aucun produit sélectionné. Activez "À Vendre" pour les produits souhaités.');
      return;
    }
    this.showInvoiceDialog = true;
  }

  closeInvoiceDialog(): void {
    this.showInvoiceDialog = false;
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
            // Update the row's image URL
            const targetRow = this.allRows().find(r => r.id === response.restockId);
            if (targetRow) {
              // Store clean URL in data, use timestamp only for display
              targetRow.image = response.url;
              this.allRows.update(rows => [...rows]);
              // Use timestamp only for lightbox to bust cache
              this.lightboxImage.set(response.url + '?t=' + Date.now());
              this.markRowDirty(targetRow.id);
            }
            this.closeLightbox();
            // Bounce the image in the table
            this.bounceImage(response.restockId);
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

  downloadInvoicePDF(): void {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Bon de Commande', 14, 20);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Date: ${this.formatDate(this.invoiceDate.toISOString())}`, 14, 28);

      if (this.groupBySupplier()) {
        let yPosition = 40;
        const groups = this.rowsGroupedBySupplier();

        groups.forEach((rows, supplier) => {
          if (yPosition > 250) {
            doc.addPage();
            yPosition = 20;
          }

          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text(`Fournisseur: ${supplier}`, 14, yPosition);

          const phone = rows[0]?.phone;
          if (phone) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Tél: ${phone}`, 14, yPosition + 6);
            yPosition += 6;
          }

          yPosition += 10;

          const tableData = rows.map(row => [
            row.name,
            row.brand,
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
            theme: 'striped',
            headStyles: { fillColor: [59, 130, 246] },
            footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
            margin: { left: 14, right: 14 },
            styles: { fontSize: 9 },
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
        doc.text(`Total Général: ${this.formatNumber(this.selectedTotalValue())} DA`, pageWidth - 14, yPosition, { align: 'right' });
      } else {
        const tableData = this.selectedForInvoice().map(row => [
          row.name,
          row.brand,
          row.supplier || '-',
          row.nmbCarton.toString(),
          this.formatNumber(row.prixCarton),
          this.formatNumber(row.prixCarton * row.nmbCarton)
        ]);

        autoTable(doc, {
          startY: 40,
          head: [['Produit', 'Marque', 'Fournisseur', 'Qté', 'Prix/Carton', 'Total']],
          body: tableData,
          foot: [['', '', '', '', 'Total:', this.formatNumber(this.selectedTotalValue())]],
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246] },
          footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
          margin: { left: 14, right: 14 },
          styles: { fontSize: 9 }
        });
      }

      const fileName = `commande_${this.invoiceDate.toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      this.toast.showSuccess('PDF téléchargé avec succès');
    } catch {
      this.toast.showError('Erreur lors de la génération du PDF');
    }
  }

  private formatNumber(value: number): string {
    return value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  private formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  getSupplierTotal(rows: RestockRow[]): number {
    return rows.reduce((sum, r) => sum + (r.prixCarton * r.nmbCarton), 0);
  }
}
