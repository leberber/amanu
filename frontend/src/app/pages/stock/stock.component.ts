import { Component, OnInit, OnDestroy, inject, signal, computed, DestroyRef } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { InputNumberModule } from 'primeng/inputnumber';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { PopoverModule } from 'primeng/popover';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { DialogModule } from 'primeng/dialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { ADMIN_LIST_IMPORTS } from '../../shared/imports/admin-shared.imports';
import { TableSkeletonComponent, SkeletonColumn } from '../../shared/components/table-skeleton/table-skeleton.component';
import { AgroclikPageContainerComponent } from '../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { ApiService } from '../../services/api.service';

interface StockItem {
  productId: number;
  image: string;
  category: string;
  brand: string;
  product: string;
  description: string;
  supplier: string;
  phone: string;
  prixUnite: number;
  uniteParCarton: number;
  prixCarton: number;
  nmbCarton: number;
  carry: boolean;
  priority: number;
  hidden: boolean;
}

interface StockData {
  items: StockItem[];
}

interface StockSaveResponse {
  success: boolean;
  message: string;
}

interface StockRow {
  productId: number;
  image: string;
  category: string;
  categoryId: number;
  brand: string;
  brandId: number;
  product: string;
  description: string;
  supplier: string;
  phone: string;
  prixUnite: number;
  uniteParCarton: number;
  prixCarton: number;
  nmbCarton: number;
  carry: boolean;
  priority: number;
  hidden: boolean;
}

