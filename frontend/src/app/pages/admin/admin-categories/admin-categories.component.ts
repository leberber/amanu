import { Component, OnInit, inject, DestroyRef, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConfirmationService } from 'primeng/api';
import { PopoverModule } from 'primeng/popover';
import { TranslateService } from '@ngx-translate/core';

import { ADMIN_LIST_IMPORTS, ADMIN_DIALOG_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { InlineEditState } from '../../../shared/utils/inline-edit-state';
import { TableSkeletonComponent, SkeletonColumn } from '../../../shared/components/table-skeleton/table-skeleton.component';
import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { BreakpointService } from '../../../core/services/breakpoint.service';
import { onLanguageChange } from '../../../core/utils/language-change.util';
import { ProductService } from '../../../services/product.service';
import { TranslationHelperService } from '../../../core/services/translation-helper.service';
import { Category } from '../../../models/category.model';
import { ConfirmationDialogService } from '../../../core/services/confirmation-dialog.service';
import { BaseAdminListComponent, ColumnOption } from '../../../shared/base/base-admin-list.component';

@Component({
  selector: 'app-admin-categories',
  standalone: true,
  imports: [
    ...ADMIN_LIST_IMPORTS,
    ...ADMIN_DIALOG_IMPORTS,
    PopoverModule,
    TableSkeletonComponent,
    AgroclikPageContainerComponent
  ],
  providers: [ConfirmationService],
  templateUrl: './admin-categories.component.html',
  styleUrl: './admin-categories.component.scss'
})
export class AdminCategoriesComponent extends BaseAdminListComponent implements OnInit {
  // Data signals
  allCategories = signal<Category[]>([]);
  categories = signal<Category[]>([]);
  paginatedCategories = signal<Category[]>([]);

  // Product counts per category
  categoryProductCounts = signal<{ [categoryId: number]: number }>({});

  // Computed counts
  activeCount = computed(() => this.allCategories().filter(c => c.is_active).length);
  inactiveCount = computed(() => this.allCategories().filter(c => !c.is_active).length);

  // Skeleton configuration
  skeletonColumns: SkeletonColumn[] = [
    { width: '8%', type: 'image', headerWidth: '0' },
    { width: '30%', type: 'text-multi', headerWidth: '100px' },
    { width: '15%', type: 'pill', headerWidth: '80px' },
    { width: '15%', type: 'toggle', headerWidth: '60px' },
    { width: '15%', type: 'text', headerWidth: '70px' },
    { width: '17%', type: 'actions', headerWidth: '60px' }
  ];

  // Column visibility options (initialized in ngOnInit)
  // MOBILE COLUMN VISIBILITY: On mobile, only show essential columns (name, products, status)
  // Other columns can be toggled back from table options menu
  override columnOptions: ColumnOption[] = [];

  private getInitialColumnOptions(): ColumnOption[] {
    const isMobile = this.breakpoint.isMobile();

    return [
      { field: 'image', label: 'admin.categories.table.image', visible: !isMobile },
      { field: 'name', label: 'admin.categories.table.name', visible: true },
      { field: 'products', label: 'admin.categories.table.products', visible: true },
      { field: 'status', label: 'admin.categories.table.status', visible: true },
      { field: 'created', label: 'admin.categories.table.created', visible: !isMobile },
      { field: 'actions', label: 'admin.categories.table.actions', visible: !isMobile }
    ];
  }

  // Inline editing state
  statusEdit = new InlineEditState<boolean>(true);

  // Services
  private productService = inject(ProductService);
  private confirmationService = inject(ConfirmationService);
  private confirmDialog = inject(ConfirmationDialogService);
  private translationHelper = inject(TranslationHelperService);
  private translateService = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private readonly breakpoint = inject(BreakpointService);

  ngOnInit() {
    this.columnOptions = this.getInitialColumnOptions();
    this.loadAllCategories();
    onLanguageChange(this.translateService, this.destroyRef, () => this.filterItems());
  }

  hasActiveFilters(): boolean {
    return !!(this.searchQuery?.trim()) || this.statusFilter !== 'all';
  }

  loadAllCategories(): void {
    this.loading = true;
    this.productService.getCategories(false)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories) => {
          const sorted = this.sortByCreatedAt(categories);
          this.allCategories.set(sorted);
          this.categories.set(sorted);
          this.loadProductCounts();
          this.updatePaginatedItems();
          this.loading = false;
          this.markTableInitialized();
        },
        error: () => {
          this.allCategories.set([]);
          this.categories.set([]);
          this.loading = false;
          this.baseToast.showError('admin.categories.load_error');
        }
      });
  }

  loadProductCounts(): void {
    this.allCategories().forEach(category => {
      this.productService.getProductsByCategory(category.id, false)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (products) => {
            this.categoryProductCounts.update(counts => ({
              ...counts,
              [category.id]: products.length
            }));
          },
          error: () => {
            this.categoryProductCounts.update(counts => ({
              ...counts,
              [category.id]: 0
            }));
          }
        });
    });
  }

  // Abstract method implementations
  filterItems(): void {
    // Apply status filter using base class helper
    let filtered = this.filterByActiveStatus(this.allCategories());

    // Apply search filter
    if (this.hasSearchQuery()) {
      const search = this.searchQuery.toLowerCase();
      filtered = filtered.filter(category =>
        this.getCategoryName(category).toLowerCase().includes(search) ||
        this.getCategoryDescription(category).toLowerCase().includes(search)
      );
    }

    this.categories.set(filtered);
    this.resetPagination();
    this.updatePaginatedItems();
  }

  updatePaginatedItems(): void {
    this.paginatedCategories.set(this.categories().slice(this.first, this.first + this.rows));
  }

  getSearchDebounceKey(): string {
    return 'categories-search';
  }

  // Component-specific methods
  override clearFilters() {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.filterItems();
  }

  createNewCategory() {
    this.baseRouter.navigate([ROUTES.ADMIN.ADD_CATEGORY]);
  }

  editCategory(category: Category) {
    this.baseRouter.navigate([RouteHelpers.adminEditCategory(category.id)]);
  }

  confirmDeleteCategory(category: Category) {
    this.confirmDialog.confirmDelete(
      this.confirmationService,
      this.getCategoryName(category),
      () => this.deleteCategory(category)
    );
  }

  deleteCategory(category: Category): void {
    this.handleDeleteWithSignal(
      () => this.productService.deleteCategory(category.id),
      this.allCategories,
      category.id,
      'admin.categories.delete_success',
      'admin.categories.delete_failed'
    );
  }

  refreshCategoryData() {
    this.loadAllCategories();
  }

  // Inline status editing (using base class helpers)
  startEditStatus(category: Category): void {
    this.startStatusEdit(this.statusEdit, category);
  }

  cancelEditStatus(): void {
    this.cancelStatusEdit(this.statusEdit);
  }

  isEditingStatus(categoryId: number): boolean {
    return this.isEditingStatusFor(this.statusEdit, categoryId);
  }

  toggleEditingStatus(): void {
    this.toggleStatusEditValue(this.statusEdit);
  }

  saveStatus(category: Category): void {
    this.saveStatusChange(
      this.statusEdit,
      category,
      (id, data) => this.productService.updateCategory(id, data),
      this.allCategories,
      'admin.categories.status_activated',
      'admin.categories.status_deactivated',
      'admin.categories.status_update_failed'
    );
  }

  getCategoryProductCount(categoryId: number): number {
    return this.categoryProductCounts()[categoryId] || 0;
  }

  getCategoryName(category: Category): string {
    return this.translationHelper.getCategoryName(category);
  }

  getCategoryDescription(category: Category): string {
    return this.translationHelper.getCategoryDescription(category);
  }
}
