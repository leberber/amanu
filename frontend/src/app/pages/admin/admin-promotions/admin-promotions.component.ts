// src/app/pages/admin/admin-promotions/admin-promotions.component.ts
import { Component, OnInit, inject, DestroyRef, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConfirmationService } from 'primeng/api';
import { PopoverModule } from 'primeng/popover';
import { TranslateService } from '@ngx-translate/core';

import { ADMIN_LIST_IMPORTS, ADMIN_DIALOG_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { TableSkeletonComponent, SkeletonColumn } from '../../../shared/components/table-skeleton/table-skeleton.component';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { onLanguageChange } from '../../../core/utils/language-change.util';
import { PromotionService } from '../../../services/promotion.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { Promotion } from '../../../models/promotion.model';
import { ConfirmationDialogService } from '../../../core/services/confirmation-dialog.service';
import { BaseAdminListComponent, ColumnOption } from '../../../shared/base/base-admin-list.component';

@Component({
  selector: 'app-admin-promotions',
  standalone: true,
  imports: [
    ...ADMIN_LIST_IMPORTS,
    ...ADMIN_DIALOG_IMPORTS,
    PopoverModule,
    TableSkeletonComponent
  ],
  providers: [ConfirmationService],
  templateUrl: './admin-promotions.component.html',
  styleUrl: './admin-promotions.component.scss'
})
export class AdminPromotionsComponent extends BaseAdminListComponent implements OnInit {
  // Data signals
  allPromotions = signal<Promotion[]>([]);
  promotions = signal<Promotion[]>([]);
  paginatedPromotions = signal<Promotion[]>([]);

  // UI state signals
  isFullscreen = signal(false);
  tableInitialized = signal(false);

  // Override status filter type for promotions (different from default active/inactive)
  override statusFilter: string = 'all';

  // Computed counts
  activeCount = computed(() => this.allPromotions().filter(p => this.getPromotionStatus(p) === 'active').length);
  expiredCount = computed(() => this.allPromotions().filter(p => this.getPromotionStatus(p) === 'expired').length);
  scheduledCount = computed(() => this.allPromotions().filter(p => this.getPromotionStatus(p) === 'scheduled').length);

  // Skeleton configuration
  skeletonColumns: SkeletonColumn[] = [
    { width: '22%', type: 'text-multi', headerWidth: '80px' },
    { width: '12%', type: 'pill', headerWidth: '60px' },
    { width: '10%', type: 'pill', headerWidth: '70px' },
    { width: '10%', type: 'pill', headerWidth: '60px' },
    { width: '14%', type: 'text-multi', headerWidth: '70px' },
    { width: '10%', type: 'pill', headerWidth: '60px' },
    { width: '12%', type: 'pill', headerWidth: '60px' },
    { width: '10%', type: 'actions', headerWidth: '60px' }
  ];

  // Column visibility options
  override columnOptions: ColumnOption[] = [
    { field: 'name', label: 'admin.promotions.table.name', visible: true },
    { field: 'code', label: 'admin.promotions.table.code', visible: true },
    { field: 'discount', label: 'admin.promotions.table.discount', visible: true },
    { field: 'scope', label: 'admin.promotions.table.scope', visible: true },
    { field: 'validity', label: 'admin.promotions.table.validity', visible: true },
    { field: 'usage', label: 'admin.promotions.table.usage', visible: true },
    { field: 'status', label: 'admin.promotions.table.status', visible: true },
    { field: 'actions', label: 'admin.promotions.table.actions', visible: true }
  ];

  // Services
  private promotionService = inject(PromotionService);
  private confirmationService = inject(ConfirmationService);
  private confirmDialog = inject(ConfirmationDialogService);
  private translateService = inject(TranslateService);
  private currencyService = inject(CurrencyService);
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    this.loadAllPromotions();
    onLanguageChange(this.translateService, this.destroyRef, () => this.filterItems());
  }

  hasActiveFilters(): boolean {
    return !!(this.searchQuery?.trim() || this.statusFilter !== 'all');
  }

  getPromotionStatus(promotion: Promotion): 'active' | 'expired' | 'scheduled' | 'inactive' {
    if (!promotion.is_active) return 'inactive';

    const now = new Date();
    const startDate = new Date(promotion.start_date);
    const endDate = new Date(promotion.end_date);

    if (now < startDate) return 'scheduled';
    if (now > endDate) return 'expired';
    return 'active';
  }

  // === Abstract method implementations ===

  updatePaginatedItems(): void {
    this.paginatedPromotions.set(this.promotions().slice(this.first, this.first + this.rows));
  }

  getSearchDebounceKey(): string {
    return 'promotions-search';
  }

  // === Data loading ===

  loadAllPromotions(): void {
    this.loading = true;
    this.promotionService.getAllPromotions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (promotions) => {
          // Sort by created_at descending (newest first)
          const sorted = [...promotions].sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          this.allPromotions.set(sorted);
          this.promotions.set(sorted);
          this.updatePaginatedItems();
          this.loading = false;
          setTimeout(() => this.tableInitialized.set(true), 100);
        },
        error: () => {
          this.allPromotions.set([]);
          this.promotions.set([]);
          this.loading = false;
          this.baseToast.showError('admin.promotions.load_error');
        }
      });
  }

  filterItems(): void {
    let filtered = [...this.allPromotions()];

    // Status filter (custom for promotions: active/expired/scheduled)
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(p => this.getPromotionStatus(p) === this.statusFilter);
    }

    if (this.hasSearchQuery()) {
      const search = this.searchQuery.toLowerCase();
      filtered = filtered.filter(promotion =>
        promotion.name.toLowerCase().includes(search) ||
        promotion.code?.toLowerCase().includes(search) ||
        promotion.description?.toLowerCase().includes(search)
      );
    }

    this.promotions.set(filtered);
    this.resetPagination();
    this.updatePaginatedItems();
  }

  override clearFilters() {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.resetPagination();
    this.filterItems();
  }

  toggleFullscreen(): void {
    this.isFullscreen.update(v => !v);
    if (this.isFullscreen()) {
      document.body.classList.add('fullscreen-active');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.classList.remove('fullscreen-active');
      document.body.style.overflow = '';
    }
  }

  createNewPromotion() {
    this.baseRouter.navigate([ROUTES.ADMIN.ADD_PROMOTION]);
  }

  editPromotion(promotion: Promotion) {
    this.baseRouter.navigate([RouteHelpers.adminEditPromotion(promotion.id)]);
  }

  confirmDeletePromotion(promotion: Promotion) {
    this.confirmDialog.confirmDelete(
      this.confirmationService,
      promotion.name,
      () => this.deletePromotion(promotion)
    );
  }

  deletePromotion(promotion: Promotion): void {
    this.promotionService.deletePromotion(promotion.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.allPromotions.update(promos => promos.filter(p => p.id !== promotion.id));
          this.filterItems();
          this.baseToast.showSuccess('admin.promotions.delete_success');
        },
        error: (error) => {
          this.baseToast.showApiError(error, 'admin.promotions.delete_failed');
        }
      });
  }

  refreshPromotionData() {
    this.loadAllPromotions();
  }

  getDiscountDisplay(promotion: Promotion): string {
    if (promotion.discount_type === 'percentage') {
      return `${promotion.discount_value}%`;
    }
    return this.currencyService.formatCurrency(promotion.discount_value);
  }

  getScopeDisplay(promotion: Promotion): string {
    return this.translateService.instant(`admin.promotions.scope.${promotion.scope}`);
  }

  getStatusClass(promotion: Promotion): string {
    return this.getPromotionStatus(promotion);
  }

  getStatusIcon(promotion: Promotion): string {
    const status = this.getPromotionStatus(promotion);
    switch (status) {
      case 'active': return 'pi pi-check';
      case 'expired': return 'pi pi-times';
      case 'scheduled': return 'pi pi-clock';
      case 'inactive': return 'pi pi-ban';
      default: return 'pi pi-info';
    }
  }

  getStatusLabel(promotion: Promotion): string {
    const status = this.getPromotionStatus(promotion);
    return this.translateService.instant(`admin.promotions.status.${status}`);
  }

  getUsageDisplay(promotion: Promotion): string {
    if (promotion.usage_limit) {
      return `${promotion.usage_count} / ${promotion.usage_limit}`;
    }
    return `${promotion.usage_count}`;
  }
}
