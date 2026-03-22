import { Injectable, inject, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { RestockRow } from '../models/restock.model';
import { ToastMessageService } from '../core/services/toast-message.service';
import { SupplierService } from '../core/services/supplier.service';
import { Supplier } from '../models/supplier.model';
import {
  PurchaseOrderService,
  PurchaseOrder,
  PurchaseOrderCreate,
  PurchaseOrderItemCreate,
  PurchaseOrderUpdate,
  PurchaseOrderItemUpdate
} from './purchase-order.service';
import { ROUTES } from '../core/constants/routes.constants';

const CART_STORAGE_KEY = 'stock_cart_items';

@Injectable({
  providedIn: 'root'
})
export class PurchasingCartService {
  private router = inject(Router);
  private toast = inject(ToastMessageService);
  private destroyRef = inject(DestroyRef);
  private orderService = inject(PurchaseOrderService);
  private supplierService = inject(SupplierService);

  // All rows reference (set by stock component)
  private allRowsRef = signal<RestockRow[]>([]);

  // Cart state
  cartItemIds = signal<Set<number>>(new Set());

  // Draft editing state
  editingDraftId = signal<number | null>(null);
  editingDraftRef = signal<string | null>(null);
  hasUnsavedChanges = signal(false);

  // Loading states
  savingOrder = signal(false);
  loadingDraft = signal(false);

  // Selected supplier for the order
  selectedSupplier = signal<string | null>(null);

  // Suppliers from API
  suppliers = signal<Supplier[]>([]);

  // Last saved order reference (for success message)
  lastSavedOrderRef = signal<string | null>(null);

  // Computed: cart items from allRows
  cartItems = computed(() => {
    const ids = this.cartItemIds();
    return this.allRowsRef().filter(r => ids.has(r.id));
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

  // Computed: is editing mode
  isEditingDraft = computed(() => this.editingDraftId() !== null);

  // Supplier options for dropdown
  supplierOptions = computed(() => {
    const suppliersFromApi = this.suppliers();
    const suppliersFromCart = new Set<string>();

    // Add suppliers from cart items
    this.cartItems().forEach(item => {
      if (item.supplier) {
        suppliersFromCart.add(item.supplier);
      }
    });

    // Combine API suppliers with cart suppliers
    const allSuppliers = new Map<string, { label: string; value: string }>();

    // Add API suppliers first
    suppliersFromApi.forEach(s => {
      allSuppliers.set(s.name, {
        label: s.city ? `${s.name} - ${s.city}` : s.name,
        value: s.name
      });
    });

    // Add cart suppliers that aren't in API
    suppliersFromCart.forEach(name => {
      if (!allSuppliers.has(name)) {
        allSuppliers.set(name, { label: name, value: name });
      }
    });

    return Array.from(allSuppliers.values()).sort((a, b) => a.label.localeCompare(b.label));
  });

  constructor() {
    this.loadCartFromStorage();
    this.loadSuppliers();
  }

  // Set reference to all rows (called by stock component)
  setAllRows(rows: RestockRow[]): void {
    this.allRowsRef.set(rows);
  }

  // Load suppliers from API
  private loadSuppliers(): void {
    this.supplierService.getSuppliers().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (suppliers) => {
        this.suppliers.set(suppliers);
      }
    });
  }

  // Get supplier details by name
  getSupplierDetails(name: string): Supplier | undefined {
    return this.suppliers().find(s => s.name === name);
  }

  // Storage methods
  private loadCartFromStorage(): void {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
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
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(ids));
  }

  // Cart operations
  addToCart(row: RestockRow): void {
    this.cartItemIds.update(set => {
      const newSet = new Set(set);
      newSet.add(row.id);
      return newSet;
    });
    this.saveCartToStorage();
    this.hasUnsavedChanges.set(true);
  }

  removeFromCart(row: RestockRow): void {
    this.cartItemIds.update(set => {
      const newSet = new Set(set);
      newSet.delete(row.id);
      return newSet;
    });
    this.saveCartToStorage();
    this.hasUnsavedChanges.set(true);
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
    this.editingDraftId.set(null);
    this.editingDraftRef.set(null);
    this.selectedSupplier.set(null);
    this.toast.showSuccess('Panier vidé');
  }

  // Helper methods
  getSupplierItemCount(supplier: string): number {
    return this.cartItems().filter(item => item.supplier === supplier).length;
  }

  getSupplierTotalValue(supplier: string): number {
    return this.cartItems()
      .filter(item => item.supplier === supplier)
      .reduce((sum, r) => sum + (r.prixCarton * r.nmbCarton), 0);
  }

  getSupplierTotal(rows: RestockRow[]): number {
    return rows.reduce((sum, r) => sum + (r.prixCarton * r.nmbCarton), 0);
  }

  // Draft editing methods
  loadDraftForEditing(orderId: number): void {
    this.loadingDraft.set(true);

    this.orderService.getOrder(orderId).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loadingDraft.set(false))
    ).subscribe({
      next: (order) => {
        if (order.status !== 'draft') {
          this.toast.showError('Seuls les brouillons peuvent être modifiés');
          return;
        }

        // Set editing state
        this.editingDraftId.set(order.id);
        this.editingDraftRef.set(order.reference);
        this.selectedSupplier.set(order.supplier_name);

        // Map order items to cart
        // Find matching restock rows by product_id or name+brand
        const allRows = this.allRowsRef();
        const newCartIds = new Set<number>();

        order.items.forEach(item => {
          // Try to find by product_id first
          let matchingRow = allRows.find(r => r.productId === item.product_id && item.product_id);

          // Fallback to name + brand match
          if (!matchingRow) {
            matchingRow = allRows.find(r =>
              r.name.toLowerCase() === item.product_name.toLowerCase() &&
              r.brand.toLowerCase() === item.brand.toLowerCase()
            );
          }

          if (matchingRow) {
            // Update the quantity in the row
            matchingRow.nmbCarton = item.quantity_ordered;
            matchingRow.prixCarton = item.unit_price;
            newCartIds.add(matchingRow.id);
          }
        });

        this.cartItemIds.set(newCartIds);
        this.saveCartToStorage();
        this.hasUnsavedChanges.set(false);

        this.toast.showSuccess(`Brouillon ${order.reference} chargé`);
      },
      error: () => {
        this.toast.showError('Erreur lors du chargement du brouillon');
      }
    });
  }

  cancelEditing(): void {
    this.hasUnsavedChanges.set(false);
    this.editingDraftId.set(null);
    this.editingDraftRef.set(null);
    this.clearCart();
  }

  // Helper: Build order items from cart rows
  private buildOrderItems(rows: RestockRow[]): PurchaseOrderItemCreate[] {
    return rows.map(row => ({
      product_id: row.productId || undefined,
      product_name: row.name || '',
      brand: row.brand || '',
      units_per_carton: row.uniteParCarton || 1,
      quantity_ordered: row.nmbCarton || 1,
      unit_price: row.prixCarton || 0,
      total_price: (row.prixCarton || 0) * (row.nmbCarton || 1)
    }));
  }

  // Helper: Build supplier info for order
  private buildSupplierInfo(supplierName: string): Pick<PurchaseOrderCreate, 'supplier_name' | 'supplier_address' | 'supplier_phone' | 'supplier_email' | 'supplier_city'> {
    const details = this.getSupplierDetails(supplierName);
    return {
      supplier_name: details?.name || supplierName,
      supplier_address: details?.address,
      supplier_phone: details?.phone,
      supplier_email: details?.email,
      supplier_city: details?.city
    };
  }

  // Save order (create new or update existing draft)
  saveOrder(): void {
    if (this.cartCount() === 0) {
      this.toast.showWarn('Le panier est vide');
      return;
    }

    const items = this.cartItems();
    const supplierName = this.selectedSupplier() || items[0]?.supplier || 'Inconnu';
    const orderItems = this.buildOrderItems(items);
    const supplierInfo = this.buildSupplierInfo(supplierName);

    this.savingOrder.set(true);

    if (this.isEditingDraft()) {
      // Update existing draft
      const updateData: PurchaseOrderUpdate = {
        ...supplierInfo,
        items: orderItems as PurchaseOrderItemUpdate[]
      };

      this.orderService.updateOrder(this.editingDraftId()!, updateData).pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.savingOrder.set(false))
      ).subscribe({
        next: (order) => {
          this.lastSavedOrderRef.set(order.reference);
          this.toast.showSuccess(`Commande ${order.reference} mise à jour`);
          this.hasUnsavedChanges.set(false);
          this.editingDraftId.set(null);
          this.editingDraftRef.set(null);
          this.selectedSupplier.set(null);
          // Clear cart after successful update
          this.cartItemIds.set(new Set());
          this.saveCartToStorage();
        },
        error: () => {
          this.toast.showError('Erreur lors de la mise à jour');
        }
      });
    } else {
      // Create new order
      const orderData: PurchaseOrderCreate = {
        ...supplierInfo,
        items: orderItems
      };

      this.orderService.createOrder(orderData).pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.savingOrder.set(false))
      ).subscribe({
        next: (order) => {
          this.hasUnsavedChanges.set(false);
          this.lastSavedOrderRef.set(order.reference);
          this.toast.showSuccess(`Commande ${order.reference} enregistrée`);
          // Clear cart after successful save
          this.editingDraftId.set(null);
          this.editingDraftRef.set(null);
          this.selectedSupplier.set(null);
          this.cartItemIds.set(new Set());
          this.saveCartToStorage();
        },
        error: () => {
          this.toast.showError('Erreur lors de l\'enregistrement');
        }
      });
    }
  }

  // Navigate to edit a draft
  navigateToEditDraft(orderId: number): void {
    this.router.navigate([ROUTES.ADMIN.STOCK], {
      queryParams: { editDraft: orderId }
    });
  }
}
