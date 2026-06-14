import { Component, OnInit, inject, DestroyRef, signal, computed } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { finalize, concat, last, Subject, switchMap, debounceTime, distinctUntilChanged, of } from 'rxjs';

import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { TableSearchComponent } from '../../../shared/components/table-search/table-search.component';
import { AdminService } from '../../../services/admin.service';
import { ProductService } from '../../../services/product.service';
import { Order, OrderItem, OrderPayment, OrderAuditLog, UserManage } from '../../../models/admin.model';
import { Product, AdminProductFilter } from '../../../models/product.model';
import { Category } from '../../../models/category.model';
import { Brand } from '../../../models/brand.model';
import { BrandService } from '../../../core/services/brand.service';
import { DriverProfileWithFlags } from '../../../models/driver.model';
import { StatusSeverityService } from '../../../core/services/status-severity.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { CurrencyDisplayComponent } from '../../../shared/components/currency-display/currency-display.component';
import { PhoneFormatPipe } from '../../../shared/pipes/phone-format.pipe';
import { UnitPipe } from '../../../shared/pipes/unit.pipe';
import { DateFormatPipe } from '../../../shared/pipes/date-format.pipe';
import { DateService } from '../../../core/services/date.service';
import { OrderPdfService } from '../../../services/order-pdf.service';
import { PackagingTypeService } from '../../../core/services/packaging-type.service';
import { DRIVER_STATUS } from '../../../core/constants/driver.constants';
import { ORDER_STATUS } from '../../../core/constants/order.constants';

