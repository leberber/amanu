// src/app/pages/admin/admin-promotions/admin-promotions.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TagModule } from 'primeng/tag';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
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
    TableModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    ToastModule,
    TagModule,
    ConfirmDialogModule,
    IconFieldModule,
    InputIconModule,
    TooltipModule,
    ProgressSpinnerModule,
    TranslateModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './admin-promotions.component.html',
  styles: [`
    :host ::ng-deep .p-datatable-header {
      padding-left: 0 !important;
      padding-right: 0 !important;
    }
  `]
})
export class AdminPromotionsComponent implements OnInit {
  allPromotions: Promotion[] = [];
  promotions: Promotion[] = [];
  loading = true;
  searchQuery = '';

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
    return !!(this.searchQuery?.trim());
  }

  loadAllPromotions() {
    this.loading = true;

    this.promotionService.getAllPromotions().subscribe({
      next: (promotions) => {
        this.allPromotions = promotions;
        this.promotions = promotions;
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

    if (this.searchQuery?.trim()) {
      const search = this.searchQuery.toLowerCase();
      filtered = filtered.filter(promotion =>
        promotion.name.toLowerCase().includes(search) ||
        promotion.code?.toLowerCase().includes(search) ||
        promotion.description?.toLowerCase().includes(search)
      );
    }

    this.promotions = filtered;
  }

  onSearchInput() {
    this.searchDebounce.debounce('promotions-search', () => {
      this.filterPromotions();
    });
  }

  clearFilters() {
    this.searchQuery = '';
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

  getStatusSeverity(promotion: Promotion): 'success' | 'danger' | 'warn' {
    if (!promotion.is_active) return 'danger';

    const now = new Date();
    const startDate = new Date(promotion.start_date);
    const endDate = new Date(promotion.end_date);

    if (now < startDate) return 'warn'; // Scheduled
    if (now > endDate) return 'danger'; // Expired
    return 'success'; // Active
  }

  getStatusLabel(promotion: Promotion): string {
    if (!promotion.is_active) {
      return this.translateService.instant('admin.promotions.status.inactive');
    }

    const now = new Date();
    const startDate = new Date(promotion.start_date);
    const endDate = new Date(promotion.end_date);

    if (now < startDate) {
      return this.translateService.instant('admin.promotions.status.scheduled');
    }
    if (now > endDate) {
      return this.translateService.instant('admin.promotions.status.expired');
    }
    return this.translateService.instant('admin.promotions.status.active');
  }

  getUsageDisplay(promotion: Promotion): string {
    if (promotion.usage_limit) {
      return `${promotion.usage_count} / ${promotion.usage_limit}`;
    }
    return `${promotion.usage_count}`;
  }
}
