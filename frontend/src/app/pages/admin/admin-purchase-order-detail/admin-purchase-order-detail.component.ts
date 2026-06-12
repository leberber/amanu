import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { ConfirmationDialogService } from '../../../core/services/confirmation-dialog.service';
import { CurrencyPipe } from '../../../shared/pipes/currency.pipe';
import { DateFormatPipe } from '../../../shared/pipes/date-format.pipe';
import { ROUTES } from '../../../core/constants/routes.constants';
import {
  PurchaseOrderService,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  AuditLog
} from '../../../services/purchase-order.service';

@Component({
  selector: 'app-admin-purchase-order-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputNumberModule,
    DatePickerModule,
    SelectModule,
    TooltipModule,
    ConfirmDialogModule,
    TranslateModule,
    PageLayoutComponent,
    CurrencyPipe,
    DateFormatPipe
  ],
  providers: [ConfirmationService],
  templateUrl: './admin-purchase-order-detail.component.html',
  styleUrl: './admin-purchase-order-detail.component.scss'
})
export class AdminPurchaseOrderDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private toast = inject(ToastMessageService);
  private confirmationService = inject(ConfirmationService);
  private confirmDialog = inject(ConfirmationDialogService);
  private orderService = inject(PurchaseOrderService);
  private translate = inject(TranslateService);

  // State
  loading = signal(true);
  saving = signal(false);
  order = signal<PurchaseOrder | null>(null);
  deliveryWarning = signal<string | null>(null);
  editableItems = signal<EditableItem[]>([]);
  sidebarCollapsed = signal(false);
  auditLogs = signal<AuditLog[]>([]);
  auditLoading = signal(false);

  // Computed - only keep what's used in template
  canDelete = computed(() => {
    const o = this.order();
    return o?.status === 'draft';
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadOrder(parseInt(id, 10));
    } else {
      this.router.navigate([ROUTES.ADMIN.PURCHASE_ORDERS]);
    }
  }

  loadOrder(id: number): void {
    this.loading.set(true);
    this.orderService.getOrder(id).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: (order) => {
        this.order.set(order);
        this.initEditableItems(order.items);
        this.loadAuditLogs(order.id);
      },
      error: () => {
        this.toast.showError(this.translate.instant('admin.purchase_orders.detail.not_found'));
        this.router.navigate([ROUTES.ADMIN.PURCHASE_ORDERS]);
      }
    });
  }

  loadAuditLogs(orderId: number): void {
    this.auditLoading.set(true);
    this.orderService.getOrderAuditLogs(orderId).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.auditLoading.set(false))
    ).subscribe({
      next: (logs) => this.auditLogs.set(logs),
      error: () => this.auditLogs.set([])
    });
  }

  getActionLabel(action: string): string {
    const labels: Record<string, string> = {
      create:           'Création',
      status_change:    'Changement de statut',
      confirm_delivery: 'Livraison confirmée',
      update_order:     'Modification',
      update_facture:   'Facture mise à jour',
      delete_item:      'Article supprimé',
      delete:           'Suppression',
    };
    return labels[action] ?? action;
  }

  getActionIcon(action: string): string {
    const icons: Record<string, string> = {
      create:           'pi-plus-circle',
      status_change:    'pi-sync',
      confirm_delivery: 'pi-truck',
      update_order:     'pi-pencil',
      update_facture:   'pi-file-edit',
      delete_item:      'pi-minus-circle',
      delete:           'pi-trash',
    };
    return 'pi ' + (icons[action] ?? 'pi-circle');
  }

  getActionColor(action: string): string {
    const colors: Record<string, string> = {
      create:           '#22c55e',
      status_change:    '#6366f1',
      confirm_delivery: '#22c55e',
      update_order:     '#f97316',
      update_facture:   '#f97316',
      delete_item:      '#ef4444',
      delete:           '#ef4444',
    };
    return colors[action] ?? 'var(--text-color-secondary)';
  }

  initEditableItems(items: PurchaseOrderItem[]): void {
    this.editableItems.set(items.map(item => ({
      ...item,
      facture_quantity: item.facture_quantity ?? 0,
      facture_unit_price: item.facture_unit_price ?? 0,
      quantity_rejected: item.quantity_rejected ?? 0,
      made_date: item.made_date ? new Date(item.made_date) : null,
      expiry_date: item.expiry_date ? new Date(item.expiry_date) : null,
    })));
  }

  // Actions
  updateStatus(newStatus: PurchaseOrderStatus): void {
    const order = this.order();
    if (!order) return;

    this.saving.set(true);
    this.orderService.updateStatus(order.id, newStatus).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.saving.set(false))
    ).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.loadAuditLogs(updated.id);
        this.toast.showSuccess(this.translate.instant('admin.purchase_orders.detail.status_updated'));
      },
      error: () => {
        this.toast.showError(this.translate.instant('admin.purchase_orders.detail.status_update_error'));
      }
    });
  }

  confirmDelivery(): void {
    const order = this.order();
    if (!order) return;

    // Clear any previous warning
    this.deliveryWarning.set(null);

    const deliveryData = {
      items: this.editableItems().map(item => ({
        item_id: item.id!,
        quantity_received: item.quantity_ordered,
        quantity_rejected: item.quantity_rejected,
        facture_quantity: item.facture_quantity,
        facture_unit_price: item.facture_unit_price,
        made_date: item.made_date ? toLocalDate(item.made_date) : null,
        expiry_date: item.expiry_date ? toLocalDate(item.expiry_date) : null
      }))
    };

    this.saving.set(true);
    this.orderService.confirmDelivery(order.id, deliveryData).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.saving.set(false))
    ).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.initEditableItems(updated.items);
        this.deliveryWarning.set(null);
        this.loadAuditLogs(updated.id);
        this.toast.showSuccess(this.translate.instant('admin.purchase_orders.detail.delivery_confirmed'));
      },
      error: (err) => {
        // Check if it's a validation error (400) with unlinked items
        if (err.status === 400 && err.error?.detail) {
          this.deliveryWarning.set(err.error.detail);
        } else {
          this.toast.showError(this.translate.instant('admin.purchase_orders.detail.delivery_error'));
        }
      }
    });
  }

  dismissWarning(): void {
    this.deliveryWarning.set(null);
  }

  // Quantity controls
  incrementQuantity(index: number): void {
    this.editableItems.update(items => {
      const updated = [...items];
      const newQty = updated[index].quantity_ordered + 1;
      updated[index] = {
        ...updated[index],
        quantity_ordered: newQty,
        total_price: newQty * updated[index].unit_price
      };
      return updated;
    });
  }

  decrementQuantity(index: number): void {
    this.editableItems.update(items => {
      const updated = [...items];
      if (updated[index].quantity_ordered > 1) {
        const newQty = updated[index].quantity_ordered - 1;
        updated[index] = {
          ...updated[index],
          quantity_ordered: newQty,
          total_price: newQty * updated[index].unit_price
        };
      }
      return updated;
    });
  }

  deleteItem(itemId: number): void {
    const order = this.order();
    if (!order) return;

    this.saving.set(true);
    this.orderService.deleteItem(order.id, itemId).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.saving.set(false))
    ).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.initEditableItems(updated.items);
        this.deliveryWarning.set(null);
        this.loadAuditLogs(updated.id);
        this.toast.showSuccess(this.translate.instant('admin.purchase_orders.detail.item_deleted'));
      },
      error: () => {
        this.toast.showError(this.translate.instant('admin.purchase_orders.detail.item_delete_error'));
      }
    });
  }

  confirmDelete(): void {
    const order = this.order();
    if (!order) return;

    this.confirmDialog.confirmDelete(
      this.confirmationService,
      order.reference,
      () => this.deleteOrder()
    );
  }

  confirmSaveFacture(): void {
    this.confirmationService.confirm({
      message: 'Voulez-vous mettre à jour ce bon de commande ?',
      header: 'Mettre à jour',
      icon: 'pi pi-save',
      acceptLabel: 'Mettre à jour',
      rejectLabel: 'Annuler',
      acceptButtonStyleClass: 'p-button-success',
      accept: () => this.saveFactureData()
    });
  }

  saveFactureData(): void {
    const order = this.order();
    if (!order) return;

    this.saving.set(true);
    this.orderService.updateFactureItems(order.id, this.editableItems().map(item => ({
      item_id: item.id!,
      facture_quantity: item.facture_quantity,
      facture_unit_price: item.facture_unit_price,
      quantity_rejected: item.quantity_rejected,
      made_date: item.made_date ? toLocalDate(item.made_date) : null,
      expiry_date: item.expiry_date ? toLocalDate(item.expiry_date) : null,
    }))).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.saving.set(false))
    ).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.initEditableItems(updated.items);
        this.loadAuditLogs(updated.id);
        this.toast.showSuccess('Données de facturation enregistrées');
      },
      error: () => this.toast.showError('Erreur lors de la sauvegarde')
    });
  }

  deleteOrder(): void {
    const order = this.order();
    if (!order) return;

    this.saving.set(true);
    this.orderService.deleteOrder(order.id).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.saving.set(false))
    ).subscribe({
      next: () => {
        this.toast.showSuccess(this.translate.instant('admin.purchase_orders.detail.order_deleted'));
        this.router.navigate([ROUTES.ADMIN.PURCHASE_ORDERS]);
      },
      error: () => {
        this.toast.showError(this.translate.instant('admin.purchase_orders.detail.order_delete_error'));
      }
    });
  }
}

function toLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface EditableItem extends Omit<PurchaseOrderItem, 'made_date' | 'expiry_date' | 'quantity_rejected'> {
  facture_quantity: number;
  facture_unit_price: number;
  quantity_rejected: number;
  made_date: Date | null;
  expiry_date: Date | null;
}
