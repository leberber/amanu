// src/app/pages/admin/admin-categories/admin-categories.component.ts
import { Component, OnInit } from '@angular/core';
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
import { PaginatorModule } from 'primeng/paginator';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { ProductService } from '../../../services/product.service';
import { Category } from '../../../models/category.model';

@Component({
  selector: 'app-admin-categories',
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
    PaginatorModule,
    ConfirmDialogModule,
    IconFieldModule,
    InputIconModule,
    TooltipModule,
    ProgressSpinnerModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './admin-categories.component.html',
  styles: [`
    :host ::ng-deep .p-datatable-header {
      
      padding-left: 0 !important;
      padding-right: 0 !important;
    
    }
  `]
})
export class AdminCategoriesComponent implements OnInit {
  allCategories: Category[] = []; // Store all categories loaded once
  categories: Category[] = [];    // Filtered categories to display
  loading = true;
  searchQuery = '';
  
  // NEW: Store product counts for each category
  categoryProductCounts: { [categoryId: number]: number } = {};

  private searchTimeout: any;
  
  constructor(
    private productService: ProductService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadAllCategories();
  }

  hasActiveFilters(): boolean {
    return !!(this.searchQuery?.trim());
  }

  // Load all categories once on page load
  loadAllCategories() {
    this.loading = true;
    
    console.log('Loading all categories once...');
    
    this.productService.getCategories(false).subscribe({ // false = include inactive
      next: (categories) => {
        console.log('All categories loaded successfully:', categories.length);
        this.allCategories = categories; // Store all categories
        this.categories = categories;    // Initially display all categories
        this.loadProductCounts(); // NEW: Load product counts for each category
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading categories:', error);
        this.loading = false;
        
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load categories'
        });
      }
    });
  }

  // NEW: Load product counts for all categories
  loadProductCounts() {
    this.allCategories.forEach(category => {
      this.productService.getProductsByCategory(category.id, false).subscribe({
        next: (products) => {
          this.categoryProductCounts[category.id] = products.length;
        },
        error: (error) => {
          console.error(`Error loading products for category ${category.id}:`, error);
          this.categoryProductCounts[category.id] = 0;
        }
      });
    });
  }

  // Filter categories client-side (no API calls)
  filterCategories() {
    let filtered = [...this.allCategories];

    // Apply search filter
    if (this.searchQuery?.trim()) {
      const search = this.searchQuery.toLowerCase();
      filtered = filtered.filter(category => 
        category.name.toLowerCase().includes(search) ||
        category.description?.toLowerCase().includes(search)
      );
    }

    this.categories = filtered;
    console.log(`Filtered ${filtered.length} categories from ${this.allCategories.length} total`);
  }

  // Search input with client-side filtering
  onSearchInput() {
    // Clear the previous timeout if user is still typing
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    // Set a new timeout to filter after 300ms of no typing
    this.searchTimeout = setTimeout(() => {
      this.filterCategories(); // Filter client-side instead of API call
    }, 300);
  }

  // Keep for backward compatibility
  onSearch() {
    this.filterCategories();
  }

  // Clear filters with client-side filtering
  clearFilters() {
    this.searchQuery = '';
    this.filterCategories(); // Filter client-side instead of API call
  }

  // Navigation methods
  createNewCategory() {
    this.router.navigate(['/admin/categories/add']);
  }

  editCategory(category: Category) {
    this.router.navigate(['/admin/categories/edit', category.id]);
  }

  // Delete confirmation
  confirmDeleteCategory(category: Category) {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete "${category.name}"? This action cannot be undone.`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.deleteCategory(category);
      }
    });
  }

  // After delete, remove from local array and refresh filters
  deleteCategory(category: Category) {
    this.productService.deleteCategory(category.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Category Deleted',
          detail: `Category "${category.name}" has been deleted successfully`
        });
        
        // Remove deleted category from allCategories array
        this.allCategories = this.allCategories.filter(c => c.id !== category.id);
        // Reapply current filters
        this.filterCategories();
      },
      error: (error) => {
        console.error('Error deleting category:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Delete Failed',
          detail: error.error?.detail || 'Failed to delete category'
        });
      }
    });
  }

  // Method to refresh data after adding/editing categories
  refreshCategoryData() {
    this.loadAllCategories();
  }

  // Utility methods
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  }

  getCategoryProductCount(categoryId: number): number {
    // Return the actual count from our loaded data
    return this.categoryProductCounts[categoryId] || 0;
  }
}