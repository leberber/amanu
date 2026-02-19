// src/app/pages/admin/admin-promotions/admin-promotions.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { PaginatorModule } from 'primeng/paginator';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { TooltipModule } from 'primeng/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { PromotionService } from '../../../services/promotion.service';
import { DateService } from '../../../core/services/date.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { SearchDebounceService } from '../../../core/services/search-debounce.service';
import { Promotion } from '../../../models/promotion.model';

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
  providers: [MessageService, ConfirmationService],
  templateUrl: './admin-promotions.component.html',
  styleUrl: './admin-promotions.component.scss'
})
export class AdminPromotionsComponent implements OnInit {
  allPromotions: Promotion[] = [];
  promotions: Promotion[] = [];
  paginatedPromotions: Promotion[] = [];
  loading = true;
  searchQuery = '';

  // Pagination
  first = 0;
  rows = 10;

  // Status filter
  statusFilter: 'all' | 'active' | 'expired' | 'scheduled' = 'all';

  private promotionService = inject(PromotionService);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private router = inject(Router);
  private translateService = inject(TranslateService);
  private dateService = inject(DateService);
  private currencyService = inject(CurrencyService);
  private searchDebounce = inject(SearchDebounceService);

  ngOnInit() {
    this.loadAllPromotions();

    this.translateService.onLangChange.subscribe(() => {
      this.filterPromotions();
    });
  }

  hasActiveFilters(): boolean {
    return !!(this.searchQuery?.trim() || this.statusFilter !== 'all');
  }

  // Status filter methods
  onStatusFilterChange(status: 'all' | 'active' | 'expired' | 'scheduled') {
    this.statusFilter = status;
    this.first = 0;
    this.filterPromotions();
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

  // Pagination methods
  onPageChange(event: any) {
    this.first = event.first;
    this.rows = event.rows;
    this.updatePaginatedPromotions();
  }

  updatePaginatedPromotions() {
    this.paginatedPromotions = this.promotions.slice(this.first, this.first + this.rows);
  }

  loadAllPromotions() {
    this.loading = true;

    this.promotionService.getAllPromotions().subscribe({
      next: (promotions) => {
        this.allPromotions = promotions;
        this.promotions = promotions;
        this.updatePaginatedPromotions();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading promotions:', error);
        this.loading = false;

        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: this.translateService.instant('admin.promotions.load_error')
        });
      }
    });
  }

  filterPromotions() {
    let filtered = [...this.allPromotions];

    // Status filter
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(p => this.getPromotionStatus(p) === this.statusFilter);
    }

    if (this.searchQuery?.trim()) {
      const search = this.searchQuery.toLowerCase();
      filtered = filtered.filter(promotion =>
        promotion.name.toLowerCase().includes(search) ||
        promotion.code?.toLowerCase().includes(search) ||
        promotion.description?.toLowerCase().includes(search)
      );
    }

    this.promotions = filtered;
    this.first = 0;
    this.updatePaginatedPromotions();
  }

  onSearchInput() {
    this.searchDebounce.debounce('promotions-search', () => {
      this.filterPromotions();
    });
  }

  clearFilters() {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.first = 0;
    this.filterPromotions();
  }

  createNewPromotion() {
    this.router.navigate(['/admin/promotions/add']);
  }

  editPromotion(promotion: Promotion) {
    this.router.navigate(['/admin/promotions/edit', promotion.id]);
  }

  confirmDeletePromotion(promotion: Promotion) {
    this.confirmationService.confirm({
      message: this.translateService.instant('common.confirm_delete_message', { item: promotion.name }),
      header: this.translateService.instant('common.confirm_delete'),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      acceptLabel: this.translateService.instant('common.delete'),
      rejectLabel: this.translateService.instant('common.cancel'),
      accept: () => this.deletePromotion(promotion)
    });
  }

  deletePromotion(promotion: Promotion) {
    this.promotionService.deletePromotion(promotion.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('common.success'),
          detail: this.translateService.instant('admin.promotions.delete_success')
        });

        this.allPromotions = this.allPromotions.filter(p => p.id !== promotion.id);
        this.filterPromotions();
      },
      error: (error) => {
        console.error('Error deleting promotion:', error);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: error.error?.detail || this.translateService.instant('admin.promotions.delete_failed')
        });
      }
    });
  }

  refreshPromotionData() {
    this.loadAllPromotions();
  }

  formatDate(dateString: string): string {
    return this.dateService.formatDate(dateString);
  }

  formatPrice(price: number): string {
    return this.currencyService.formatCurrency(price);
  }

  getDiscountDisplay(promotion: Promotion): string {
    if (promotion.discount_type === 'percentage') {
      return `${promotion.discount_value}%`;
    }
    return this.formatPrice(promotion.discount_value);
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