@Component({
  selector: 'app-admin-order-detail',
  standalone: true,
  animations: [
    trigger('pageAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(12px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ],
  imports: [
    CommonModule,
    FormsModule,
    ToastModule,
    TranslateModule,
    SelectModule,
    TooltipModule,
    InputNumberModule,
    TagModule,
    ButtonModule,
    AutoCompleteModule,
    TextareaModule,
    PageLayoutComponent,
    TableSearchComponent,
    CurrencyDisplayComponent,
    PhoneFormatPipe,
    UnitPipe,
    DateFormatPipe
  ],
  templateUrl: './admin-order-detail.component.html',
  styleUrl: './admin-order-detail.component.scss'
})
export class AdminOrderDetailComponent implements OnInit {
  // Services
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly adminService = inject(AdminService);
  private readonly productService = inject(ProductService);
  private readonly translateService = inject(TranslateService);
  private readonly statusSeverity = inject(StatusSeverityService);
  private readonly toast = inject(ToastMessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dateService = inject(DateService);
  private readonly orderPdf = inject(OrderPdfService);
  private readonly packagingTypeService = inject(PackagingTypeService);
  private readonly brandService = inject(BrandService);

  // Route constant for back navigation
  readonly ROUTES = ROUTES;

  // State signals
  order = signal<Order | null>(null);
  loading = signal(true);
  selectedNewStatus = signal<string | null>(null);

  // Driver assignment state
  availableDrivers = signal<DriverProfileWithFlags[]>([]);
  loadingDrivers = signal(false);
  assigning = signal(false);

  // Payment state
  payments = signal<OrderPayment[]>([]);
  paymentLoading = signal(false);
  totalPaid = signal(0);
  savingPayment = signal(false);
  newPaymentAmount = signal<number | null>(null);
  newPaymentMethod = signal<string>('cash');
  newPaymentNote = signal('');

  // Item editing state — local edits, not committed until saveEdits()
  pendingEdits = signal<Map<number, { quantity: number; originalQty: number; deleted: boolean }>>(new Map());
  pendingNewItems = signal<{ product: Product; qty: number; customPrice?: number | null }[]>([]);
  pendingPrices = signal<Map<number, number | null>>(new Map());
  savingEdits = signal(false);
  showAddItem = signal(false);

  editingQtyItemId = signal<number | null>(null);
  editingQtyNewIndex = signal<number | null>(null);
  editingPriceItemId = signal<number | null>(null);

  pendingProductIds = computed(() => new Set(this.pendingNewItems().map(i => i.product.id)));

  // Product picker (inline expandable)
  pickerCategories = signal<Category[]>([]);
  pickerBrands = signal<Brand[]>([]);
  pickerProducts = signal<Product[]>([]);
  pickerLoading = signal(false);
  pickerSearch = signal('');
  pickerCategoryId = signal<number | null>(null);
  pickerBrandId = signal<number | null>(null);
  private pickerFilterChange$ = new Subject<void>();

  pickerCategoryOptions = computed(() =>
    this.pickerCategories().map(c => ({ label: c.name, value: c.id }))
  );
  pickerBrandOptions = computed(() =>
    this.pickerBrands().map(b => ({ label: b.name, value: b.id }))
  );

  // Sidebar tab
  activeTab = signal<'info' | 'history'>('info');

  // Create mode
  isCreateMode = signal(false);
  createCustomer = signal<UserManage | null>(null);
  createDeliveryType = signal<'pickup' | 'delivery'>('pickup');
  customerSearchResults = signal<UserManage[]>([]);
  customerSearchLoading = signal(false);
  creatingOrder = signal(false);
  selectedCustomer: UserManage | null = null;
  private customerSearch$ = new Subject<string>();

  // Audit log state
  auditLogs = signal<OrderAuditLog[]>([]);
  auditLoading = signal(false);

  // Payment method options
  readonly paymentMethodOptions = [
    { label: 'Espèces', value: 'cash' },
    { label: 'Virement', value: 'virement' },
    { label: 'Chèque', value: 'cheque' }
  ];

  // Computed values
  pageTitle = computed(() => {
    if (this.isCreateMode()) return 'Nouvelle commande';
    const order = this.order();
    return order ? `${this.translateService.instant('admin.orders.order_number')} #${order.id}` : '';
  });

  pageSubtitle = computed(() => {
    if (this.isCreateMode()) return '';
    const order = this.order();
    return order ? this.dateService.formatDate(order.created_at) : '';
  });

  // Driver options for dropdown
  driverOptions = computed(() => {
    return this.availableDrivers()
      .filter(d => d.status !== DRIVER_STATUS.SUSPENDED && d.is_available)
      .map(d => ({
        label: d.full_name
          ? `${d.full_name} (${this.translateService.instant('driver.vehicle.' + d.vehicle_type)}) - ${d.active_orders_count}/${d.max_active_orders}`
          : `${this.translateService.instant('driver.vehicle.' + d.vehicle_type)} - ${d.active_orders_count}/${d.max_active_orders}`,
        value: d.user_id,
        driver: d
      }));
  });

  // Check if this is a pickup order
  isPickupOrder = computed(() => {
    const order = this.order();
    return order?.delivery_type?.toLowerCase() === 'pickup';
  });

  // Check if driver selection is required (when "assigned" status is selected, delivery only)
  needsDriverSelection = computed(() => this.selectedNewStatus() === ORDER_STATUS.ASSIGNED && !this.isPickupOrder());

  // Selected driver for status change flow
  selectedStatusDriverId = signal<number | null>(null);

  // Item editing only allowed for pending/confirmed (always true in create mode)
  canEditItems = computed(() => {
    if (this.isCreateMode()) return true;
    const s = this.order()?.status;
    return s === 'pending' || s === 'confirmed';
  });

  // Payment balance
  balance = computed(() => {
    const total = this.order()?.total_amount ?? 0;
    return total - this.totalPaid();
  });

  paymentStatusSeverity = computed(() => {
    const s = this.order()?.payment_status ?? 'unpaid';
    if (s === 'paid') return 'success';
    if (s === 'partial') return 'warn';
    return 'danger';
  });

  hasUnsavedChanges = computed(() => this.pendingEdits().size > 0 || this.pendingNewItems().length > 0 || this.pendingPrices().size > 0);

  previewGrossTotal = computed(() => {
    const newGross = this.pendingNewItems().reduce(
      (sum, { product, qty }) => sum + product.price * qty * (product.pieces_per_box || 1), 0
    );
    if (this.isCreateMode()) return newGross;
    const order = this.order();
    if (!order?.items) return newGross;
    const edits = this.pendingEdits();
    const existingGross = order.items.reduce((sum, item) => {
      const edit = edits.get(item.id);
      if (edit?.deleted) return sum;
      const qty = edit?.quantity ?? item.quantity;
      return sum + qty * item.unit_price;
    }, 0);
    return existingGross + newGross;
  });

  previewDiscount = computed(() => Math.max(0, Math.round((this.previewGrossTotal() - this.previewTotal()) * 100) / 100));

  previewTotal = computed(() => {
    const newItemsTotal = this.pendingNewItems().reduce(
      (sum, { product, qty, customPrice }) => sum + (customPrice ?? product.price) * qty * (product.pieces_per_box || 1), 0
    );
    if (this.isCreateMode()) return newItemsTotal;

    const order = this.order();
    if (!order?.items) return order?.total_amount ?? 0;
    const edits = this.pendingEdits();
    const prices = this.pendingPrices();

    const existingTotal = order.items.reduce((sum, item) => {
      const edit = edits.get(item.id);
      if (edit?.deleted) return sum;
      const qty = edit?.quantity ?? item.quantity;
      const price = prices.get(item.id) ?? item.custom_unit_price ?? item.unit_price;
      return sum + qty * price;
    }, 0);

    return existingTotal + newItemsTotal;
  });

  ngOnInit(): void {
    const isCreate = !!this.route.snapshot.data['createMode'];
    const id = this.route.snapshot.paramMap.get('id');

    if (isCreate) {
      this.isCreateMode.set(true);
      this.loading.set(false);
    } else if (id) {
      this.loadOrder(+id);
      this.loadAvailableDrivers();
    } else {
      this.router.navigate([ROUTES.ADMIN.ORDERS]);
    }

    this.pickerFilterChange$.pipe(
      debounceTime(250),
      switchMap(() => {
        this.pickerLoading.set(true);
        const filters: AdminProductFilter = {
          skip: 0, limit: 40, status_filter: 'active'
        };
        if (this.pickerSearch()) filters.search = this.pickerSearch();
        if (this.pickerCategoryId()) filters.category_id = this.pickerCategoryId()!;
        if (this.pickerBrandId()) filters.brand_id = this.pickerBrandId()!;
        return this.productService.getProductsPaginated(filters);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => { this.pickerProducts.set(res.items ?? []); this.pickerLoading.set(false); },
      error: () => this.pickerLoading.set(false)
    });

    this.customerSearch$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (!query.trim()) return of({ users: [] as UserManage[], total: 0 });
        this.customerSearchLoading.set(true);
        return this.adminService.searchUsers(query, 10);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.customerSearchResults.set(res.users ?? []);
        this.customerSearchLoading.set(false);
      },
      error: () => this.customerSearchLoading.set(false)
    });

    // Auto-load products when entering create mode
    if (isCreate) {
      this.loadPickerMeta();
      this.pickerFilterChange$.next();
    }
  }

  private loadOrder(id: number): void {
    this.loading.set(true);
    this.adminService.getOrderById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (order) => {
          this.order.set(order);
          this.loading.set(false);
          this.loadPayments(id);
          this.loadAuditLog(id);
        },
        error: (error) => {
          this.loading.set(false);
          if (error.status === 404) {
            this.toast.showError('admin.orders.order_not_found');
          } else if (error.status === 403) {
            this.toast.showPermissionDenied();
          } else {
            this.toast.showApiError(error, 'admin.orders.load_error');
          }
          this.router.navigate([ROUTES.ADMIN.ORDERS]);
        }
      });
  }

  // ─── Payments ────────────────────────────────────────────────────────────────

  loadPayments(orderId: number): void {
    this.paymentLoading.set(true);
    this.adminService.getOrderPayments(orderId)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.paymentLoading.set(false)))
      .subscribe({
        next: (res) => {
          this.payments.set(res.payments);
          this.totalPaid.set(res.total_paid);
          if (this.order()) {
            this.order.update(o => o ? { ...o, payment_status: res.payment_status } : o);
          }
        },
        error: () => {}
      });
  }

  recordPayment(): void {
    const order = this.order();
    const amount = this.newPaymentAmount();
    if (!order || !amount || amount === 0) return;

    this.savingPayment.set(true);
    this.adminService.recordPayment(order.id, {
      amount,
      method: this.newPaymentMethod(),
      note: this.newPaymentNote() || undefined
    }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.savingPayment.set(false)))
      .subscribe({
        next: () => {
          this.newPaymentAmount.set(null);
          this.newPaymentNote.set('');
          this.loadPayments(order.id);
          this.loadAuditLog(order.id);
          this.toast.showSuccess(amount > 0 ? 'Paiement enregistré' : 'Remboursement enregistré');
        },
        error: () => this.toast.showError('Erreur lors de l\'enregistrement')
      });
  }

  getPaymentMethodLabel(method: string): string {
    return this.paymentMethodOptions.find(o => o.value === method)?.label ?? method;
  }

  getPaymentMethodIcon(method: string): string {
    const icons: Record<string, string> = { cash: 'pi-money-bill', virement: 'pi-building-columns', cheque: 'pi-file' };
    return 'pi ' + (icons[method] ?? 'pi-circle');
  }

  // ─── Item Editing (local-first, commit on save) ───────────────────────────────

  getEffectiveQty(item: OrderItem): number {
    return this.pendingEdits().get(item.id)?.quantity ?? item.quantity;
  }

  getEffectiveItemPrice(item: OrderItem): number {
    return this.pendingPrices().get(item.id) ?? item.custom_unit_price ?? item.unit_price;
  }

  startEditingExistingQty(event: Event, itemId: number): void {
    if (!this.canEditItems()) return;
    this.editingPriceItemId.set(null);
    this.editingQtyNewIndex.set(null);
    this.editingQtyItemId.set(itemId);
    setTimeout(() => {
      const container = (event.target as HTMLElement).closest('.item-row__qty');
      (container?.querySelector('.qty-inline-input') as HTMLInputElement)?.select();
    });
  }

  commitExistingQty(item: OrderItem, cartonsStr: string): void {
    const cartons = parseInt(cartonsStr, 10);
    if (!isNaN(cartons) && cartons >= 1) {
      const newQty = cartons * (item.pieces_per_box || 1);
      this.pendingEdits.update(map => {
        const next = new Map(map);
        const existing = next.get(item.id);
        next.set(item.id, { quantity: newQty, originalQty: existing?.originalQty ?? item.quantity, deleted: false });
        return next;
      });
    }
  }

  startEditingNewQty(event: Event, index: number): void {
    this.editingQtyItemId.set(null);
    this.editingPriceItemId.set(null);
    this.editingQtyNewIndex.set(index);
    setTimeout(() => {
      const container = (event.target as HTMLElement).closest('.item-row__qty');
      (container?.querySelector('.qty-inline-input') as HTMLInputElement)?.select();
    });
  }

  commitNewQty(index: number, qtyStr: string): void {
    const qty = parseInt(qtyStr, 10);
    if (!isNaN(qty) && qty >= 1) {
      this.pendingNewItems.update(items =>
        items.map((item, i) => i === index ? { ...item, qty } : item)
      );
    }
  }

  startEditingPrice(event: Event, itemId: number): void {
    if (!this.canEditItems()) return;
    this.editingQtyItemId.set(null);
    this.editingQtyNewIndex.set(null);
    this.editingPriceItemId.set(itemId);
    setTimeout(() => {
      const container = (event.target as HTMLElement).closest('.item-row__price');
      const input = container?.querySelector('.price-override-input') as HTMLInputElement;
      input?.focus();
      input?.select();
    });
  }

  setExistingItemPrice(itemId: number, priceStr: string): void {
    const parsed = parseFloat(priceStr);
    const price = isNaN(parsed) || parsed <= 0 ? null : parsed;
    this.pendingPrices.update(map => {
      const next = new Map(map);
      if (price === null) next.delete(itemId);
      else next.set(itemId, price);
      return next;
    });
  }

  getEditedCartonCount(item: OrderItem): number {
    return Math.floor(this.getEffectiveQty(item) / (item.pieces_per_box || 1));
  }

  isItemDeleted(itemId: number): boolean {
    return this.pendingEdits().get(itemId)?.deleted ?? false;
  }

  isItemModified(itemId: number): boolean {
    const edit = this.pendingEdits().get(itemId);
    return !!edit && !edit.deleted && edit.quantity !== edit.originalQty;
  }

  changeItemQty(itemId: number, currentQty: number, delta: number): void {
    const newQty = currentQty + delta;
    if (newQty <= 0) return;
    this.pendingEdits.update(map => {
      const next = new Map(map);
      const existing = next.get(itemId);
      next.set(itemId, { quantity: newQty, originalQty: existing?.originalQty ?? currentQty, deleted: false });
      return next;
    });
  }

  removeItem(itemId: number): void {
    const item = this.order()?.items?.find(i => i.id === itemId);
    if (!item) return;
    this.pendingEdits.update(map => {
      const next = new Map(map);
      const existing = next.get(itemId);
      next.set(itemId, { quantity: existing?.quantity ?? item.quantity, originalQty: existing?.originalQty ?? item.quantity, deleted: true });
      return next;
    });
  }

  restoreItem(itemId: number): void {
    this.pendingEdits.update(map => {
      const next = new Map(map);
      next.delete(itemId);
      return next;
    });
  }

  cancelEdits(): void {
    this.pendingEdits.set(new Map());
    this.pendingNewItems.set([]);
    this.pendingPrices.set(new Map());
  }

  saveEdits(): void {
    const order = this.order();
    if (!order) return;

    const edits = this.pendingEdits();
    const newItems = this.pendingNewItems();
    const prices = this.pendingPrices();

    const editOps = [...edits.entries()]
      .filter(([, e]) => e.deleted || e.quantity !== e.originalQty)
      .map(([itemId, e]) =>
        e.deleted
          ? this.adminService.removeOrderItem(order.id, itemId)
          : this.adminService.updateOrderItemQty(order.id, itemId, e.quantity)
      );

    const priceOps = [...prices.entries()].map(([itemId, price]) =>
      this.adminService.updateOrderItemPrice(order.id, itemId, price)
    );

    const addOps = newItems.map(({ product, qty, customPrice }) =>
      this.adminService.addOrderItem(order.id, {
        product_id: product.id,
        quantity: qty * (product.pieces_per_box || 1),
        ...(customPrice ? { custom_unit_price: customPrice } : {})
      })
    );

    const ops = [...editOps, ...priceOps, ...addOps];
    if (ops.length === 0) { this.pendingEdits.set(new Map()); this.pendingNewItems.set([]); return; }

    this.savingEdits.set(true);
    concat(...ops).pipe(
      last(),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.savingEdits.set(false))
    ).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.pendingEdits.set(new Map());
        this.pendingNewItems.set([]);
        this.pendingPrices.set(new Map());
        this.loadAuditLog(order.id);
        this.toast.showSuccess('Modifications enregistrées');
      },
      error: (err) => this.toast.showError(err?.error?.detail ?? 'Erreur lors de la sauvegarde')
    });
  }

  getProductStockLabel(product: Product): string {
    const ppb = product.pieces_per_box || 1;
    if (ppb > 1) {
      const cartons = Math.floor(product.stock_quantity / ppb);
      return `${cartons} ${product.packaging_type?.toLowerCase() || 'carton'}(s)`;
    }
    return `${product.stock_quantity}`;
  }

  toggleAddItem(): void {
    this.showAddItem.update(v => !v);
    if (this.showAddItem()) {
      if (this.pickerCategories().length === 0) { this.loadPickerMeta(); }
      this.pickerFilterChange$.next();
    } else {
      this.pickerSearch.set('');
      this.pickerCategoryId.set(null);
      this.pickerBrandId.set(null);
      this.pickerProducts.set([]);
    }
  }

  private loadPickerMeta(): void {
    this.productService.getCategories(true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(cats => this.pickerCategories.set(cats));
    this.brandService.getBrands(true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(brands => this.pickerBrands.set(brands));
  }

  selectPickerProduct(product: Product): void {
    const idx = this.pendingNewItems().findIndex(i => i.product.id === product.id);
    if (idx >= 0) {
      this.pendingNewItems.update(items =>
        items.map((item, i) => i === idx ? { ...item, qty: item.qty + 1 } : item)
      );
    } else {
      this.pendingNewItems.update(items => [...items, { product, qty: 1 }]);
    }
  }

  incrementNewItem(index: number): void {
    this.pendingNewItems.update(items =>
      items.map((item, i) => i === index ? { ...item, qty: item.qty + 1 } : item)
    );
  }

  decrementNewItem(index: number): void {
    const item = this.pendingNewItems()[index];
    if (!item) return;
    if (item.qty <= 1) {
      this.removePendingNew(index);
    } else {
      this.pendingNewItems.update(items =>
        items.map((it, i) => i === index ? { ...it, qty: it.qty - 1 } : it)
      );
    }
  }

  setNewItemQty(index: number, qty: number): void {
    if (isNaN(qty) || qty <= 0) { this.removePendingNew(index); return; }
    this.pendingNewItems.update(items =>
      items.map((item, i) => i === index ? { ...item, qty } : item)
    );
  }

  setNewItemCustomPrice(index: number, price: string): void {
    const parsed = parseFloat(price);
    const customPrice = isNaN(parsed) || parsed <= 0 ? null : parsed;
    this.pendingNewItems.update(items =>
      items.map((item, i) => i === index ? { ...item, customPrice } : item)
    );
  }

  onPickerSearchChange(value: string): void {
    this.pickerSearch.set(value);
    this.pickerFilterChange$.next();
  }

  triggerPickerFilter(): void {
    this.pickerFilterChange$.next();
  }

  onPickerCategoryChange(id: number | null): void {
    this.pickerCategoryId.set(id ?? null);
    this.pickerFilterChange$.next();
  }

  onPickerBrandChange(id: number | null): void {
    this.pickerBrandId.set(id ?? null);
    this.pickerFilterChange$.next();
  }


  removePendingNew(index: number): void {
    this.pendingNewItems.update(items => items.filter((_, i) => i !== index));
  }

  // ─── Audit Log ────────────────────────────────────────────────────────────────

  loadAuditLog(orderId: number): void {
    this.auditLoading.set(true);
    this.adminService.getOrderAuditLog(orderId)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.auditLoading.set(false)))
      .subscribe({
        next: (logs) => this.auditLogs.set(logs),
        error: () => this.auditLogs.set([])
      });
  }

  getAuditActionLabel(action: string): string {
    const labels: Record<string, string> = {
      order_created: 'Commande créée',
      status_changed: 'Statut modifié',
      item_added: 'Article ajouté',
      item_removed: 'Article supprimé',
      item_quantity_changed: 'Quantité modifiée',
      payment_recorded: 'Paiement enregistré',
      refund_recorded: 'Remboursement enregistré',
      delivery_confirmed: 'Livraison confirmée',
    };
    return labels[action] ?? action;
  }

  getAuditActionIcon(action: string): string {
    const icons: Record<string, string> = {
      order_created: 'pi-plus-circle',
      status_changed: 'pi-sync',
      item_added: 'pi-cart-plus',
      item_removed: 'pi-minus-circle',
      item_quantity_changed: 'pi-pencil',
      payment_recorded: 'pi-money-bill',
      refund_recorded: 'pi-arrow-circle-left',
      delivery_confirmed: 'pi-truck',
    };
    return 'pi ' + (icons[action] ?? 'pi-circle');
  }

  getAuditActionColor(action: string): string {
    const colors: Record<string, string> = {
      order_created: '#22c55e',
      status_changed: '#6366f1',
      item_added: '#22c55e',
      item_removed: '#ef4444',
      item_quantity_changed: '#f97316',
      payment_recorded: '#22c55e',
      refund_recorded: '#f97316',
      delivery_confirmed: '#22c55e',
    };
    return colors[action] ?? 'var(--text-color-secondary)';
  }

  // ─── Existing ─────────────────────────────────────────────────────────────────

  printing = signal(false);

  async printOrder(): Promise<void> {
    const order = this.order();
    if (order) {
      this.printing.set(true);
      await this.orderPdf.generateOrderPdf(order);
      this.printing.set(false);
    }
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    const parent = img.parentElement;
    if (parent) {
      const icon = document.createElement('i');
      icon.className = 'pi pi-box';
      parent.appendChild(icon);
    }
  }

  getStatusIcon(status: string): string {
    return this.statusSeverity.getOrderStatusIcon(status);
  }

  canEditStatus(status: string): boolean {
    return this.statusSeverity.canEditOrderStatus(status);
  }

  getNextStatuses(currentStatus: string): { value: string; label: string; icon: string }[] {
    return this.statusSeverity.getNextOrderStatuses(currentStatus, this.isPickupOrder());
  }

  getStatusIndex(status: string): number {
    const statusOrder = this.isPickupOrder()
      ? ['pending', 'confirmed', 'ready', 'delivered']
      : ['pending', 'confirmed', 'assigned', 'picked_up', 'in_transit', 'delivered'];
    return statusOrder.indexOf(status);
  }

  selectStatus(status: string): void {
    this.selectedNewStatus.set(status);
    this.selectedStatusDriverId.set(null);
  }

  onStatusDriverSelect(driverId: number): void {
    this.selectedStatusDriverId.set(driverId);
  }

  canConfirmStatusChange(): boolean {
    if (!this.selectedNewStatus()) return false;
    if (this.needsDriverSelection() && !this.selectedStatusDriverId()) return false;
    return true;
  }

  confirmStatusChange(): void {
    const order = this.order();
    const newStatus = this.selectedNewStatus();

    if (!order || !newStatus) return;

    // If assigning to a driver, use the assign API
    if (newStatus === ORDER_STATUS.ASSIGNED) {
      const driverId = this.selectedStatusDriverId();
      if (!driverId) return;
      this.assignOrderToDriverFromStatus(order.id, driverId);
    } else {
      this.selectedNewStatus.set(null);
      this.selectedStatusDriverId.set(null);
      this.updateOrderStatus(order.id, newStatus);
    }
  }

  private assignOrderToDriverFromStatus(orderId: number, driverId: number): void {
    this.assigning.set(true);
    this.adminService.assignOrderToDriver(orderId, { driver_id: driverId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response.success && response.order) {
            const currentOrder = this.order();
            this.order.set({
              ...response.order,
              items: currentOrder?.items
            });
            this.selectedNewStatus.set(null);
            this.selectedStatusDriverId.set(null);
            this.toast.showSuccess('admin.orders.driver_assigned');
          }
          this.assigning.set(false);
        },
        error: (error) => {
          this.assigning.set(false);
          this.toast.showApiError(error, 'admin.orders.assign_error');
        }
      });
  }

  private updateOrderStatus(orderId: number, newStatus: string): void {
    this.adminService.updateOrderStatus(orderId, newStatus)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updatedOrder) => {
          const currentOrder = this.order();
          this.order.set({
            ...updatedOrder,
            items: currentOrder?.items
          });
          this.toast.showSuccess('admin.orders.status_update_message', {
            orderId: orderId,
            status: this.translateService.instant('admin.orders.status.' + newStatus)
          });
        },
        error: (error) => {
          this.toast.showApiError(error, 'admin.orders.update_error');
        }
      });
  }

  getItemCartonCount(item: OrderItem): number {
    return Math.floor(item.quantity / (item.pieces_per_box || 1));
  }

  getItemPackagingLabel(item: OrderItem): string {
    const count = this.getItemCartonCount(item);
    return this.packagingTypeService.getPackagingTypeForCount(item.packaging_type || 'carton', count);
  }

  getNewItemPackagingLabel(product: Product, qty: number): string {
    return this.packagingTypeService.getPackagingTypeForCount(product.packaging_type || 'carton', qty);
  }

  // ─── Create Mode ──────────────────────────────────────────────────────────────

  onCustomerSearch(event: { query: string }): void {
    this.customerSearch$.next(event.query);
  }

  onCustomerSelected(event: { value: UserManage }): void {
    this.createCustomer.set(event.value);
  }

  clearCustomer(): void {
    this.selectedCustomer = null;
    this.createCustomer.set(null);
    this.customerSearchResults.set([]);
  }

  submitCreateOrder(): void {
    const customer = this.createCustomer();
    const items = this.pendingNewItems();
    if (!customer || items.length === 0) return;

    const orderItems = items.map(({ product, qty, customPrice }) => ({
      product_id: product.id,
      quantity: qty * (product.pieces_per_box || 1),
      custom_unit_price: customPrice ?? null
    }));

    this.creatingOrder.set(true);
    this.adminService.createOrderForUser(customer.id, orderItems, this.createDeliveryType())
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.creatingOrder.set(false)))
      .subscribe({
        next: (res) => {
          this.toast.showSuccess('Commande créée avec succès');
          this.router.navigate([RouteHelpers.adminOrderDetail(res.order_id)]);
        },
        error: (err) => this.toast.showError(err?.error?.detail ?? 'Erreur lors de la création')
      });
  }

  // Driver loading
  loadAvailableDrivers(): void {
    this.loadingDrivers.set(true);
    this.adminService.getAvailableDrivers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (drivers) => {
          this.availableDrivers.set(drivers);
          this.loadingDrivers.set(false);
        },
        error: () => {
          this.loadingDrivers.set(false);
        }
      });
  }
}
