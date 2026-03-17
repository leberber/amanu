import { Component, OnInit, inject, DestroyRef, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConfirmationService } from 'primeng/api';
import { PopoverModule } from 'primeng/popover';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { TranslateService } from '@ngx-translate/core';

import { ADMIN_LIST_IMPORTS, ADMIN_DIALOG_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { TableSkeletonComponent, SkeletonColumn } from '../../../shared/components/table-skeleton/table-skeleton.component';
import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { BreakpointService } from '../../../core/services/breakpoint.service';
import { onLanguageChange } from '../../../core/utils/language-change.util';
import { PromotionService } from '../../../services/promotion.service';
import { CrossSellPromotionService } from '../../../services/cross-sell-promotion.service';
import { VolumeDiscountService } from '../../../services/volume-discount.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { Promotion } from '../../../models/promotion.model';
import { CrossSellPromotion } from '../../../models/cross-sell-promotion.model';
import { VolumeDiscount } from '../../../models/volume-discount.model';
import { ConfirmationDialogService } from '../../../core/services/confirmation-dialog.service';
import { BaseAdminListComponent, ColumnOption } from '../../../shared/base/base-admin-list.component';

@Component({
  selector: 'app-admin-promotions',
  standalone: true,
  imports: [
    ...ADMIN_LIST_IMPORTS,
    ...ADMIN_DIALOG_IMPORTS,
    PopoverModule,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    TableSkeletonComponent,
    AgroclikPageContainerComponent
  ],
  providers: [ConfirmationService],
  templateUrl: './admin-promotions.component.html',
  styleUrl: './admin-promotions.component.scss'
})
export class AdminPromotionsComponent extends BaseAdminListComponent implements OnInit {
  // Active tab
  activeTabIndex = signal(0);

  // Data signals - Promo Codes
  allPromotions = signal<Promotion[]>([]);
  promotions = signal<Promotion[]>([]);
  paginatedPromotions = signal<Promotion[]>([]);

  // Data signals - Cross-Sell (Bundle Deals)
  allCrossSellPromotions = signal<CrossSellPromotion[]>([]);
  crossSellPromotions = signal<CrossSellPromotion[]>([]);
  paginatedCrossSellPromotions = signal<CrossSellPromotion[]>([]);
  crossSellLoading = signal(false);

  // Data signals - Volume Discounts
  allVolumeDiscounts = signal<VolumeDiscount[]>([]);
  volumeDiscounts = signal<VolumeDiscount[]>([]);
  paginatedVolumeDiscounts = signal<VolumeDiscount[]>([]);
  volumeDiscountLoading = signal(false);

  // Override status filter type for promotions (different from default active/inactive)
  override statusFilter: string = 'all';
  crossSellStatusFilter = 'all';
  volumeDiscountStatusFilter = 'all';

  // Pre-computed status counts - calculated once when data changes, not on every change detection
  private promotionStatusCounts = computed(() => {
    const counts = { active: 0, expired: 0, scheduled: 0 };
    for (const p of this.allPromotions()) {
      const status = this.getPromotionStatusPure(p);
      if (status in counts) counts[status as keyof typeof counts]++;
    }
    return counts;
  });

  activeCount = computed(() => this.promotionStatusCounts().active);
  expiredCount = computed(() => this.promotionStatusCounts().expired);
  scheduledCount = computed(() => this.promotionStatusCounts().scheduled);

  // Pre-computed cross-sell counts
  private crossSellStatusCounts = computed(() => {
    let active = 0, inactive = 0;
    for (const p of this.allCrossSellPromotions()) {
      if (this.getCrossSellStatusPure(p) === 'active') active++;
      if (!p.is_active) inactive++;
    }
    return { active, inactive };
  });

  crossSellActiveCount = computed(() => this.crossSellStatusCounts().active);
  crossSellInactiveCount = computed(() => this.crossSellStatusCounts().inactive);

  // Pre-computed volume discount counts
  private volumeDiscountStatusCounts = computed(() => {
    let active = 0, inactive = 0;
    for (const d of this.allVolumeDiscounts()) {
      if (this.getVolumeDiscountStatusPure(d) === 'active') active++;
      if (!d.is_active) inactive++;
    }
    return { active, inactive };
  });

  volumeDiscountActiveCount = computed(() => this.volumeDiscountStatusCounts().active);
  volumeDiscountInactiveCount = computed(() => this.volumeDiscountStatusCounts().inactive);

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

  // Column visibility options (initialized in ngOnInit)
  // MOBILE COLUMN VISIBILITY: On mobile, only show essential columns (name, discount, status)
  // Other columns can be toggled back from table options menu
  override columnOptions: ColumnOption[] = [];

  private getInitialColumnOptions(): ColumnOption[] {
    const isMobile = this.breakpoint.isMobile();

    return [
      { field: 'name', label: 'admin.promotions.table.name', visible: true },
      { field: 'code', label: 'admin.promotions.table.code', visible: !isMobile },
      { field: 'discount', label: 'admin.promotions.table.discount', visible: true },
      { field: 'scope', label: 'admin.promotions.table.scope', visible: !isMobile },
      { field: 'validity', label: 'admin.promotions.table.validity', visible: !isMobile },
      { field: 'usage', label: 'admin.promotions.table.usage', visible: !isMobile },
      { field: 'status', label: 'admin.promotions.table.status', visible: true },
      { field: 'actions', label: 'admin.promotions.table.actions', visible: !isMobile }
    ];
  }

  // Services
  private promotionService = inject(PromotionService);
  private crossSellService = inject(CrossSellPromotionService);
  private volumeDiscountService = inject(VolumeDiscountService);
  private confirmationService = inject(ConfirmationService);
  private confirmDialog = inject(ConfirmationDialogService);
  private translateService = inject(TranslateService);
  private currencyService = inject(CurrencyService);
  private destroyRef = inject(DestroyRef);
  private readonly breakpoint = inject(BreakpointService);

  ngOnInit() {
    this.columnOptions = this.getInitialColumnOptions();
    this.loadAllPromotions();
    this.loadAllCrossSellPromotions();
    this.loadAllVolumeDiscounts();
    onLanguageChange(this.translateService, this.destroyRef, () => {
      this.filterItems();
      this.filterCrossSellItems();
      this.filterVolumeDiscountItems();
    });
  }

  onTabChange(index: number | string): void {
    this.activeTabIndex.set(typeof index === 'number' ? index : parseInt(index, 10));
  }

  hasActiveFilters(): boolean {
    return !!(this.searchQuery?.trim() || this.statusFilter !== 'all');
  }

  getPromotionStatus(promotion: Promotion): 'active' | 'expired' | 'scheduled' | 'inactive' {
    return this.getPromotionStatusPure(promotion);
  }

  // Pure method for use in computed signals (no side effects)
  private getPromotionStatusPure(promotion: Promotion): 'active' | 'expired' | 'scheduled' | 'inactive' {
    if (!promotion.is_active) return 'inactive';

    const now = new Date();
    const startDate = new Date(promotion.start_date);
    const endDate = new Date(promotion.end_date);

    if (now < startDate) return 'scheduled';
    if (now > endDate) return 'expired';
    return 'active';
  }

  // Abstract method implementations
  updatePaginatedItems(): void {
    this.paginatedPromotions.set(this.promotions().slice(this.first, this.first + this.rows));
  }

  getSearchDebounceKey(): string {
    return 'promotions-search';
  }

  // Data loading
  loadAllPromotions(): void {
    this.loading = true;
    this.promotionService.getAllPromotions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (promotions) => {
          const sorted = this.sortByCreatedAt(promotions);
          this.allPromotions.set(sorted);
          this.promotions.set(sorted);
          this.updatePaginatedItems();
          this.loading = false;
          this.markTableInitialized();
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

  // ============================================
  // Cross-Sell (Bundle Deals) Methods
  // ============================================

  loadAllCrossSellPromotions(): void {
    this.crossSellLoading.set(true);
    this.crossSellService.getAllPromotions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (promotions) => {
          this.allCrossSellPromotions.set(promotions);
          this.crossSellPromotions.set(promotions);
          this.updatePaginatedCrossSellItems();
          this.crossSellLoading.set(false);
        },
        error: () => {
          this.allCrossSellPromotions.set([]);
          this.crossSellPromotions.set([]);
          this.crossSellLoading.set(false);
          this.baseToast.showError('admin.promotions.cross_sell.load_error');
        }
      });
  }

  filterCrossSellItems(): void {
    let filtered = [...this.allCrossSellPromotions()];

    if (this.crossSellStatusFilter !== 'all') {
      if (this.crossSellStatusFilter === 'active') {
        filtered = filtered.filter(p => this.getCrossSellStatus(p) === 'active');
      } else if (this.crossSellStatusFilter === 'inactive') {
        filtered = filtered.filter(p => !p.is_active);
      }
    }

    if (this.hasSearchQuery()) {
      const search = this.searchQuery.toLowerCase();
      filtered = filtered.filter(promotion =>
        promotion.name.toLowerCase().includes(search) ||
        promotion.target_product_name?.toLowerCase().includes(search)
      );
    }

    this.crossSellPromotions.set(filtered);
    this.updatePaginatedCrossSellItems();
  }

  updatePaginatedCrossSellItems(): void {
    this.paginatedCrossSellPromotions.set(
      this.crossSellPromotions().slice(this.first, this.first + this.rows)
    );
  }

  onCrossSellStatusFilterChange(status: string): void {
    this.crossSellStatusFilter = status;
    this.resetPagination();
    this.filterCrossSellItems();
  }

  getCrossSellStatus(promotion: CrossSellPromotion): 'active' | 'inactive' | 'scheduled' | 'expired' {
    return this.getCrossSellStatusPure(promotion);
  }

  // Pure method for use in computed signals
  private getCrossSellStatusPure(promotion: CrossSellPromotion): 'active' | 'inactive' | 'scheduled' | 'expired' {
    if (!promotion.is_active) return 'inactive';

    const now = new Date();

    if (promotion.start_date) {
      const startDate = new Date(promotion.start_date);
      if (now < startDate) return 'scheduled';
    }

    if (promotion.end_date) {
      const endDate = new Date(promotion.end_date);
      if (now > endDate) return 'expired';
    }

    return 'active';
  }

  getCrossSellStatusClass(promotion: CrossSellPromotion): string {
    return this.getCrossSellStatus(promotion);
  }

  getCrossSellStatusLabel(promotion: CrossSellPromotion): string {
    const status = this.getCrossSellStatus(promotion);
    return this.translateService.instant(`admin.promotions.status.${status}`);
  }

  getCrossSellDiscountDisplay(promotion: CrossSellPromotion): string {
    if (promotion.discount_type === 'percentage') {
      return `${promotion.discount_value}%`;
    }
    return this.currencyService.formatCurrency(promotion.discount_value);
  }

  createNewCrossSellPromotion(): void {
    this.baseRouter.navigate([ROUTES.ADMIN.ADD_CROSS_SELL_PROMOTION]);
  }

  editCrossSellPromotion(promotion: CrossSellPromotion): void {
    this.baseRouter.navigate([RouteHelpers.adminEditCrossSellPromotion(promotion.id)]);
  }

  confirmDeleteCrossSellPromotion(promotion: CrossSellPromotion): void {
    this.confirmDialog.confirmDelete(
      this.confirmationService,
      promotion.name,
      () => this.deleteCrossSellPromotion(promotion)
    );
  }

  deleteCrossSellPromotion(promotion: CrossSellPromotion): void {
    this.crossSellService.deletePromotion(promotion.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.allCrossSellPromotions.update(promos => promos.filter(p => p.id !== promotion.id));
          this.filterCrossSellItems();
          this.baseToast.showSuccess('admin.promotions.cross_sell.delete_success');
        },
        error: (error) => {
          this.baseToast.showApiError(error, 'admin.promotions.cross_sell.delete_failed');
        }
      });
  }

  refreshCrossSellData(): void {
    this.loadAllCrossSellPromotions();
  }

  // ============================================
  // Volume Discounts Methods
  // ============================================

  loadAllVolumeDiscounts(): void {
    this.volumeDiscountLoading.set(true);
    this.volumeDiscountService.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (discounts) => {
          this.allVolumeDiscounts.set(discounts);
          this.volumeDiscounts.set(discounts);
          this.updatePaginatedVolumeDiscountItems();
          this.volumeDiscountLoading.set(false);
        },
        error: () => {
          this.allVolumeDiscounts.set([]);
          this.volumeDiscounts.set([]);
          this.volumeDiscountLoading.set(false);
          this.baseToast.showError('admin.promotions.volume_discount.load_error');
        }
      });
  }

  filterVolumeDiscountItems(): void {
    let filtered = [...this.allVolumeDiscounts()];

    if (this.volumeDiscountStatusFilter !== 'all') {
      if (this.volumeDiscountStatusFilter === 'active') {
        filtered = filtered.filter(d => this.getVolumeDiscountStatus(d) === 'active');
      } else if (this.volumeDiscountStatusFilter === 'inactive') {
        filtered = filtered.filter(d => !d.is_active);
      }
    }

    if (this.hasSearchQuery()) {
      const search = this.searchQuery.toLowerCase();
      filtered = filtered.filter(discount =>
        discount.name.toLowerCase().includes(search) ||
        discount.product_name?.toLowerCase().includes(search) ||
        discount.description?.toLowerCase().includes(search)
      );
    }

    this.volumeDiscounts.set(filtered);
    this.updatePaginatedVolumeDiscountItems();
  }

  updatePaginatedVolumeDiscountItems(): void {
    this.paginatedVolumeDiscounts.set(
      this.volumeDiscounts().slice(this.first, this.first + this.rows)
    );
  }

  onVolumeDiscountStatusFilterChange(status: string): void {
    this.volumeDiscountStatusFilter = status;
    this.resetPagination();
    this.filterVolumeDiscountItems();
  }

  getVolumeDiscountStatus(discount: VolumeDiscount): 'active' | 'inactive' | 'scheduled' | 'expired' {
    return this.getVolumeDiscountStatusPure(discount);
  }

  // Pure method for use in computed signals
  private getVolumeDiscountStatusPure(discount: VolumeDiscount): 'active' | 'inactive' | 'scheduled' | 'expired' {
    if (!discount.is_active) return 'inactive';

    const now = new Date();

    if (discount.start_date) {
      const startDate = new Date(discount.start_date);
      if (now < startDate) return 'scheduled';
    }

    if (discount.end_date) {
      const endDate = new Date(discount.end_date);
      if (now > endDate) return 'expired';
    }

    return 'active';
  }

  getVolumeDiscountStatusClass(discount: VolumeDiscount): string {
    return this.getVolumeDiscountStatus(discount);
  }

  getVolumeDiscountStatusLabel(discount: VolumeDiscount): string {
    const status = this.getVolumeDiscountStatus(discount);
    return this.translateService.instant(`admin.promotions.status.${status}`);
  }

  getVolumeDiscountDisplay(discount: VolumeDiscount): string {
    switch (discount.discount_type) {
      case 'percentage':
        return `${discount.discount_value}%`;
      case 'fixed_amount':
        return this.currencyService.formatCurrency(discount.discount_value);
      case 'free_units':
        return `+${discount.discount_value}`;
      default:
        return `${discount.discount_value}`;
    }
  }

  getVolumeDiscountTypeLabel(discount: VolumeDiscount): string {
    return this.translateService.instant(`admin.promotions.volume_discount.type.${discount.discount_type}`);
  }

  createNewVolumeDiscount(): void {
    this.baseRouter.navigate([ROUTES.ADMIN.ADD_VOLUME_DISCOUNT]);
  }

  editVolumeDiscount(discount: VolumeDiscount): void {
    this.baseRouter.navigate([RouteHelpers.adminEditVolumeDiscount(discount.id)]);
  }

  confirmDeleteVolumeDiscount(discount: VolumeDiscount): void {
    this.confirmDialog.confirmDelete(
      this.confirmationService,
      discount.name,
      () => this.deleteVolumeDiscount(discount)
    );
  }

  deleteVolumeDiscount(discount: VolumeDiscount): void {
    this.volumeDiscountService.delete(discount.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.allVolumeDiscounts.update(discounts => discounts.filter(d => d.id !== discount.id));
          this.filterVolumeDiscountItems();
          this.baseToast.showSuccess('admin.promotions.volume_discount.delete_success');
        },
        error: (error) => {
          this.baseToast.showApiError(error, 'admin.promotions.volume_discount.delete_failed');
        }
      });
  }

  refreshVolumeDiscountData(): void {
    this.loadAllVolumeDiscounts();
  }
}
