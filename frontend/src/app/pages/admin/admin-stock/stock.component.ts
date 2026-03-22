import { Component, OnInit, OnDestroy, inject, signal, computed, DestroyRef, effect } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { catchError, of, finalize, forkJoin } from 'rxjs';
import { InputNumberModule } from 'primeng/inputnumber';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { PopoverModule } from 'primeng/popover';
import { DialogModule } from 'primeng/dialog';

import { ADMIN_LIST_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { TableSkeletonComponent, SkeletonColumn } from '../../../shared/components/table-skeleton/table-skeleton.component';
import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { TableLoadingRowsComponent, LoadingColumn } from '../../../shared/components/table-loading-rows/table-loading-rows.component';
import { InfiniteScrollDirective } from '../../../shared/directives/infinite-scroll.directive';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { ApiService } from '../../../services/api.service';

// Models
import { RestockRow, RestockData, BrandOption, CategoryOption } from '../../../models/restock.model';

// Services
import { PurchasingCartService } from '../../../services/purchasing-cart.service';
import { PurchasingPdfService } from '../../../services/purchasing-pdf.service';
import { RowFlashService } from '../../../services/row-flash.service';

// Utils
import {
  getBrandColor,
  getCategoryColor,
  getPriorityColor,
  getPriorityLabel,
  getPackageTypeColor,
  getUnitColor,
  getUnitLabel
} from '../../../shared/utils/color.utils';

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
    AgroclikPageContainerComponent,
    TableLoadingRowsComponent,
    InfiniteScrollDirective
  ],
  templateUrl: './stock.component.html',
  styleUrl: './stock.component.scss'
})
export class StockComponent implements OnInit, OnDestroy {
  private readonly ROWS_STORAGE_KEY = 'stock_rows_data';

