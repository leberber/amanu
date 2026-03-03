import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import { PopoverModule } from 'primeng/popover';
import { TranslateService } from '@ngx-translate/core';

import { ADMIN_LIST_IMPORTS, ADMIN_DIALOG_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { TableSkeletonComponent, SkeletonColumn } from '../../../shared/components/table-skeleton/table-skeleton.component';
import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { ROUTES } from '../../../core/constants/routes.constants';
import { BreakpointService } from '../../../core/services/breakpoint.service';
import { USER_ROLES } from '../../../core/constants/user.constants';
import { onLanguageChange } from '../../../core/utils/language-change.util';
import { AdminService } from '../../../services/admin.service';
import { UserManage, UsersResponse } from '../../../models/admin.model';
import { BaseAdminListComponent, ColumnOption } from '../../../shared/base/base-admin-list.component';
import { DateFormatPipe } from '../../../shared/pipes/date-format.pipe';
import { InlineEditState } from '../../../shared/utils/inline-edit-state';
import { ConfirmationDialogService } from '../../../core/services/confirmation-dialog.service';
import { StatusSeverityService } from '../../../core/services/status-severity.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    ...ADMIN_LIST_IMPORTS,
    ...ADMIN_DIALOG_IMPORTS,
    SelectModule,
    PopoverModule,
    DateFormatPipe,
    TableSkeletonComponent,
    AgroclikPageContainerComponent
  ],
  providers: [ConfirmationService],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss'
})
export class AdminUsersComponent extends BaseAdminListComponent implements OnInit {
  // Data properties
  allUsers: UserManage[] = [];
  users: UserManage[] = [];
  totalRecords = 0;

  // Skeleton configuration
  skeletonColumns: SkeletonColumn[] = [
    { width: '8%', type: 'pill-sm', headerWidth: '30px' },
    { width: '30%', type: 'text-multi', headerWidth: '100px' },
    { width: '15%', type: 'pill', headerWidth: '60px' },
    { width: '15%', type: 'toggle', headerWidth: '60px' },
    { width: '15%', type: 'text', headerWidth: '70px' },
    { width: '17%', type: 'actions', headerWidth: '60px' }
  ];

  // Column visibility options (initialized in ngOnInit)
  // MOBILE COLUMN VISIBILITY: On mobile, only show essential columns (user, role, status)
  // Other columns can be toggled back from table options menu
  override columnOptions: ColumnOption[] = [];

  private getInitialColumnOptions(): ColumnOption[] {
    const isMobile = this.breakpoint.isMobile();

    return [
      { field: 'id', label: 'admin.users.table.id', visible: !isMobile },
      { field: 'details', label: 'admin.users.table.user', visible: true },
      { field: 'role', label: 'admin.users.table.role', visible: true },
      { field: 'status', label: 'admin.users.table.status', visible: true },
      { field: 'created', label: 'admin.users.table.created', visible: !isMobile },
      { field: 'actions', label: 'admin.users.table.actions', visible: !isMobile }
    ];
  }

  // Role segment filter (different from status filter)
  roleFilter: 'all' | 'customer' | 'staff' | 'admin' = 'all';

  // Inline editing state
  roleEdit = new InlineEditState<string>('');
  statusEdit = new InlineEditState<boolean>(true);

  // Role options for dropdown
  roleOptions: { label: string; value: string }[] = [];

  // Services
  private adminService = inject(AdminService);
  private translateService = inject(TranslateService);
  private confirmationService = inject(ConfirmationService);
  private confirmDialog = inject(ConfirmationDialogService);
  private statusService = inject(StatusSeverityService);
  private destroyRef = inject(DestroyRef);
  private readonly breakpoint = inject(BreakpointService);

  ngOnInit(): void {
    this.columnOptions = this.getInitialColumnOptions();
    this.initializeOptions();
    this.loadAllUsers();
    onLanguageChange(this.translateService, this.destroyRef, () => this.initializeOptions());
  }

  initializeOptions() {
    this.roleOptions = this.statusService.getRoleOptions();
  }

  // Data loading
  loadAllUsers(): void {
    this.loading = true;
    this.adminService.getAllUsers(1, 1000).subscribe({
      next: (response: UsersResponse) => {
        const users = response.users || [];
        this.allUsers = this.sortByCreatedAt(users);
        this.filterItems();
        this.loading = false;
        this.markTableInitialized();
      },
      error: (error) => this.handleLoadError(error)
    });
  }

  private handleLoadError(error: any): void {
    this.loading = false;

    if (error.status === 403) {
      this.baseToast.showPermissionDenied();
      this.baseRouter.navigate([ROUTES.HOME]);
    } else {
      this.baseToast.showError('admin.users.load_error');
    }

    this.allUsers = [];
    this.users = [];
    this.totalRecords = 0;
  }

  // Role segment filter
  onRoleFilterChange(role: 'all' | 'customer' | 'staff' | 'admin'): void {
    this.roleFilter = role;
    this.filterItems();
  }

  getCustomerCount(): number {
    return this.getCountByPredicate(this.allUsers, u => u.role === USER_ROLES.CUSTOMER);
  }

  getStaffCount(): number {
    return this.getCountByPredicate(this.allUsers, u => u.role === USER_ROLES.STAFF);
  }

