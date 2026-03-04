import { Component, OnInit, inject, DestroyRef, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { PopoverModule } from 'primeng/popover';
import { TranslateService } from '@ngx-translate/core';

import { ADMIN_LIST_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { InlineEditState } from '../../../shared/utils/inline-edit-state';
import { TableSkeletonComponent, SkeletonColumn } from '../../../shared/components/table-skeleton/table-skeleton.component';
import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { BreakpointService } from '../../../core/services/breakpoint.service';
import { onLanguageChange } from '../../../core/utils/language-change.util';
import { UserGroupService } from '../../../core/services/user-group.service';
import { UserGroup } from '../../../models/user-group.model';
import { ConfirmationDialogService } from '../../../core/services/confirmation-dialog.service';
import { BaseAdminListComponent, ColumnOption } from '../../../shared/base/base-admin-list.component';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';

@Component({
  selector: 'app-admin-user-groups',
  standalone: true,
  imports: [
    ...ADMIN_LIST_IMPORTS,
    PopoverModule,
    TableSkeletonComponent,
    AgroclikPageContainerComponent
  ],
  providers: [ConfirmationService],
  templateUrl: './admin-user-groups.component.html',
  styleUrl: './admin-user-groups.component.scss'
})
export class AdminUserGroupsComponent extends BaseAdminListComponent implements OnInit {
  // Data signals
  allGroups = signal<UserGroup[]>([]);
  groups = signal<UserGroup[]>([]);

  // Computed counts
  activeCount = computed(() => this.allGroups().filter(g => g.is_active).length);
  inactiveCount = computed(() => this.allGroups().filter(g => !g.is_active).length);

  // Skeleton configuration
  skeletonColumns: SkeletonColumn[] = [
    { width: '5%', type: 'pill-sm', headerWidth: '0' },
    { width: '25%', type: 'text', headerWidth: '100px' },
    { width: '30%', type: 'text', headerWidth: '120px' },
    { width: '10%', type: 'pill', headerWidth: '60px' },
    { width: '15%', type: 'toggle', headerWidth: '60px' },
    { width: '15%', type: 'actions', headerWidth: '60px' }
  ];

  // Column visibility options
  override columnOptions: ColumnOption[] = [];

  private getInitialColumnOptions(): ColumnOption[] {
    const isMobile = this.breakpoint.isMobile();

    return [
      { field: 'color', label: 'admin.user_groups.table.color', visible: true },
      { field: 'name', label: 'admin.user_groups.table.name', visible: true },
      { field: 'description', label: 'admin.user_groups.table.description', visible: !isMobile },
      { field: 'users', label: 'admin.user_groups.table.users', visible: true },
      { field: 'status', label: 'admin.user_groups.table.status', visible: !isMobile },
      { field: 'actions', label: 'admin.user_groups.table.actions', visible: true }
    ];
  }

  // Inline editing state
  statusEdit = new InlineEditState<boolean>(true);

  // Services
  private userGroupService = inject(UserGroupService);
  private confirmationService = inject(ConfirmationService);
  private confirmDialog = inject(ConfirmationDialogService);
  private translateService = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private readonly breakpoint = inject(BreakpointService);
  private readonly router = inject(Router);

  ngOnInit() {
    this.columnOptions = this.getInitialColumnOptions();
    this.loadAllGroups();
    onLanguageChange(this.translateService, this.destroyRef, () => this.filterItems());
  }

  hasActiveFilters(): boolean {
    return !!(this.searchQuery?.trim()) || this.statusFilter !== 'all';
  }

  loadAllGroups(): void {
    this.loading = true;
    this.userGroupService.getGroups(false)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (groups) => {
          const sorted = this.sortByCreatedAt(groups);
          this.allGroups.set(sorted);
          this.groups.set(sorted);
          this.loading = false;
          this.markTableInitialized();
        },
        error: () => {
          this.allGroups.set([]);
          this.groups.set([]);
          this.loading = false;
          this.baseToast.showError('admin.user_groups.load_error');
        }
      });
  }

  // Abstract method implementations
  filterItems(): void {
    let filtered = this.filterByActiveStatus(this.allGroups());

    if (this.hasSearchQuery()) {
      const search = this.searchQuery.toLowerCase();
      filtered = filtered.filter(group =>
        group.name.toLowerCase().includes(search) ||
        (group.description?.toLowerCase().includes(search) ?? false)
      );
    }

    this.groups.set(filtered);
  }

  updatePaginatedItems(): void {
    // No pagination needed for groups
  }

  getSearchDebounceKey(): string {
    return 'user-groups-search';
  }

  override clearFilters() {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.filterItems();
  }

  // Navigation methods
  navigateToAdd(): void {
    this.router.navigate([ROUTES.ADMIN.ADD_USER_GROUP]);
  }

  navigateToEdit(group: UserGroup): void {
    this.router.navigate([RouteHelpers.adminEditUserGroup(group.id)]);
  }

  confirmDeleteGroup(group: UserGroup): void {
    this.confirmDialog.confirmDelete(
      this.confirmationService,
      group.name,
      () => this.deleteGroup(group)
    );
  }

  deleteGroup(group: UserGroup): void {
    this.userGroupService.deleteGroup(group.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.allGroups.update(groups => groups.filter(g => g.id !== group.id));
          this.filterItems();
          this.baseToast.showSuccess('admin.user_groups.delete_success');
        },
        error: () => {
          this.baseToast.showError('admin.user_groups.delete_error');
        }
      });
  }

  refreshData(): void {
    this.loadAllGroups();
  }

  // Inline status editing
  startEditStatus(group: UserGroup): void {
    this.statusEdit.start(group.id, group.is_active);
  }

  cancelEditStatus(): void {
    this.statusEdit.cancel();
  }

  isEditingStatus(groupId: number): boolean {
    return this.statusEdit.isEditing(groupId);
  }

  toggleEditingStatus(): void {
    this.statusEdit.value = !this.statusEdit.value;
  }

  saveStatus(group: UserGroup): void {
    if (!this.statusEdit.hasChanged(group.is_active)) {
      this.statusEdit.cancel();
      return;
    }

    const newStatus = this.statusEdit.value;

    this.userGroupService.updateGroup(group.id, { is_active: newStatus })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.allGroups.update(groups =>
            groups.map(g => g.id === group.id ? { ...g, is_active: newStatus } : g)
          );
          this.filterItems();
          this.statusEdit.cancel();
          this.baseToast.showSuccess(
            newStatus ? 'admin.user_groups.status_activated' : 'admin.user_groups.status_deactivated'
          );
        },
        error: () => {
          this.baseToast.showError('admin.user_groups.status_update_failed');
        }
      });
  }
}
