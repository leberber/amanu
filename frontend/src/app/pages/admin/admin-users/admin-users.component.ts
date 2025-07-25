// src/app/pages/admin/admin-users/admin-users.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TagModule } from 'primeng/tag';
import { PaginatorModule } from 'primeng/paginator';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { CheckboxModule } from 'primeng/checkbox';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AdminService } from '../../../services/admin.service';
import { UserManage, UsersResponse } from '../../../models/admin.model';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    ToastModule,
    TagModule,
    PaginatorModule,
    DialogModule,
    ConfirmDialogModule,
    CheckboxModule,
    PasswordModule,
    SelectModule,
    IconFieldModule,
    InputIconModule,
    TooltipModule,
    ProgressSpinnerModule,
    TranslateModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss',
  styles: [`
    :host ::ng-deep .p-datatable-header {
      padding-left: 0 !important;
      padding-right: 0 !important;
    }
  `]
})
export class AdminUsersComponent implements OnInit {
  // Data properties
  allUsers: UserManage[] = [];
  users: UserManage[] = [];
  totalRecords = 0;
  
  
  // UI state
  loading = true;
  searchQuery = '';
  filterRole = '';
  page = 1;
  pageSize = 10;
  
  // Dialog state
  selectedUser: UserManage | null = null;
  displayUserDialog = false;
  isEditing = false;
  
  // Form
  userForm: FormGroup;
  
  // Options
  roleOptions = [
    { label: 'All Roles', value: '' },
    { label: 'Customer', value: 'customer' },
    { label: 'Staff', value: 'staff' },
    { label: 'Admin', value: 'admin' }
  ];
  
  // Private properties
  private searchTimeout: any;
  
  constructor(
    private adminService: AdminService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private fb: FormBuilder,
    private router: Router,
    private translateService: TranslateService
  ) {
    this.userForm = this.createUserForm();
  }

  ngOnInit(): void {
    this.loadAllUsers();
  }

  // ===== FORM SETUP =====
  
  private createUserForm(): FormGroup {
    return this.fb.group({
      full_name: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      address: [''],
      role: ['customer', Validators.required],
      is_active: [true],
      password: ['', [Validators.minLength(8)]]
    });
  }

  // ===== DATA LOADING =====
  
  loadAllUsers(): void {
    this.loading = true;
    console.log('Starting to load users...');
    
    this.adminService.getAllUsers(1, 1000).subscribe({
      next: (response: UsersResponse) => {
        console.log('Raw API response:', response);
        console.log('Users in response:', response.users);
        console.log('Total in response:', response.total);
        
        this.allUsers = response.users || [];
        this.users = response.users || [];
        this.totalRecords = response.total || 0;
        
        console.log('Final users array length:', this.users.length);
        console.log('Final users array:', this.users);
        
        this.loading = false;
      },
      error: (error) => this.handleLoadError(error)
    });
  }

  private handleLoadError(error: any): void {
    console.error('Error loading users:', error);
    console.error('Error status:', error.status);
    console.error('Error details:', error.error);
    
    this.loading = false;
    
    let errorMessage = 'Failed to load users';
    if (error.status === 403) {
      errorMessage = 'You do not have permission to access this page';
      this.router.navigate(['/']);
    }
    
    this.messageService.add({
      severity: 'error',
      summary: 'Error',
      detail: errorMessage
    });
    
    // Reset data on error
    this.allUsers = [];
    this.users = [];
    this.totalRecords = 0;
  }

  // ===== FILTERING =====
  
  hasActiveFilters(): boolean {
    return !!(this.searchQuery?.trim() || this.filterRole);
  }

  filterUsers(): void {
    let filtered = [...this.allUsers];

    // Apply search filter
    if (this.searchQuery?.trim()) {
      const search = this.searchQuery.toLowerCase();
      filtered = filtered.filter(user => 
        user.full_name?.toLowerCase().includes(search) ||
        user.email?.toLowerCase().includes(search) ||
        user.role?.toLowerCase().includes(search)
      );
    }

    // Apply role filter
    if (this.filterRole) {
      filtered = filtered.filter(user => user.role === this.filterRole);
    }

    this.users = filtered;
    this.totalRecords = filtered.length;
    
    console.log(`Filtered ${filtered.length} users from ${this.allUsers.length} total`);
  }

  onSearchInput(): void {
    // Clear previous timeout if user is still typing
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    // Set new timeout to filter after 300ms of no typing
    this.searchTimeout = setTimeout(() => {
      this.filterUsers();
    }, 300);
  }