  getAdminCount(): number {
    return this.getCountByPredicate(this.allUsers, u => u.role === USER_ROLES.ADMIN);
  }

  // Status filter counts
  getActiveCount(): number {
    return this.getCountByPredicate(this.allUsers, u => u.is_active);
  }

  getInactiveCount(): number {
    return this.getCountByPredicate(this.allUsers, u => !u.is_active);
  }

  // Abstract method implementations
  filterItems(): void {
    // Apply status filter (active/inactive) using base class helper
    let filtered = this.filterByActiveStatus(this.allUsers);

    // Apply role filter from segment
    if (this.roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === this.roleFilter);
    }

    // Apply search filter
    if (this.hasSearchQuery()) {
      const search = this.searchQuery.toLowerCase();
      filtered = filtered.filter(user =>
        user.full_name?.toLowerCase().includes(search) ||
        user.email?.toLowerCase().includes(search) ||
        user.role?.toLowerCase().includes(search)
      );
    }

    this.users = filtered;
    this.totalRecords = filtered.length;
  }

  updatePaginatedItems(): void {
    // No pagination in users component - displays all filtered users
  }

  getSearchDebounceKey(): string {
    return 'users-search';
  }

  // Component-specific methods
  hasActiveFilters(): boolean {
    return this.hasSearchQuery() || this.roleFilter !== 'all' || this.statusFilter !== 'all';
  }

  override clearFilters(): void {
    this.searchQuery = '';
    this.roleFilter = 'all';
    this.statusFilter = 'all';
    this.filterItems();
  }

  // Navigation
  createNewUser(): void {
    this.baseRouter.navigate([ROUTES.REGISTER]);
  }

  navigateToEditUser(user: UserManage): void {
    this.baseRouter.navigate([ROUTES.ADMIN.USERS, user.id, 'edit']);
  }

  // User deletion
  confirmDeleteUser(user: UserManage): void {
    this.confirmDialog.confirmDelete(
      this.confirmationService,
      user.full_name,
      () => this.deleteUser(user)
    );
  }

  private deleteUser(user: UserManage): void {
    this.handleDelete(
      () => this.adminService.deleteUser(user.id),
      this.allUsers,
      user.id,
      (updated) => { this.allUsers = updated; },
      'admin.users.messages.user_deleted_detail',
      'admin.users.messages.deletion_failed_detail'
    );
  }

  // Inline role editing
  startEditRole(user: UserManage): void {
    this.statusEdit.cancel(); // Cancel any status edit
    this.roleEdit.start(user.id, user.role);
  }

  cancelEditRole(): void {
    this.roleEdit.cancel();
  }

  isEditingRole(userId: number): boolean {
    return this.roleEdit.isEditing(userId);
  }

  saveRole(user: UserManage): void {
    if (!this.roleEdit.hasChanged(user.role)) {
      this.roleEdit.cancel();
      return;
    }

    const newRole = this.roleEdit.value;

    this.adminService.updateUser(user.id, { role: newRole }).subscribe({
      next: () => {
        // Update in allUsers
        const index = this.allUsers.findIndex(u => u.id === user.id);
        if (index !== -1) {
          this.allUsers[index].role = newRole;
        }
        // Update in filtered users
        const displayIndex = this.users.findIndex(u => u.id === user.id);
        if (displayIndex !== -1) {
          this.users[displayIndex].role = newRole;
        }

        this.baseToast.showSuccess('admin.users.messages.role_updated', { name: user.full_name });
        this.roleEdit.cancel();
      },
      error: () => {
        this.baseToast.showError('admin.users.messages.update_failed_detail');
      }
    });
  }

  getRoleLabel(role: string): string {
    return this.translateService.instant(`admin.users.roles.${role}`);
  }

  // Inline status editing
  startEditStatus(user: UserManage): void {
    this.roleEdit.cancel(); // Cancel any role edit
    this.statusEdit.start(user.id, user.is_active);
  }

  cancelEditStatus(): void {
    this.statusEdit.cancel();
  }

  isEditingStatus(userId: number): boolean {
    return this.statusEdit.isEditing(userId);
  }

  toggleEditingStatus(): void {
    this.statusEdit.value = !this.statusEdit.value;
  }

  saveStatus(user: UserManage): void {
    if (!this.statusEdit.hasChanged(user.is_active)) {
      this.statusEdit.cancel();
      return;
    }

    const newStatus = this.statusEdit.value;

    this.adminService.updateUser(user.id, { is_active: newStatus }).subscribe({
      next: () => {
        // Update in allUsers
        const index = this.allUsers.findIndex(u => u.id === user.id);
        if (index !== -1) {
          this.allUsers[index].is_active = newStatus;
        }
        // Update in filtered users
        const displayIndex = this.users.findIndex(u => u.id === user.id);
        if (displayIndex !== -1) {
          this.users[displayIndex].is_active = newStatus;
        }

        this.baseToast.showSuccess('admin.users.messages.status_updated', { name: user.full_name });
        this.statusEdit.cancel();
      },
      error: () => {
        this.baseToast.showError('admin.users.messages.update_failed_detail');
      }
    });
  }

  // UI utilities
  refreshUserData(): void {
    this.loadAllUsers();
  }
}
