// frontend/src/app/pages/admin/admin-products/admin-products.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';

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
import { SelectModule } from 'primeng/select';

import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/product.model';
import { Category } from '../../../models/category.model';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { BadgeModule } from 'primeng/badge';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { TooltipModule } from 'primeng/tooltip';


@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [
    TooltipModule,
    CommonModule,
    FormsModule,
    BadgeModule,
    OverlayBadgeModule,
    // RouterLink,
    TableModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    ToastModule,
    TagModule,
    PaginatorModule,
    DialogModule,
    ConfirmDialogModule,
    SelectModule,
    IconFieldModule,
    InputIconModule,
    ProgressSpinnerModule
  ],
  providers: [MessageService, ConfirmationService],
    templateUrl:'./admin-products.component.html',
  styleUrl: './admin-products.component.scss'
})
export class AdminProductsComponent implements OnInit {
  allProducts: Product[] = []; // Store all products loaded once
  products: Product[] = [];    // Filtered products to display
  categories: Category[] = [];
  loading = true;
  searchQuery = '';
  selectedCategory = null;
  
  // Category options for filter
  categoryOptions: any[] = [
    { label: 'All Categories', value: null }
  ];

  private searchTimeout: any;
  
  constructor(
    private productService: ProductService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadCategories();
    this.loadAllProducts(); // Load all products once
  }

  hasActiveFilters(): boolean {
    return !!(
      this.searchQuery?.trim() || 
      this.selectedCategory
    );
  }

  loadCategories() {
    this.productService.getCategories(true).subscribe({
      next: (categories) => {
        this.categories = categories;
        // Build category options for filter
        const options = categories.map(cat => ({
          label: cat.name,
          value: cat.id
        }));
        this.categoryOptions = [
          { label: 'All Categories', value: null },
          ...options
        ];
      },
      error: (error) => {
        console.error('Error loading categories:', error);
      }
    });
  }

  // Load all products once on page load
  loadAllProducts() {
    this.loading = true;
    
    // Load all products without filters
    const filters: any = {
      active_only: false // Show both active and inactive
    };
    
 
    
    this.productService.getProducts(filters).subscribe({
      next: (products) => {
        console.log('All products loaded successfully:', products.length);
        this.allProducts = products; // Store all products
        this.products = products;    // Initially display all products
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading products:', error);
        this.loading = false;
        
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load products'
        });
      }
    });
  }

  // Filter products client-side (no API calls)
  filterProducts() {
    let filtered = [...this.allProducts];

    // Apply search filter
    if (this.searchQuery?.trim()) {
      const search = this.searchQuery.toLowerCase();
      filtered = filtered.filter(product => 
        product.name.toLowerCase().includes(search) ||
        product.description?.toLowerCase().includes(search) ||
        this.getCategoryName(product.category_id).toLowerCase().includes(search)
      );
    }

    // Apply category filter
    if (this.selectedCategory) {
      filtered = filtered.filter(product => 
        product.category_id === this.selectedCategory
      );
    }

    this.products = filtered;
    console.log(`Filtered ${filtered.length} products from ${this.allProducts.length} total`);
  }

  // Search input with client-side filtering
  onSearchInput() {
    // Clear the previous timeout if user is still typing
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    // Set a new timeout to filter after 300ms of no typing
    this.searchTimeout = setTimeout(() => {
      this.filterProducts(); // Filter client-side instead of API call
    }, 300);
  }

  // Category change with client-side filtering
  onCategoryChange() {
    this.filterProducts(); // Filter client-side instead of API call
  }

  // Keep for backward compatibility
  onSearch() {
    this.filterProducts();
  }

  // Clear filters with client-side filtering
  clearFilters() {
    this.searchQuery = '';
    this.selectedCategory = null;
    this.filterProducts(); // Filter client-side instead of API call
  }

  // Navigation methods - FIXED
  createNewProduct() {
    this.router.navigate(['/admin/products/add']);
  }

  editProduct(product: Product) {
    this.router.navigate(['/admin/products/edit', product.id]);
  }

  viewProduct(product: Product) {
    // Navigate to public product page
    this.router.navigate(['/products', product.id]);
  }

  // Delete confirmation
  confirmDeleteProduct(product: Product) {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete "${product.name}"? This action cannot be undone.`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.deleteProduct(product);
      }
    });
  }

  // After delete, remove from local array and refresh filters
  deleteProduct(product: Product) {
    this.productService.deleteProduct(product.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Product Deleted',
          detail: `Product "${product.name}" has been deleted successfully`
        });
        
        // Remove deleted product from allProducts array
        this.allProducts = this.allProducts.filter(p => p.id !== product.id);
        // Reapply current filters
        this.filterProducts();
      },
      error: (error) => {
        console.error('Error deleting product:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Delete Failed',
          detail: error.error?.detail || 'Failed to delete product'
        });
      }
    });
  }

  // Method to refresh data after adding/editing products
  refreshProductData() {
    this.loadAllProducts();
  }

  // Utility methods
  getCategoryName(categoryId: number): string {
    const category = this.categories.find(cat => cat.id === categoryId);
    return category ? category.name : 'Unknown';
  }

  getStockSeverity(stockQuantity: number): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" {
    if (stockQuantity === 0) return 'danger';
    if (stockQuantity < 10) return 'warn';
    if (stockQuantity < 50) return 'info';
    return 'success';
  }

  getStockLabel(stockQuantity: number): string {
    if (stockQuantity === 0) return 'Out of Stock';
    if (stockQuantity < 10) return 'Low Stock';
    return 'In Stock';
  }

  getUnitDisplay(unit: string): string {
    switch (unit) {
      case 'kg': return 'Kg';
      case 'gram': return 'g';
      case 'piece': return 'Piece';
      case 'bunch': return 'Bunch';
      case 'dozen': return 'Dozen';
      case 'pound': return 'lb';
      default: return unit;
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  }
}