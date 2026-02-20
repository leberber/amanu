// src/app/pages/admin/admin-promotions/admin-promotions.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { PaginatorModule } from 'primeng/paginator';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { TooltipModule } from 'primeng/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { PromotionService } from '../../../services/promotion.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { Promotion } from '../../../models/promotion.model';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { ConfirmationDialogService } from '../../../core/services/confirmation-dialog.service';
import { BaseAdminListComponent } from '../../../shared/base/base-admin-list.component';
@Component({
  selector: 'app-admin-promotions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    ToastModule,
    PaginatorModule,
    ConfirmDialogModule,
    TooltipModule,
    TranslateModule
  ],
  providers: [ConfirmationService],
  templateUrl: './admin-promotions.component.html',
  styleUrl: './admin-promotions.component.scss'
})
export class AdminPromotionsComponent extends BaseAdminListComponent implements OnInit {
  allPromotions: Promotion[] = [];
  promotions: Promotion[] = [];
  paginatedPromotions: Promotion[] = [];

  // Status filter
  statusFilter: 'all' | 'active' | 'expired' | 'scheduled' = 'all';

  // Services
  private promotionService = inject(PromotionService);
  private toast = inject(ToastMessageService);
  private confirmationService = inject(ConfirmationService);
  private confirmDialog = inject(ConfirmationDialogService);
  private router = inject(Router);
  private translateService = inject(TranslateService);
  private currencyService = inject(CurrencyService);

  ngOnInit() {
    this.loadAllPromotions();

    this.translateService.onLangChange.subscribe(() => {
      this.filterItems();
    });
  }

  hasActiveFilters(): boolean {
    return !!(this.searchQuery?.trim() || this.statusFilter !== 'all');
  }

  // Status filter methods
  onStatusFilterChange(status: 'all' | 'active' | 'expired' | 'scheduled') {
    this.statusFilter = status;
    this.first = 0;
    this.filterItems();
  }

  getActiveCount(): number {
    return this.allPromotions.filter(p => this.getPromotionStatus(p) === 'active').length;
  }

  getExpiredCount(): number {
    return this.allPromotions.filter(p => this.getPromotionStatus(p) === 'expired').length;
  }

  getScheduledCount(): number {
    return this.allPromotions.filter(p => this.getPromotionStatus(p) === 'scheduled').length;
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
    this.loading = true;

    this.promotionService.getAllPromotions().subscribe({
      next: (promotions) => {
        this.allPromotions = promotions;
        this.promotions = promotions;
        this.updatePaginatedItems();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading promotions:', error);
        this.loading = false;
        this.toast.showError('admin.promotions.load_error');
      }
    });
  }

  filterItems(): void {
    let filtered = [...this.allPromotions];

    // Status filter
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
    this.router.navigate([ROUTES.ADMIN.ADD_PROMOTION]);
  }

  editPromotion(promotion: Promotion) {
    this.router.navigate([RouteHelpers.adminEditPromotion(promotion.id)]);
  }

  confirmDeletePromotion(promotion: Promotion) {
    this.confirmDialog.confirmDelete(
      this.confirmationService,
      promotion.name,
      () => this.deletePromotion(promotion)
    );
  }

  deletePromotion(promotion: Promotion) {
    this.promotionService.deletePromotion(promotion.id).subscribe({
      next: () => {
        this.toast.showSuccess('admin.promotions.delete_success');
        this.allPromotions = this.allPromotions.filter(p => p.id !== promotion.id);
        this.filterItems();
      },
      error: (error) => {
        console.error('Error deleting promotion:', error);
        this.toast.showApiError(error, 'admin.promotions.delete_failed');
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
