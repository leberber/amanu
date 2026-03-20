import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';

import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { ConfirmationDialogService } from '../../../core/services/confirmation-dialog.service';
import { ROUTES } from '../../../core/constants/routes.constants';
import {
  PurchaseOrderService,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus
} from '../../../services/purchase-order.service';

@Component({
  selector: 'app-admin-purchase-order-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TagModule,
    InputNumberModule,
    InputTextModule,
    TextareaModule,
    TooltipModule,
    ConfirmDialogModule,
    PageLayoutComponent
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

  // State
  loading = signal(true);
  saving = signal(false);
  order = signal<PurchaseOrder | null>(null);
  deliveryWarning = signal<string | null>(null);

  // Editable items (for delivery confirmation)
  editableItems = signal<EditableItem[]>([]);

  // Computed
  canEdit = computed(() => {
    const o = this.order();
    return o ? this.orderService.canEdit(o) : false;
  });

  canDelete = computed(() => {
    const o = this.order();
    return o ? this.orderService.canDelete(o) : false;
  });

  nextStatus = computed(() => {
    const o = this.order();
    return o ? this.orderService.getNextStatus(o.status) : null;
  });

  nextStatusLabel = computed(() => {
    const o = this.order();
    return o ? this.orderService.getNextStatusLabel(o.status) : null;
  });

  totalReceived = computed(() => {
    return this.editableItems().reduce((sum, item) => sum + (item.quantity_received || 0), 0);
  });

  totalOrdered = computed(() => {
    return this.editableItems().reduce((sum, item) => sum + item.quantity_ordered, 0);
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
      },
      error: () => {
        this.toast.showError('Commande introuvable');
        this.router.navigate([ROUTES.ADMIN.PURCHASE_ORDERS]);
      }
    });
  }

  initEditableItems(items: PurchaseOrderItem[]): void {
    this.editableItems.set(items.map(item => ({
      ...item,
      quantity_received: item.quantity_received || item.quantity_ordered // Default to full quantity
    })));
  }

  // Status helpers
  getStatusLabel(status: PurchaseOrderStatus): string {
    return this.orderService.getStatusLabel(status);
  }

  getStatusSeverity(status: PurchaseOrderStatus): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    return this.orderService.getStatusSeverity(status);
  }

  // Actions
  goBack(): void {
    this.router.navigate([ROUTES.ADMIN.PURCHASE_ORDERS]);
  }

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
        this.toast.showSuccess(`Statut mis à jour: ${this.getStatusLabel(newStatus)}`);
      },
      error: () => {
        this.toast.showError('Erreur lors de la mise à jour du statut');
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
        quantity_received: item.quantity_received || 0
      })),
      notes: undefined
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
        this.toast.showSuccess('Livraison confirmée - Stock mis à jour');
      },
      error: (err) => {
        // Check if it's a validation error (400) with unlinked items
        if (err.status === 400 && err.error?.detail) {
          this.deliveryWarning.set(err.error.detail);
        } else {
          this.toast.showError('Erreur lors de la confirmation de livraison');
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
      if (updated[index].quantity_received < updated[index].quantity_ordered) {
        updated[index] = {
          ...updated[index],
          quantity_received: updated[index].quantity_received + 1
        };
      }
      return updated;
    });
  }

  decrementQuantity(index: number): void {
    this.editableItems.update(items => {
      const updated = [...items];
      if (updated[index].quantity_received > 0) {
        updated[index] = {
          ...updated[index],
          quantity_received: updated[index].quantity_received - 1
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
        this.toast.showSuccess('Article supprimé');
      },
      error: (err) => {
        // Check if order was deleted (last item)
        if (err.status === 200 && err.error?.order_deleted) {
          this.toast.showSuccess('Commande supprimée (dernier article)');
          this.router.navigate([ROUTES.ADMIN.PURCHASE_ORDERS]);
        } else {
          this.toast.showError('Erreur lors de la suppression');
        }
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

  deleteOrder(): void {
    const order = this.order();
    if (!order) return;

    this.saving.set(true);
    this.orderService.deleteOrder(order.id).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.saving.set(false))
    ).subscribe({
      next: () => {
        this.toast.showSuccess('Commande supprimée');
        this.router.navigate([ROUTES.ADMIN.PURCHASE_ORDERS]);
      },
      error: () => {
        this.toast.showError('Erreur lors de la suppression');
      }
    });
  }

  // Formatting
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount) + ' DA';
  }
}

interface EditableItem extends PurchaseOrderItem {
  quantity_received: number;
}