  onRoleChange(): void {
    this.filterUsers();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.filterRole = '';
    this.filterUsers();
  }

  // ===== USER DIALOG MANAGEMENT =====
  
  openUserDetails(user: UserManage): void {
    this.selectedUser = user;
    this.isEditing = true;
    
    this.userForm.patchValue({
      full_name: user.full_name,
      email: user.email,
      phone: user.phone || '',
      address: user.address || '',
      role: user.role,
      is_active: user.is_active,
      password: '' // Never patch password for security
    });
    
    // Disable email field in edit mode
    this.userForm.get('email')?.disable();
    
    this.displayUserDialog = true;
  }

  createNewUser(): void {
    this.selectedUser = null;
    this.isEditing = false;
    
    this.userForm.reset({
      role: 'customer',
      is_active: true
    });
    
    // Enable email field in create mode
    this.userForm.get('email')?.enable();
    
    // Make password required for new users
    this.userForm.get('password')?.setValidators([
      Validators.required, 
      Validators.minLength(8)
    ]);
    this.userForm.get('password')?.updateValueAndValidity();
    
    this.displayUserDialog = true;
  }

  saveUser(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }
    
    const userData = this.userForm.value;
    
    // Remove empty password from payload when editing
    if (this.isEditing && !userData.password) {
      delete userData.password;
    }
    
    if (this.isEditing && this.selectedUser) {
      this.updateExistingUser(userData);
    } else {
      this.handleCreateUser();
    }
  }

  private updateExistingUser(userData: any): void {
    if (!this.selectedUser) return;
    
    this.adminService.updateUser(this.selectedUser.id, userData).subscribe({
      next: (updatedUser: UserManage) => {
        // Update user in arrays
        const allIndex = this.allUsers.findIndex(u => u.id === this.selectedUser?.id);
        if (allIndex !== -1) {
          this.allUsers[allIndex] = updatedUser;
        }
        
        // Reapply filters to update display
        this.filterUsers();
        
        this.messageService.add({
          severity: 'success',
          summary: 'User Updated',
          detail: `User ${updatedUser.full_name} has been updated successfully`
        });
        
        this.displayUserDialog = false;
        
        // Update selected user reference
        if (this.selectedUser && this.selectedUser.id === updatedUser.id) {
          this.selectedUser = updatedUser;
        }
      },
      error: (error) => {
        console.error('Error updating user:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Update Failed',
          detail: error.error?.detail || 'Failed to update user'
        });
      }
    });
  }

  private handleCreateUser(): void {
    // Note: In this demo, user creation is handled by the registration endpoint
    // In a real application, you would implement this functionality
    this.displayUserDialog = false;
    this.messageService.add({
      severity: 'info',
      summary: 'Not Implemented',
      detail: 'Creating users from admin panel is not implemented in this demo'
    });
  }

  // ===== USER DELETION =====
  
  confirmDeleteUser(user: UserManage): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete user ${user.full_name}?`,
      header: 'Confirm Deletion',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deleteUser(user)
    });
  }

  private deleteUser(user: UserManage): void {
    this.adminService.deleteUser(user.id).subscribe({
      next: () => {
        // Remove deleted user from arrays
        this.allUsers = this.allUsers.filter(u => u.id !== user.id);
        
        // Reapply current filters
        this.filterUsers();
        
        this.messageService.add({
          severity: 'success',
          summary: 'User Deleted',
          detail: `User ${user.full_name} has been deleted successfully`
        });
      },
      error: (error) => {
        console.error('Error deleting user:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Deletion Failed',
          detail: error.error?.detail || 'Failed to delete user'
        });
      }
    });
  }

  // ===== UI UTILITIES =====
  
  refreshUserData(): void {
    this.loadAllUsers();
  }

  exportUsers(): void {
    // TODO: Implement export functionality
    this.messageService.add({
      severity: 'info',
      summary: 'Export',
      detail: 'Export functionality coming soon!'
    });
  }

  onPageChange(event: any): void {
    this.page = event.page + 1;
    this.pageSize = event.rows;
    this.loadAllUsers();
  }

  getRoleSeverity(role: string): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" {
    switch (role) {
      case 'admin': return 'danger';
      case 'staff': return 'warn';
      case 'customer': return 'info';
      default: return 'secondary';
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }

    navigateAddUser() {
    this.router.navigate(['/register']);
  }
}