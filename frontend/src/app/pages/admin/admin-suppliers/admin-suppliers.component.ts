import { Component, OnInit, inject, DestroyRef, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConfirmationService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';

import { ADMIN_LIST_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { TableSkeletonComponent, SkeletonColumn } from '../../../shared/components/table-skeleton/table-skeleton.component';
import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { ConfirmationDialogService } from '../../../core/services/confirmation-dialog.service';
import { BaseAdminListComponent, ColumnOption } from '../../../shared/base/base-admin-list.component';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { SupplierService } from '../../../core/services/supplier.service';
import { Supplier } from '../../../models/supplier.model';

@Component({
  selector: 'app-admin-suppliers',
  standalone: true,
  imports: [
    ...ADMIN_LIST_IMPORTS,
    TableSkeletonComponent,
    AgroclikPageContainerComponent
  ],
  providers: [ConfirmationService],
  templateUrl: './admin-suppliers.component.html',
  styleUrl: './admin-suppliers.component.scss'
})
export class AdminSuppliersComponent extends BaseAdminListComponent implements OnInit {
  // Data signals
  allSuppliers = signal<Supplier[]>([]);
  suppliers = signal<Supplier[]>([]);
  paginatedSuppliers = signal<Supplier[]>([]);

  // Computed counts
  activeCount = computed(() => this.allSuppliers().filter(s => s.is_active).length);
  inactiveCount = computed(() => this.allSuppliers().filter(s => !s.is_active).length);

  // Skeleton configuration
  skeletonColumns: SkeletonColumn[] = [
    { width: '20%', type: 'text', headerWidth: '80px' },
    { width: '15%', type: 'text', headerWidth: '80px' },
    { width: '15%', type: 'text', headerWidth: '80px' },
    { width: '15%', type: 'text', headerWidth: '60px' },
    { width: '10%', type: 'pill', headerWidth: '60px' },
    { width: '15%', type: 'actions', headerWidth: '60px' }
  ];

  // Column visibility options
  override columnOptions: ColumnOption[] = [
    { field: 'name', label: 'admin.suppliers.table.name', visible: true },
    { field: 'contact', label: 'admin.suppliers.table.contact', visible: true },
    { field: 'phone', label: 'admin.suppliers.table.phone', visible: true },
    { field: 'city', label: 'admin.suppliers.table.city', visible: true },
    { field: 'status', label: 'admin.suppliers.table.status', visible: true },
    { field: 'actions', label: 'admin.suppliers.table.actions', visible: true }
  ];

  private supplierService = inject(SupplierService);
  private confirmationService = inject(ConfirmationService);
  private confirmDialog = inject(ConfirmationDialogService);
  private destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);

  ngOnInit() {
    this.loadSuppliers();
  }

  loadSuppliers(): void {
    this.loading = true;
    this.supplierService.getSuppliers(false)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (suppliers) => {
          const sorted = this.sortByCreatedAt(suppliers);
          this.allSuppliers.set(sorted);
          this.suppliers.set(sorted);
          this.updatePaginatedItems();
          this.loading = false;
          this.markTableInitialized();
        },
        error: () => {
          this.allSuppliers.set([]);
          this.suppliers.set([]);
          this.loading = false;
          this.baseToast.showError(this.translate.instant('admin.suppliers.load_error'));
        }
      });
  }

  hasActiveFilters(): boolean {
    return !!(this.searchQuery?.trim()) || this.statusFilter !== 'all';
  }

  filterItems(): void {
    let filtered = this.filterByActiveStatus(this.allSuppliers());

    if (this.hasSearchQuery()) {
      const search = this.searchQuery.toLowerCase();
      filtered = filtered.filter(supplier =>
        supplier.name.toLowerCase().includes(search) ||
        (supplier.contact_person?.toLowerCase().includes(search) || false) ||
        (supplier.phone?.toLowerCase().includes(search) || false) ||
        (supplier.city?.toLowerCase().includes(search) || false)
      );
    }

    this.suppliers.set(filtered);
    this.resetPagination();
    this.updatePaginatedItems();
  }

  updatePaginatedItems(): void {
    this.paginatedSuppliers.set(this.suppliers().slice(this.first, this.first + this.rows));
  }

  getSearchDebounceKey(): string {
    return 'suppliers-search';
  }

  override clearFilters() {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.filterItems();
  }

  createNewSupplier(): void {
    this.baseRouter.navigate([ROUTES.ADMIN.ADD_SUPPLIER]);
  }

  viewSupplier(supplier: Supplier): void {
    this.baseRouter.navigate([RouteHelpers.adminSupplierDetail(supplier.id)]);
  }

  editSupplier(supplier: Supplier): void {
    this.baseRouter.navigate([RouteHelpers.adminEditSupplier(supplier.id)]);
  }

  confirmDeleteSupplier(supplier: Supplier): void {
    this.confirmDialog.confirmDelete(
      this.confirmationService,
      supplier.name,
      () => this.deleteSupplier(supplier)
    );
  }

  deleteSupplier(supplier: Supplier): void {
    this.handleDeleteWithSignal(
      () => this.supplierService.deleteSupplier(supplier.id),
      this.allSuppliers,
      supplier.id,
      this.translate.instant('admin.suppliers.delete_success'),
      this.translate.instant('admin.suppliers.delete_error')
    );
  }
}
