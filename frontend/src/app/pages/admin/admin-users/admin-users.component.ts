// src/app/pages/admin/admin-users/admin-users.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TagModule } from 'primeng/tag';
import { PaginatorModule } from 'primeng/paginator';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { CheckboxModule } from 'primeng/checkbox';
import { PasswordModule } from 'primeng/password';

import { AdminService } from '../../../services/admin.service';
import { UserManage } from '../../../models/admin.model';

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
    DropdownModule,
    ToastModule,
    TagModule,
    PaginatorModule,
    DialogModule,
    ConfirmDialogModule,
    CheckboxModule,
    PasswordModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss'
})
export class AdminUsersComponent implements OnInit {
  users: UserManage[] = [];
  totalRecords = 0;
  loading = true;
  page = 1;
  pageSize = 10;
  
  selectedUser: UserManage | null = null;
  displayUserDialog = false;
  userForm: FormGroup;
  
  roleOptions = [
    { label: 'Customer', value: 'customer' },
    { label: 'Staff', value: 'staff' },
    { label: 'Admin', value: 'admin' }
  ];
  
  isEditing = false;
  
  constructor(
    private adminService: AdminService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private fb: FormBuilder,
    private router: Router
  ) {
    this.userForm = this.fb.group({
      full_name: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      address: [''],
      role: ['customer', Validators.required],
      is_active: [true],
      password: ['', [Validators.minLength(8)]]
    });
  }

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.loading = true;
    this.adminService.getAllUsers(this.page, this.pageSize).subscribe({
      next: (response) => {
        this.users = response.users;
        this.totalRecords = response.total;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading users:', error);
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
      }
    });
  }

  onPageChange(event: any) {
    this.page = event.page + 1;
    this.pageSize = event.rows;
    this.loadUsers();
  }

  openUserDetails(user: UserManage) {
    this.selectedUser = user;
    this.isEditing = true;
    
    this.userForm.patchValue({
      full_name: user.full_name,
      email: user.email,
      phone: user.phone || '',
      address: user.address || '',
      role: user.role,
      is_active: user.is_active,
      password: ''  // Do not patch password for security
    });
    
    // Disable email field in edit mode
    this.userForm.get('email')?.disable();
    
    this.displayUserDialog = true;
  }

  createNewUser() {
    this.selectedUser = null;
    this.isEditing = false;
    
    this.userForm.reset({
      role: 'customer',
      is_active: true
    });
    
    // Enable email field in create mode
    this.userForm.get('email')?.enable();
    
    // Make password required for new users
    this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(8)]);
    this.userForm.get('password')?.updateValueAndValidity();
    
    this.displayUserDialog = true;
  }

  saveUser() {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }
    
    const userData = this.userForm.value;
    
    // If password is empty and we're editing, remove it from the payload
    if (this.isEditing && !userData.password) {
      delete userData.password;
    }
    
    if (this.isEditing && this.selectedUser) {
      // Update existing user
      this.adminService.updateUser(this.selectedUser.id, userData).subscribe({
        next: (updatedUser) => {
          const index = this.users.findIndex(u => u.id === this.selectedUser?.id);
          if (index !== -1) {
            this.users[index] = updatedUser;
          }
          
          this.messageService.add({
            severity: 'success',
            summary: 'User Updated',
            detail: `User ${updatedUser.full_name} has been updated successfully`
          });
          
          this.displayUserDialog = false;
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
    } else {
      // Create new user (handled by registration endpoint)
      this.displayUserDialog = false;
      this.messageService.add({
        severity: 'info',
        summary: 'Not Implemented',
        detail: 'Creating users from admin panel is not implemented in this demo'
      });
      
      // In a real app, you'd call a service method to create the user
    }
  }

  confirmDeleteUser(user: UserManage) {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete user ${user.full_name}?`,
      header: 'Confirm Deletion',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.adminService.deleteUser(user.id).subscribe({
          next: () => {
            this.users = this.users.filter(u => u.id !== user.id);
            
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
    });
  }

  getRoleSeverity(role: string): string {
    switch (role) {
      case 'admin': return 'danger';
      case 'staff': return 'warning';
      case 'customer': return 'info';
      default: return 'secondary';
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  }
}