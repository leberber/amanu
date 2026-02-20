// src/app/pages/admin/admin-promotions/admin-promotions.component.ts
import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';

import { ADMIN_CORE_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { PaginatorModule } from 'primeng/paginator';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DateFormatPipe } from '../../../shared/pipes/date-format.pipe';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { onLanguageChange } from '../../../core/utils/language-change.util';
import { PromotionService } from '../../../services/promotion.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { Promotion } from '../../../models/promotion.model';
import { ConfirmationDialogService } from '../../../core/services/confirmation-dialog.service';
import { BaseAdminListComponent } from '../../../shared/base/base-admin-list.component';

@Component({
  selector: 'app-admin-promotions',
  standalone: true,
  imports: [
    ...ADMIN_CORE_IMPORTS,
    PaginatorModule,
    ConfirmDialogModule,
    DateFormatPipe
  ],
  providers: [ConfirmationService],
  templateUrl: './admin-promotions.component.html',
  styleUrl: './admin-promotions.component.scss'
})
export class AdminPromotionsComponent extends BaseAdminListComponent implements OnInit {
  allPromotions: Promotion[] = [];
  promotions: Promotion[] = [];
  paginatedPromotions: Promotion[] = [];

  // Override status filter type for promotions (different from default active/inactive)
  override statusFilter: string = 'all';

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

  getActiveCount(): number {
    return this.getCountByPredicate(this.allPromotions, p => this.getPromotionStatus(p) === 'active');
  }

  getExpiredCount(): number {
    return this.getCountByPredicate(this.allPromotions, p => this.getPromotionStatus(p) === 'expired');
  }

  getScheduledCount(): number {
    return this.getCountByPredicate(this.allPromotions, p => this.getPromotionStatus(p) === 'scheduled');
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
    this.paginatedPromotions = this.promotions.slice(this.first, this.first + this.rows);
  }

  getSearchDebounceKey(): string {
    return 'promotions-search';
  }

  // === Data loading ===

  loadAllPromotions() {
    this.loadData(
      () => this.promotionService.getAllPromotions(),
      (promotions) => {
        this.allPromotions = promotions;
        this.promotions = promotions;
        this.updatePaginatedItems();
      },
      'admin.promotions.load_error'
    );
  }

  filterItems(): void {
    let filtered = [...this.allPromotions];

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

    this.promotions = filtered;
    this.resetPagination();
    this.updatePaginatedItems();
  }

  clearFilters() {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.resetPagination();
    this.filterItems();
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

  deletePromotion(promotion: Promotion) {
    this.handleDelete(
      () => this.promotionService.deletePromotion(promotion.id),
      this.allPromotions,
      promotion.id,
      (updated) => { this.allPromotions = updated; },
      'admin.promotions.delete_success',
      'admin.promotions.delete_failed'
    );
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