@Component({
  selector: 'app-stock',
  standalone: true,
  imports: [
    ...ADMIN_LIST_IMPORTS,
    FormsModule,
    DecimalPipe,
    DatePipe,
    InputNumberModule,
    MultiSelectModule,
    SelectModule,
    PopoverModule,
    ToggleSwitchModule,
    DialogModule,
    TableSkeletonComponent,
    AgroclikPageContainerComponent
  ],
  templateUrl: './stock.component.html',
  styleUrl: './stock.component.scss'
})
export class StockComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private toast = inject(ToastMessageService);
  private destroyRef = inject(DestroyRef);

  // State
  loading = signal(true);
  saving = signal(false);
  savingRow = signal<number | null>(null);
  tableInitialized = signal(false);
  isFullscreen = signal(true);
  searchQuery = signal('');

  // Inline editing state: tracks which cell is being edited
  editingCell = signal<{ rowId: number; field: 'brand' | 'category' } | null>(null);

  // Invoice state
  showInvoiceDialog = false;
  groupBySupplier = signal(true);
  invoiceDate = new Date();

  // Lightbox state
  lightboxImage = signal<string | null>(null);

  // Data
  allRows = signal<StockRow[]>([]);

  // Filters (multi-select) - using names since stock_items is source of truth
  categoryFilter = signal<string[]>([]);
  brandFilter = signal<string[]>([]);
  priorityFilter = signal<number[]>([]);

  // Sorting
  sortField = signal<string>('product');
  sortOrder = signal<'asc' | 'desc'>('asc');

  // Priority options for dropdown
  priorityOptions = [
    { label: '-', value: 0 },
    { label: '1', value: 1 },
    { label: '2', value: 2 },
    { label: '3', value: 3 },
    { label: '4', value: 4 },
    { label: '5', value: 5 }
  ];

  // Page view state
  currentView = signal<'active' | 'inactive'>('active');

  // Column visibility options
  columnOptions = [
    { field: 'carry', label: 'À Vendre', visible: true },
    { field: 'priority', label: 'Priorité', visible: true },
    { field: 'image', label: 'Image', visible: true },
    { field: 'product', label: 'Produit', visible: true },
    { field: 'brand', label: 'Marque', visible: true },
    { field: 'category', label: 'Catégorie', visible: true },
    { field: 'supplier', label: 'Fournisseur', visible: false },
    { field: 'phone', label: 'Téléphone', visible: false },
    { field: 'description', label: 'Description', visible: false },
    { field: 'prixUnite', label: 'Prix Unité', visible: true },
    { field: 'uniteParCarton', label: 'Unité/Carton', visible: true },
    { field: 'prixCarton', label: 'Prix Carton', visible: true },
    { field: 'nmbCarton', label: 'Nmb Carton', visible: true },
    { field: 'total', label: 'Total', visible: true }
  ];

  // Skeleton configuration
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

  // Computed: filtered rows
  filteredRows = computed(() => {
    let rows = [...this.allRows()];
    const catFilter = this.categoryFilter();
    const brandFilter = this.brandFilter();
    const prioFilter = this.priorityFilter();

    // Filter based on current view (active or inactive)
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
        r.product.toLowerCase().includes(search) ||
        r.category.toLowerCase().includes(search) ||
        r.brand.toLowerCase().includes(search)
      );
    }

    // Apply sorting
    const field = this.sortField();
    const order = this.sortOrder();
    rows.sort((a, b) => {
      let compareA: string | number = '';
      let compareB: string | number = '';

      // Handle calculated 'total' field
      if (field === 'total') {
        compareA = a.prixCarton * a.nmbCarton;
        compareB = b.prixCarton * b.nmbCarton;
      } else {
        const valA = a[field as keyof StockRow];
        const valB = b[field as keyof StockRow];

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

  // Computed: totals
  totalCartons = computed(() => {
    return this.filteredRows().reduce((sum, r) => sum + (r.nmbCarton || 0), 0);
  });

  totalValue = computed(() => {
    return this.filteredRows().reduce((sum, r) => {
      return sum + ((r.prixCarton || 0) * (r.nmbCarton || 0));
    }, 0);
  });

  // Category options for dropdown (will be populated by sync mechanism later)
  categoryOptions = computed(() => {
    // Extract unique categories from stock rows
    const categories = new Map<string, string>();
    this.allRows().forEach(row => {
      if (row.category && row.category !== '-') {
        categories.set(row.category, row.category);
      }
    });
    return Array.from(categories.values()).map(name => ({ label: name, value: name }));
  });

  // Brand options for dropdown (will be populated by sync mechanism later)
  brandOptions = computed(() => {
    // Extract unique brands from stock rows
    const brands = new Map<string, string>();
    this.allRows().forEach(row => {
      if (row.brand && row.brand !== '-') {
        brands.set(row.brand, row.brand);
      }
    });
    return Array.from(brands.values()).map(name => ({ label: name, value: name }));
  });

  // Computed: rows selected for invoice (carry = true)
  selectedForInvoice = computed(() => {
    return this.allRows().filter(r => r.carry);
  });

  // Computed: selected rows count
  selectedCount = computed(() => {
    return this.selectedForInvoice().length;
  });

  // Computed: selected rows total value
  selectedTotalValue = computed(() => {
    return this.selectedForInvoice().reduce((sum, r) => sum + (r.prixCarton * r.nmbCarton), 0);
  });

  // Computed: hidden items count
  hiddenCount = computed(() => {
    return this.allRows().filter(r => r.hidden).length;
  });

  // Computed: active items count
  activeCount = computed(() => {
    return this.allRows().filter(r => !r.hidden).length;
  });

  // Computed: rows grouped by supplier
  rowsGroupedBySupplier = computed(() => {
    const rows = this.selectedForInvoice();
    const groups = new Map<string, StockRow[]>();

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
    // Set fullscreen mode on init
    document.body.classList.add('fullscreen-active');
    this.loadData();
  }

  ngOnDestroy(): void {
    // Clean up fullscreen class when leaving
    document.body.classList.remove('fullscreen-active');
  }

  loadData(): void {
    this.loading.set(true);

    // Load only from stock_items table - it's the source of truth
    this.api.get<StockData>('/stock').pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(() => of({ items: [] }))
    ).subscribe({
      next: (stockData) => {
        // Build rows directly from stock items
        const rows: StockRow[] = stockData.items.map(item => ({
          productId: item.productId,
          image: item.image,
          category: item.category || '-',
          categoryId: 0, // Not used when stock_items is source of truth
          brand: item.brand || '-',
          brandId: 0, // Not used when stock_items is source of truth
          product: item.product,
          description: item.description || '',
          supplier: item.supplier || '',
          phone: item.phone || '',
          prixUnite: item.prixUnite,
          uniteParCarton: item.uniteParCarton,
          prixCarton: item.prixCarton,
          nmbCarton: item.nmbCarton,
          carry: item.carry,
          priority: item.priority,
          hidden: item.hidden
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

  saveStock(): void {
    this.saving.set(true);

    const items: StockItem[] = this.allRows().map(row => ({
      productId: row.productId,
      image: row.image,
      category: row.category,
      brand: row.brand,
      product: row.product,
      description: row.description,
      supplier: row.supplier,
      phone: row.phone,
      prixUnite: row.prixUnite,
      uniteParCarton: row.uniteParCarton,
      prixCarton: row.prixCarton,
      nmbCarton: row.nmbCarton,
      carry: row.carry,
      priority: row.priority,
      hidden: row.hidden
    }));


    this.api.post<StockSaveResponse>('/stock', { items }).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.toast.showSuccess('Stock enregistré avec succès');
        } else {
          this.toast.showError('Échec de l\'enregistrement du stock');
        }
        this.saving.set(false);
      },
      error: (err) => {
        // Show full error trace for debugging
        let errorMessage = 'Échec de l\'enregistrement du stock';
        if (err.error?.detail) {
          errorMessage += ': ' + err.error.detail;
        } else if (err.message) {
          errorMessage += ': ' + err.message;
        }
        if (err.status) {
          errorMessage += ` (HTTP ${err.status})`;
        }
        this.toast.showError(errorMessage);
        console.error('Stock save error:', err);
        this.saving.set(false);
      }
    });
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

  // When Prix Unité changes, recalculate Prix Carton
  onPrixUniteChange(row: StockRow): void {
    row.prixCarton = row.prixUnite * row.uniteParCarton;
  }

  // When Unité/Carton changes, recalculate Prix Carton
  onUniteParCartonChange(row: StockRow): void {
    row.prixCarton = row.prixUnite * row.uniteParCarton;
  }

  // When Prix Carton changes, calculate Prix Unité (if Unité/Carton > 0)
  onPrixCartonChange(row: StockRow): void {
    if (row.uniteParCarton > 0) {
      row.prixUnite = Math.round((row.prixCarton / row.uniteParCarton) * 100) / 100;
    } else if (row.prixUnite > 0) {
      row.uniteParCarton = Math.round(row.prixCarton / row.prixUnite);
    }
  }

  // When Nmb Carton changes, auto-toggle carry switch
  onNmbCartonChange(row: StockRow): void {
    row.carry = row.nmbCarton > 0;
    // Trigger reactivity for computed properties
    this.allRows.update(rows => [...rows]);
  }

  // When carry toggle changes manually
  onCarryChange(): void {
    // Trigger reactivity for computed properties
    this.allRows.update(rows => [...rows]);
  }

  refresh(): void {
    this.loadData();
  }

  // Counter for new row IDs
  private newRowCounter = 0;

  addRow(): void {
    // Generate a new unique negative ID (within integer range)
    this.newRowCounter++;
    const newId = -this.newRowCounter;

    const newRow: StockRow = {
      productId: newId,
      image: '',
      category: '',
      categoryId: 0,
      brand: '',
      brandId: 0,
      product: '',
      description: '',
      supplier: '',
      phone: '',
      prixUnite: 0,
      uniteParCarton: 1,
      prixCarton: 0,
      nmbCarton: 0,
      carry: false,
      priority: 0,
      hidden: false
    };

    // Add to the beginning of the list
    this.allRows.update(rows => [newRow, ...rows]);
  }

  saveRow(row: StockRow): void {
    if (!row.product || !row.brand || !row.category) {
      this.toast.showWarn('Veuillez remplir le produit, la marque et la catégorie');
      return;
    }

    this.savingRow.set(row.productId);

    const item: StockItem = {
      productId: row.productId,
      image: row.image,
      category: row.category,
      brand: row.brand,
      product: row.product,
      description: row.description,
      supplier: row.supplier,
      phone: row.phone,
      prixUnite: row.prixUnite,
      uniteParCarton: row.uniteParCarton,
      prixCarton: row.prixCarton,
      nmbCarton: row.nmbCarton,
      carry: row.carry,
      priority: row.priority,
      hidden: row.hidden
    };

    this.api.post<{ success: boolean; productId: number }>('/stock/item', item).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        if (response.success) {
          // Update the row with the new productId from the database
          row.productId = response.productId;
          this.allRows.update(rows => [...rows]);
          this.toast.showSuccess('Produit enregistré');
        }
        this.savingRow.set(null);
      },
      error: (err) => {
        let errorMessage = 'Échec de l\'enregistrement';
        if (err.error?.detail) {
          errorMessage += ': ' + err.error.detail;
        }
        this.toast.showError(errorMessage);
        this.savingRow.set(null);
      }
    });
  }

  deleteRow(row: StockRow): void {
    if (this.isNewRow(row)) {
      // Just remove from UI for new rows
      this.allRows.update(rows => rows.filter(r => r.productId !== row.productId));
      this.toast.showSuccess('Produit supprimé');
    } else {
      // Delete from database for existing rows
      this.api.delete<{ success: boolean }>(`/stock/item/${row.productId}`).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: () => {
          this.allRows.update(rows => rows.filter(r => r.productId !== row.productId));
          this.toast.showSuccess('Produit supprimé');
        },
        error: (err) => {
          console.error('Delete error:', err);
          let errorMessage = 'Échec de la suppression';
          if (err.error?.detail) {
            errorMessage += ': ' + err.error.detail;
          } else if (err.status) {
            errorMessage += ` (HTTP ${err.status})`;
          }
          this.toast.showError(errorMessage);
        }
      });
    }
  }

  hideRow(row: StockRow): void {
    row.hidden = true;
    this.allRows.update(rows => [...rows]);
  }

  activateRow(row: StockRow): void {
    row.hidden = false;
    this.allRows.update(rows => [...rows]);
  }

  isNewRow(row: StockRow): boolean {
    return row.productId < 0;
  }

  startEditing(rowId: number, field: 'brand' | 'category'): void {
    this.editingCell.set({ rowId, field });
  }

  stopEditing(): void {
    this.editingCell.set(null);
  }

  isEditing(rowId: number, field: 'brand' | 'category'): boolean {
    const editing = this.editingCell();
    return editing !== null && editing.rowId === rowId && editing.field === field;
  }

  onBrandSelect(row: StockRow, brandName: string): void {
    row.brand = brandName;
    if (this.isNewRow(row)) {
      row.image = this.generateImageUrl(row);
    }
    this.stopEditing();
  }

  onCategorySelect(row: StockRow, categoryName: string): void {
    row.category = categoryName;
    if (this.isNewRow(row)) {
      row.image = this.generateImageUrl(row);
    }
    this.stopEditing();
  }

  onProductNameChange(row: StockRow, newName: string): void {
    // Find the row in allRows and update it directly
    const allRows = this.allRows();
    const targetRow = allRows.find(r => r.productId === row.productId);
    if (targetRow) {
      targetRow.product = newName;
      // Auto-generate image URL for new rows
      if (this.isNewRow(row)) {
        targetRow.image = this.generateImageUrl(targetRow);
      }
    }
  }

  generateImageUrl(row: StockRow): string {
    if (!row.brand || !row.category || !row.product) {
      return '';
    }

    const slugify = (str: string): string => {
      return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
        .replace(/^-+|-+$/g, ''); // Trim hyphens
    };

    const brand = slugify(row.brand);
    const category = slugify(row.category);
    const product = slugify(row.product);

    return `https://agroclik.s3.eu-west-3.amazonaws.com/products/${brand}/${brand}_${category}_${product}.webp`;
  }

  downloadStock(): void {
    const rows = this.filteredRows();
    const headers = ['À Vendre', 'Produit', 'Marque', 'Catégorie', 'Fournisseur', 'Téléphone', 'Prix Unité', 'Unité/Carton', 'Prix Carton', 'Nmb Carton', 'Total'];

    const csvContent = [
      headers.join(','),
      ...rows.map(row => [
        row.carry ? 'Oui' : 'Non',
        `"${row.product}"`,
        `"${row.brand}"`,
        `"${row.category}"`,
        `"${row.supplier}"`,
        `"${row.phone}"`,
        row.prixUnite,
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
    link.setAttribute('download', `stock_${new Date().toISOString().split('T')[0]}.csv`);
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

  // Color palette for dynamic coloring
  private colorPalette = [
    // Blues
    { bg: 'rgba(59, 130, 246, 0.12)', text: '#3b82f6' },
    { bg: 'rgba(37, 99, 235, 0.12)', text: '#2563eb' },
    { bg: 'rgba(29, 78, 216, 0.12)', text: '#1d4ed8' },
    { bg: 'rgba(96, 165, 250, 0.12)', text: '#3b82f6' },
    // Purples
    { bg: 'rgba(139, 92, 246, 0.12)', text: '#8b5cf6' },
    { bg: 'rgba(124, 58, 237, 0.12)', text: '#7c3aed' },
    { bg: 'rgba(167, 139, 250, 0.12)', text: '#7c3aed' },
    { bg: 'rgba(192, 132, 252, 0.12)', text: '#9333ea' },
    // Indigos
    { bg: 'rgba(99, 102, 241, 0.12)', text: '#6366f1' },
    { bg: 'rgba(79, 70, 229, 0.12)', text: '#4f46e5' },
    { bg: 'rgba(129, 140, 248, 0.12)', text: '#4f46e5' },
    // Greens
    { bg: 'rgba(16, 185, 129, 0.12)', text: '#10b981' },
    { bg: 'rgba(34, 197, 94, 0.12)', text: '#22c55e' },
    { bg: 'rgba(5, 150, 105, 0.12)', text: '#059669' },
    { bg: 'rgba(20, 184, 166, 0.12)', text: '#14b8a6' },
    { bg: 'rgba(13, 148, 136, 0.12)', text: '#0d9488' },
    // Limes
    { bg: 'rgba(132, 204, 22, 0.12)', text: '#65a30d' },
    { bg: 'rgba(163, 230, 53, 0.12)', text: '#65a30d' },
    // Cyans
    { bg: 'rgba(6, 182, 212, 0.12)', text: '#06b6d4' },
    { bg: 'rgba(8, 145, 178, 0.12)', text: '#0891b2' },
    { bg: 'rgba(34, 211, 238, 0.12)', text: '#06b6d4' },
    // Yellows/Ambers
    { bg: 'rgba(245, 158, 11, 0.12)', text: '#d97706' },
    { bg: 'rgba(217, 119, 6, 0.12)', text: '#b45309' },
    { bg: 'rgba(251, 191, 36, 0.12)', text: '#d97706' },
    { bg: 'rgba(234, 179, 8, 0.12)', text: '#ca8a04' },
    // Oranges
    { bg: 'rgba(249, 115, 22, 0.12)', text: '#ea580c' },
    { bg: 'rgba(234, 88, 12, 0.12)', text: '#c2410c' },
    { bg: 'rgba(251, 146, 60, 0.12)', text: '#ea580c' },
    // Reds
    { bg: 'rgba(239, 68, 68, 0.12)', text: '#dc2626' },
    { bg: 'rgba(220, 38, 38, 0.12)', text: '#b91c1c' },
    { bg: 'rgba(248, 113, 113, 0.12)', text: '#dc2626' },
    // Pinks
    { bg: 'rgba(236, 72, 153, 0.12)', text: '#db2777' },
    { bg: 'rgba(219, 39, 119, 0.12)', text: '#be185d' },
    { bg: 'rgba(244, 114, 182, 0.12)', text: '#db2777' },
    // Roses
    { bg: 'rgba(244, 63, 94, 0.12)', text: '#e11d48' },
    { bg: 'rgba(225, 29, 72, 0.12)', text: '#be123c' },
    { bg: 'rgba(251, 113, 133, 0.12)', text: '#e11d48' },
    // Fuchsias
    { bg: 'rgba(217, 70, 239, 0.12)', text: '#c026d3' },
    { bg: 'rgba(192, 38, 211, 0.12)', text: '#a21caf' },
    // Slates
    { bg: 'rgba(100, 116, 139, 0.12)', text: '#475569' },
    { bg: 'rgba(71, 85, 105, 0.12)', text: '#334155' },
    // Additional variations
    { bg: 'rgba(14, 165, 233, 0.12)', text: '#0284c7' },
    { bg: 'rgba(2, 132, 199, 0.12)', text: '#0369a1' },
    { bg: 'rgba(168, 85, 247, 0.12)', text: '#9333ea' },
    { bg: 'rgba(74, 222, 128, 0.12)', text: '#16a34a' },
    { bg: 'rgba(45, 212, 191, 0.12)', text: '#0d9488' },
    { bg: 'rgba(253, 186, 116, 0.12)', text: '#ea580c' },
    { bg: 'rgba(252, 165, 165, 0.12)', text: '#dc2626' },
    { bg: 'rgba(196, 181, 253, 0.12)', text: '#7c3aed' },
  ];

  // Generate consistent color based on string value
  private getColorForString(value: string): { bg: string; text: string } {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = value.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % this.colorPalette.length;
    return this.colorPalette[index];
  }

  getBrandColor(brand: string): { bg: string; text: string } {
    return this.getColorForString(brand);
  }

  getCategoryColor(category: string): { bg: string; text: string } {
    // Use a different offset to ensure categories get different colors than brands with same name
    return this.getColorForString(category + '_cat');
  }

  openInvoicePreview(): void {
    if (this.selectedCount() === 0) {
      this.toast.showWarn('Aucun produit sélectionné. Activez "À Vendre" pour les produits souhaités.');
      return;
    }
    this.showInvoiceDialog = true;
  }

  // Close invoice dialog
  closeInvoiceDialog(): void {
    this.showInvoiceDialog = false;
  }

  // Toggle group by supplier
  toggleGroupBySupplier(): void {
    this.groupBySupplier.update(v => !v);
  }

  // Open lightbox for image
  openLightbox(imageUrl: string): void {
    if (imageUrl && !imageUrl.includes('placeholder')) {
      this.lightboxImage.set(imageUrl);
    }
  }

  // Close lightbox
  closeLightbox(): void {
    this.lightboxImage.set(null);
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
            row.product,
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
          row.product,
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

  // Helper: format number
  private formatNumber(value: number): string {
    return value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  // Helper: format date
  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // Get supplier total for invoice preview
  getSupplierTotal(rows: StockRow[]): number {
    return rows.reduce((sum, r) => sum + (r.prixCarton * r.nmbCarton), 0);
  }
}
