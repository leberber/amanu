import { Component, OnInit, inject, DestroyRef, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { PopoverModule } from 'primeng/popover';
import { InputTextModule } from 'primeng/inputtext';
import { ColorPickerModule } from 'primeng/colorpicker';
import { TranslateService } from '@ngx-translate/core';

import { ADMIN_LIST_IMPORTS, ADMIN_DIALOG_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { InlineEditState } from '../../../shared/utils/inline-edit-state';
import { TableSkeletonComponent, SkeletonColumn } from '../../../shared/components/table-skeleton/table-skeleton.component';
import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { BreakpointService } from '../../../core/services/breakpoint.service';
import { onLanguageChange } from '../../../core/utils/language-change.util';
import { UserGroupService } from '../../../core/services/user-group.service';
import { UserGroup, UserGroupCreate, UserGroupUpdate } from '../../../models/user-group.model';
import { ConfirmationDialogService } from '../../../core/services/confirmation-dialog.service';
import { BaseAdminListComponent, ColumnOption } from '../../../shared/base/base-admin-list.component';

@Component({
  selector: 'app-admin-user-groups',
  standalone: true,
  imports: [
    ...ADMIN_LIST_IMPORTS,
    ...ADMIN_DIALOG_IMPORTS,
    FormsModule,
    PopoverModule,
    InputTextModule,
    ColorPickerModule,
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

  // Add group dialog
  showAddDialog = signal(false);
  newGroupName = '';
  newGroupNameFr = '';
  newGroupNameAr = '';
  newGroupDescription = '';
  newGroupDescriptionFr = '';
  newGroupDescriptionAr = '';
  newGroupColor = '#3b82f6';
  savingGroup = signal(false);

  // Edit group dialog
  showEditDialog = signal(false);
  editingGroup = signal<UserGroup | null>(null);
  editGroupName = '';
  editGroupNameFr = '';
  editGroupNameAr = '';
  editGroupDescription = '';
  editGroupDescriptionFr = '';
  editGroupDescriptionAr = '';
  editGroupColor = '#3b82f6';

  // Services
  private userGroupService = inject(UserGroupService);
  private confirmationService = inject(ConfirmationService);
  private confirmDialog = inject(ConfirmationDialogService);
  private translateService = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private readonly breakpoint = inject(BreakpointService);

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

  // Dialog methods
  openAddDialog(): void {
    this.newGroupName = '';
    this.newGroupNameFr = '';
    this.newGroupNameAr = '';
    this.newGroupDescription = '';
    this.newGroupDescriptionFr = '';
    this.newGroupDescriptionAr = '';
    this.newGroupColor = '#3b82f6';
    this.showAddDialog.set(true);
  }

  closeAddDialog(): void {
    this.showAddDialog.set(false);
  }

  saveNewGroup(): void {
    if (!this.newGroupName.trim()) return;

    this.savingGroup.set(true);

    // Build name translations object
    const nameTranslations: Record<string, string> = {};
    if (this.newGroupNameFr.trim()) {
      nameTranslations['fr'] = this.newGroupNameFr.trim();
    }
    if (this.newGroupNameAr.trim()) {
      nameTranslations['ar'] = this.newGroupNameAr.trim();
    }

    // Build description translations object
    const descriptionTranslations: Record<string, string> = {};
    if (this.newGroupDescriptionFr.trim()) {
      descriptionTranslations['fr'] = this.newGroupDescriptionFr.trim();
    }
    if (this.newGroupDescriptionAr.trim()) {
      descriptionTranslations['ar'] = this.newGroupDescriptionAr.trim();
    }

    const newGroup: UserGroupCreate = {
      name: this.newGroupName.trim(),
      description: this.newGroupDescription.trim() || undefined,
      name_translations: Object.keys(nameTranslations).length > 0 ? nameTranslations : undefined,
      description_translations: Object.keys(descriptionTranslations).length > 0 ? descriptionTranslations : undefined,
      color: this.newGroupColor,
      is_active: true
    };

    this.userGroupService.createGroup(newGroup)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (group) => {
          this.allGroups.update(groups => [group, ...groups]);
          this.filterItems();
          this.savingGroup.set(false);
          this.closeAddDialog();
          this.baseToast.showSuccess('admin.user_groups.create_success');
        },
        error: () => {
          this.savingGroup.set(false);
          this.baseToast.showError('admin.user_groups.create_error');
        }
      });
  }

  openEditDialog(group: UserGroup): void {
    this.editingGroup.set(group);
    this.editGroupName = group.name;
    this.editGroupNameFr = group.name_translations?.['fr'] || '';
    this.editGroupNameAr = group.name_translations?.['ar'] || '';
    this.editGroupDescription = group.description || '';
    this.editGroupDescriptionFr = group.description_translations?.['fr'] || '';
    this.editGroupDescriptionAr = group.description_translations?.['ar'] || '';
    this.editGroupColor = group.color || '#3b82f6';
    this.showEditDialog.set(true);
  }

  closeEditDialog(): void {
    this.showEditDialog.set(false);
    this.editingGroup.set(null);
  }

  saveEditGroup(): void {
    const group = this.editingGroup();
    if (!group || !this.editGroupName.trim()) return;

    this.savingGroup.set(true);

    // Build name translations object
    const nameTranslations: Record<string, string> = {};
    if (this.editGroupNameFr.trim()) {
      nameTranslations['fr'] = this.editGroupNameFr.trim();
    }
    if (this.editGroupNameAr.trim()) {
      nameTranslations['ar'] = this.editGroupNameAr.trim();
    }

    // Build description translations object
    const descriptionTranslations: Record<string, string> = {};
    if (this.editGroupDescriptionFr.trim()) {
      descriptionTranslations['fr'] = this.editGroupDescriptionFr.trim();
    }
    if (this.editGroupDescriptionAr.trim()) {
      descriptionTranslations['ar'] = this.editGroupDescriptionAr.trim();
    }

    const updateData: UserGroupUpdate = {
      name: this.editGroupName.trim(),
      description: this.editGroupDescription.trim() || undefined,
      name_translations: nameTranslations,
      description_translations: descriptionTranslations,
      color: this.editGroupColor
    };

    this.userGroupService.updateGroup(group.id, updateData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updatedGroup) => {
          this.allGroups.update(groups =>
            groups.map(g => g.id === updatedGroup.id ? updatedGroup : g)
          );
          this.filterItems();
          this.savingGroup.set(false);
          this.closeEditDialog();
          this.baseToast.showSuccess('admin.user_groups.update_success');
        },
        error: () => {
          this.savingGroup.set(false);
          this.baseToast.showError('admin.user_groups.update_error');
        }
      });
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
