import { Component, inject, signal, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { trigger, transition, style, animate } from '@angular/animations';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { TagModule } from 'primeng/tag';

import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { CurrencyDisplayComponent } from '../../../shared/components/currency-display/currency-display.component';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { PackagingTypeService } from '../../../core/services/packaging-type.service';
import { AdminService } from '../../../services/admin.service';
import { ReturnsService, OrderReturnCreate } from '../../../core/services/returns.service';
import { Order, OrderItem } from '../../../models/admin.model';
import { ROUTES } from '../../../core/constants/routes.constants';
import { fractionLabel } from '../../../shared/utils/box-options.utils';

interface ReturnQtyOption {
  cartons: number;
  units: number;
  label: string;
}

interface ReturnItemDraft {
  orderItem: OrderItem;
  selected: boolean;
  cartonsQty: number;
  options: ReturnQtyOption[];
}

@Component({
  selector: 'app-admin-return-create',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    TextareaModule,
    TagModule,
    PageLayoutComponent,
    CurrencyDisplayComponent,
  ],
  templateUrl: './admin-return-create.component.html',
  styleUrl: './admin-return-create.component.scss',
  animations: [
    trigger('pageAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class AdminReturnCreateComponent {
  private destroyRef = inject(DestroyRef);
  private toast = inject(ToastMessageService);
  private packagingTypeService = inject(PackagingTypeService);
  private adminService = inject(AdminService);
  private returnsService = inject(ReturnsService);
  private router = inject(Router);

  readonly ROUTES = ROUTES;

  createOrderId = signal('');
  loadingOrder = signal(false);
  loadedOrder = signal<Order | null>(null);
  itemDrafts = signal<ReturnItemDraft[]>([]);
  createReason = signal('');
  createNotes = signal('');
  saving = signal(false);

  hasSelectedItems = computed(() => this.itemDrafts().some(d => d.selected && d.cartonsQty > 0));

  selectedRefundTotal = computed(() =>
    this.itemDrafts()
      .filter(d => d.selected && d.cartonsQty > 0)
      .reduce((sum, d) => {
        const ppb = d.orderItem.pieces_per_box || 1;
        return sum + (d.cartonsQty * ppb) * d.orderItem.unit_price;
      }, 0)
  );

  returnReasons = [
    'Produit endommagé',
    'Qualité insuffisante',
    'Produit périmé',
    'Erreur de commande',
    'Excédent de stock',
    'Autre',
  ];

  fetchOrder(): void {
    const id = Number(this.createOrderId());
    if (!id) return;
    this.loadingOrder.set(true);
    this.loadedOrder.set(null);
    this.itemDrafts.set([]);
    this.adminService.getOrderById(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (order) => {
        this.loadedOrder.set(order);
        this.itemDrafts.set((order.items ?? []).map(item => {
          const options = this.buildQtyOptions(item);
          return {
            orderItem: item,
            selected: false,
            cartonsQty: options[options.length - 1]?.cartons ?? 1,
            options,
          };
        }));
        this.loadingOrder.set(false);
      },
      error: () => {
        this.toast.showError('Commande introuvable');
        this.loadingOrder.set(false);
      }
    });
  }

  submitCreate(): void {
    const order = this.loadedOrder();
    if (!order) return;
    const selectedItems = this.itemDrafts().filter(d => d.selected && d.cartonsQty > 0);
    if (selectedItems.length === 0) return;

    const payload: OrderReturnCreate = {
      order_id: order.id,
      reason: this.createReason() || undefined,
      notes: this.createNotes() || undefined,
      items: selectedItems.map(d => ({
        order_item_id: d.orderItem.id,
        quantity: d.cartonsQty * (d.orderItem.pieces_per_box || 1),
      })),
    };

    this.saving.set(true);
    this.returnsService.create(payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.toast.showSuccess('Retour créé');
        this.router.navigate([ROUTES.ADMIN.RETURNS]);
      },
      error: () => {
        this.toast.showError('Erreur lors de la création');
        this.saving.set(false);
      }
    });
  }

  cancel(): void {
    this.router.navigate([ROUTES.ADMIN.RETURNS]);
  }

  toggleItem(index: number): void {
    this.itemDrafts.update(drafts => {
      const updated = [...drafts];
      updated[index] = { ...updated[index], selected: !updated[index].selected };
      return updated;
    });
  }

  setCartonsQty(index: number, cartons: number): void {
    this.itemDrafts.update(drafts => {
      const updated = [...drafts];
      updated[index] = { ...updated[index], cartonsQty: cartons };
      return updated;
    });
  }

  private buildQtyOptions(item: OrderItem): ReturnQtyOption[] {
    const ppb = item.pieces_per_box || 1;
    const maxUnits = item.quantity;
    const maxCartons = maxUnits / ppb;
    const rawType = item.packaging_type || 'carton';
    const pkgSingular = this.packagingTypeService.getPackagingTypeTranslated(rawType, false);
    const pkgPlural = this.packagingTypeService.getPackagingTypeTranslated(rawType, true);
    const options: ReturnQtyOption[] = [];

    if (ppb > 1) {
      const fracs: [number, number][] = [[1, 4], [1, 3], [1, 2]];
      for (const [n, d] of fracs) {
        const cartons = n / d;
        const units = cartons * ppb;
        if (Number.isInteger(units) && units <= maxUnits && cartons < maxCartons) {
          options.push({ cartons, units, label: `${fractionLabel(n, d)} ${pkgSingular}` });
        }
      }
    }

    for (let i = 1; i <= Math.floor(maxCartons); i++) {
      const label = ppb > 1 ? `${i} ${i === 1 ? pkgSingular : pkgPlural}` : `${i}`;
      options.push({ cartons: i, units: i * ppb, label });
    }

    return options;
  }
}