  private api = inject(ApiService);
  private http = inject(HttpClient);
  private toast = inject(ToastMessageService);
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);

  // Injected services
  cartService = inject(PurchasingCartService);
  pdfService = inject(PurchasingPdfService);
  private rowFlash = inject(RowFlashService);

  // Component state
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
  syncDirtyRows = signal<Set<number>>(new Set());
  allRows = signal<RestockRow[]>([]);

  // Infinite scroll state
  private readonly PAGE_SIZE = 50;
  displayLimit = signal(50);
  loadingMore = signal(false);

  // Auto-save rows to localStorage when they change
  private rowsSaveEffect = effect(() => {
    const rows = this.allRows();
    if (rows.length > 0) {
      this.saveRowsToStorage();
      // Keep cart service in sync
      this.cartService.setAllRows(rows);
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

  currentView = signal<'active' | 'inactive'>('active');

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
    { label: 'Pièce', value: 'piece' },
    { label: 'Unité', value: 'unit' },
    { label: 'Portion', value: 'portion' },
    { label: 'Tranche', value: 'slice' },
    { label: 'Bouteille', value: 'bottle' },
    { label: 'Canette', value: 'can' },
    { label: 'Bocal', value: 'jar' },
    { label: 'Boîte', value: 'box' },
    { label: 'Sachet', value: 'sachet' },
    { label: 'Barquette', value: 'tray' },
    { label: 'Pot', value: 'pot' },
    { label: 'Tube', value: 'tube' },
    { label: 'Kg', value: 'kg' },
    { label: 'Gramme', value: 'g' },
    { label: 'Litre', value: 'L' },
    { label: 'Millilitre', value: 'ml' },
    { label: 'Centilitre', value: 'cl' },
    { label: 'Carton', value: 'carton' },
    { label: 'Caisse', value: 'crate' },
    { label: 'Pack', value: 'pack' },
    { label: 'Douzaine', value: 'dozen' },
    { label: 'Botte', value: 'bunch' },
    { label: 'Livre', value: 'pound' }
  ];

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
      const lowerCatFilter = catFilter.map(c => c.toLowerCase());
      rows = rows.filter(r => lowerCatFilter.includes(r.category.toLowerCase()));
    }

    if (brandFilter && brandFilter.length > 0) {
      const lowerBrandFilter = brandFilter.map(b => b.toLowerCase());
      rows = rows.filter(r => lowerBrandFilter.includes(r.brand.toLowerCase()));
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

  // Displayed rows for infinite scroll (sliced from filteredRows)
  displayedRows = computed(() => this.filteredRows().slice(0, this.displayLimit()));
  hasMore = computed(() => this.displayLimit() < this.filteredRows().length);

  totalCartons = computed(() => this.filteredRows().reduce((sum, r) => sum + (r.nmbCarton || 0), 0));
  totalValue = computed(() => this.filteredRows().reduce((sum, r) => sum + ((r.prixCarton || 0) * (r.nmbCarton || 0)), 0));

  categorySelectOptions = computed(() => {
    return this.categoriesList().map(c => ({ label: c.name, value: c.id }));
  });

  brandSelectOptions = computed(() => {
    return this.brandsList().map(b => ({ label: b.name, value: b.id }));
  });

  categoryFilterOptions = computed(() => {
    return this.categoriesList().map(c => ({ label: c.name, value: c.name }));
  });

  brandFilterOptions = computed(() => {
    return this.brandsList().map(b => ({ label: b.name, value: b.name }));
  });

  hiddenCount = computed(() => this.allRows().filter(r => r.hidden).length);
  activeCount = computed(() => this.allRows().filter(r => !r.hidden).length);

  // Expose color utilities as methods for template
  getBrandColor = getBrandColor;
  getCategoryColor = getCategoryColor;
  getPriorityColor = getPriorityColor;
  getPriorityLabel = getPriorityLabel;
  getPackageTypeColor = getPackageTypeColor;
  getUnitColor = getUnitColor;
  getUnitLabel = getUnitLabel;

  ngOnInit(): void {
    document.body.classList.add('fullscreen-active');
    this.loadData();

    // Check for draft editing query param
    this.route.queryParams.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(params => {
      const editDraftId = params['editDraft'];
      if (editDraftId) {
        // Wait for data to load, then load the draft
        const checkDataLoaded = setInterval(() => {
          if (!this.loading() && this.allRows().length > 0) {
            clearInterval(checkDataLoaded);
            this.cartService.loadDraftForEditing(parseInt(editDraftId, 10));
            this.currentTab.set('cart');
          }
        }, 100);

        // Timeout after 10 seconds
        setTimeout(() => clearInterval(checkDataLoaded), 10000);
      }
    });
  }

  ngOnDestroy(): void {
    document.body.classList.remove('fullscreen-active');
  }

  // Rows persistence methods
  private saveRowsToStorage(): void {
    const rows = this.allRows();
    localStorage.setItem(this.ROWS_STORAGE_KEY, JSON.stringify(rows));
  }

  loadData(): void {
    this.loading.set(true);

    // Clear localStorage to always fetch fresh data
    localStorage.removeItem(this.ROWS_STORAGE_KEY);

    forkJoin({
      restock: this.api.get<RestockData>('/restock').pipe(catchError(() => of({ items: [] }))),
      brands: this.api.get<BrandOption[]>('/brands?lang=fr').pipe(catchError(() => of([]))),
      categories: this.api.get<CategoryOption[]>('/categories?lang=fr').pipe(catchError(() => of([])))
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
        this.cartService.setAllRows(rows);

        this.loading.set(false);
        this.tableInitialized.set(true);
      },
      error: () => {
        this.toast.showError('Échec du chargement des données');
        this.loading.set(false);
      }
    });
  }

  // Filter methods
  onCategoryChange(value: string[] | null): void {
    this.categoryFilter.set(value ?? []);
    this.resetDisplayLimit();
  }

  onBrandChange(value: string[] | null): void {
    this.brandFilter.set(value ?? []);
    this.resetDisplayLimit();
  }

  onPriorityChange(value: number[] | null): void {
    this.priorityFilter.set(value ?? []);
    this.resetDisplayLimit();
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.categoryFilter.set([]);
    this.brandFilter.set([]);
    this.priorityFilter.set([]);
    this.resetDisplayLimit();
  }

  clearCategoryFilter(): void {
    this.categoryFilter.set([]);
    this.resetDisplayLimit();
  }

  clearBrandFilter(): void {
    this.brandFilter.set([]);
    this.resetDisplayLimit();
  }

  clearPriorityFilter(): void {
    this.priorityFilter.set([]);
    this.resetDisplayLimit();
  }

  // Infinite scroll methods
  loadMore(): void {
    if (this.loadingMore() || !this.hasMore()) return;

    this.loadingMore.set(true);

    // Simulate small delay for smooth UX
    setTimeout(() => {
      this.displayLimit.update(limit => limit + this.PAGE_SIZE);
      this.loadingMore.set(false);
    }, 200);
  }

  resetDisplayLimit(): void {
    this.displayLimit.set(this.PAGE_SIZE);
  }

  getLoadingColumns(): LoadingColumn[] {
    return [
      { type: 'pill-sm', visible: this.isColumnVisible('synced') },
      { type: 'pill-sm', visible: this.isColumnVisible('priority') },
      { type: 'image', visible: this.isColumnVisible('image') },
      { type: 'text', visible: this.isColumnVisible('name') },
      { type: 'pill', visible: this.isColumnVisible('brand') },
      { type: 'pill', visible: this.isColumnVisible('category') },
      { type: 'text-sm', visible: this.isColumnVisible('prixUniteAchat') },
      { type: 'text-sm', visible: this.isColumnVisible('uniteParCarton') },
      { type: 'text-sm', visible: this.isColumnVisible('prixCarton') },
      { type: 'text-sm', visible: this.isColumnVisible('nmbCarton') },
      { type: 'text-sm', visible: this.isColumnVisible('total') },
      { type: 'actions', visible: true }
    ];
  }

  hasActiveFilters(): boolean {
    const catFilter = this.categoryFilter();
    const brandFilter = this.brandFilter();
    const prioFilter = this.priorityFilter();
    return this.searchQuery().trim() !== '' || (catFilter?.length ?? 0) > 0 || (brandFilter?.length ?? 0) > 0 || (prioFilter?.length ?? 0) > 0;
  }

  // Image handling
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (!img.src.includes('product-placeholder')) {
      img.src = 'assets/images/product-placeholder.png';
    }
  }

  // Input helpers
  selectOnFocus(event: Event): void {
    const input = event.target as HTMLInputElement;
    input?.select();
  }

  // Row editing
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
      this.rowFlash.flashRow(row.id, 'error', `Manque: ${missing.join(', ')}`);
      return;
    }

    this.savingRow.set(row.id);

    const payload = {
      id: row.id > 0 ? row.id : null,
      productId: row.productId,
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

    this.api.post<{ success: boolean; id: number; productId?: number }>('/restock/item', payload).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        this.savingRow.set(null);
        const originalId = row.id;
        if (response.success) {
          this.clearRowDirty(originalId);
          this.rowFlash.flashRow(originalId, 'success', 'Enregistré');
          if (originalId < 0) {
            row.id = response.id;
            // Set productId if returned (auto-created product)
            if (response.productId) {
              row.productId = response.productId;
            }
            this.allRows.update(rows => [...rows]);
          }
        } else {
          this.rowFlash.flashRow(originalId, 'error', 'Échec sauvegarde');
        }
      },
      error: (err) => {
        this.savingRow.set(null);
        const errorMsg = this.extractErrorMessage(err);
        this.rowFlash.flashRow(row.id, 'error', errorMsg);
      }
    });
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
      this.rowFlash.flashRow(row.id, 'error', 'Nom et catégorie requis');
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
          this.syncDirtyRows.update(set => {
            const newSet = new Set(set);
            newSet.delete(row.id);
            return newSet;
          });
          this.allRows.update(rows => [...rows]);
          this.rowFlash.flashRow(row.id, 'success', 'Synchronisé');
        } else {
          this.rowFlash.flashRow(row.id, 'error', response.message || 'Échec sync');
        }
      },
      error: (err) => {
        this.syncingRow.set(null);
        const errorMsg = this.extractErrorMessage(err);
        this.rowFlash.flashRow(row.id, 'error', errorMsg);
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

  // Dirty tracking
  markRowDirty(rowId: number): void {
    this.dirtyRows.update(set => {
      const newSet = new Set(set);
      newSet.add(rowId);
      return newSet;
    });

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

  // Cell editing
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

  // CSV download
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

  // UI methods
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

  // Lightbox
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
      input.value = '';
    }
  }

  private uploadImage(file: File): void {
    const row = this.lightboxRow();
    if (!row) {
      this.toast.showError('Aucun produit sélectionné');
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.toast.showError('Veuillez sélectionner une image');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      this.toast.showError('L\'image est trop grande (max 10MB)');
      return;
    }

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
            const targetRow = this.allRows().find(r => r.id === response.restockId);
            if (targetRow) {
              const cacheBuster = '?t=' + Date.now();
              targetRow.image = response.url + cacheBuster;
              this.allRows.update(rows => {
                const filtered = rows.filter(r => r.id !== response.restockId);
                return [targetRow, ...filtered];
              });
              this.lightboxImage.set(response.url + cacheBuster);
              this.markRowDirty(targetRow.id);
            }
            this.closeLightbox();
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

  // PDF methods - delegate to service
  generateBonDeCommande(): void {
    const items = this.cartService.cartItems();
    const supplierKey = this.cartService.selectedSupplier() || items[0]?.supplier || 'Inconnu';
    const supplierDetails = this.cartService.getSupplierDetails(supplierKey);
    const orderRef = this.pdfService.generateTempReference();

    this.pdfService.generateBonDeCommande(items, supplierDetails, supplierKey, orderRef);
  }

  generateBonDeCommandeWithRef(reference: string): void {
    const items = this.cartService.cartItems();
    const supplierKey = this.cartService.selectedSupplier() || items[0]?.supplier || 'Inconnu';
    const supplierDetails = this.cartService.getSupplierDetails(supplierKey);

    this.pdfService.generateBonDeCommande(items, supplierDetails, supplierKey, reference);
  }

  downloadCartPDF(): void {
    this.pdfService.downloadCartPdf(
      this.cartService.cartGroupedBySupplier(),
      this.cartService.cartTotalValue(),
      (name) => this.cartService.getSupplierDetails(name)
    );
  }
}
