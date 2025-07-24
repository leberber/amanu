// src/app/pages/admin/admin-add-product/admin-add-product.component.ts
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CardModule } from 'primeng/card';

import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/product.model';
import { Category } from '../../../models/category.model';

@Component({
  selector: 'app-admin-add-product',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    TextareaModule,
    SelectModule,
    CheckboxModule,
    ToastModule,
    CardModule
  ],
  providers: [MessageService],
  templateUrl: './admin-add-product.component.html',
  styles: [`
    .field {
      margin-bottom: 1rem;
    }
  `]
})
export class AdminAddProductComponent implements OnInit {
  loading = signal(false);
  categoriesLoading = signal(false);
  productForm: FormGroup;

  // Mode detection
  isEditMode = signal(false);
  editProductId: number | null = null;
  currentProduct: Product | null = null;

  // Dropdown options
  unitOptions = [
    { label: 'Kg', value: 'kg' },
    { label: 'Gram', value: 'gram' },
    { label: 'Piece', value: 'piece' },
    { label: 'Bunch', value: 'bunch' },
    { label: 'Dozen', value: 'dozen' },
    { label: 'Pound', value: 'pound' }
  ];

  // Dynamic categories - loaded from API
  categoryOptions = signal<{ label: string; value: number }[]>([]);

  // Computed properties
  get pageTitle(): string {
    return this.isEditMode() ? 'Edit Product' : 'Add New Product';
  }

  get submitButtonLabel(): string {
    return this.isEditMode() ? 'Update Product' : 'Add Product';
  }

  constructor(
    private fb: FormBuilder,
    private messageService: MessageService,
    private productService: ProductService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.productForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(1)]],
      description: [''],
      price: [null, [Validators.required, Validators.min(0.01)]],
      unit: ['', Validators.required],
      stock_quantity: [0, [Validators.required, Validators.min(0)]],
      category_id: [null, Validators.required],
      image_url: [''],
      is_organic: [false],
      is_active: [true]
    });
  }

  ngOnInit() {
    this.loadCategories();
    this.detectMode();
  }

  detectMode() {
    // Check route data first
    const routeData = this.route.snapshot.data;
    if (routeData['mode'] === 'edit') {
      this.isEditMode.set(true);
    }

    // Check for ID parameter
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.editProductId = parseInt(id, 10);
        this.isEditMode.set(true);
        this.loadProductForEdit();
      }
    });
  }

  loadCategories() {
    this.categoriesLoading.set(true);
    
    this.productService.getCategories(true).subscribe({
      next: (categories: Category[]) => {
        const options = categories.map(category => ({
          label: category.name,
          value: category.id
        }));
        
        this.categoryOptions.set(options);
        this.categoriesLoading.set(false);
        
        console.log('Categories loaded:', options);
      },
      error: (error) => {
        console.error('Error loading categories:', error);
        this.categoriesLoading.set(false);
        
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load categories. Please try again.'
        });
      }
    });
  }

  loadProductForEdit() {
    if (!this.editProductId) return;

    this.loading.set(true);
    
    this.productService.getProduct(this.editProductId).subscribe({
      next: (product: Product) => {
        this.currentProduct = product;
        
        // Populate form with existing product data
        this.productForm.patchValue({
          name: product.name,
          description: product.description || '',
          price: product.price,
          unit: product.unit,
          stock_quantity: product.stock_quantity,
          category_id: product.category_id,
          image_url: product.image_url || '',
          is_organic: product.is_organic,
          is_active: product.is_active
        });
        
        this.loading.set(false);
        console.log('Product loaded for editing:', product);
      },
      error: (error) => {
        console.error('Error loading product:', error);
        this.loading.set(false);
        
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load product. Please try again.'
        });
        
        // Redirect back if product not found
        this.goBackToProductsList();
      }
    });
  }

  onCancel() {
    this.goBackToProductsList();
  }

  goBackToProductsList() {
    this.router.navigate(['/admin/products']);
  }

  onSubmit() {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    
    const productData = this.productForm.value;
    
    if (this.isEditMode() && this.editProductId) {
      // UPDATE existing product
      this.productService.updateProduct(this.editProductId, productData).subscribe({
        next: (updatedProduct) => {
          this.loading.set(false);
          
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: `Product "${updatedProduct.name}" has been updated successfully!`
          });
          
          console.log('Product updated successfully:', updatedProduct);
          
          // Navigate back to products list after delay
          setTimeout(() => {
            this.goBackToProductsList();
          }, 1500);
        },
        error: (error) => {
          this.loading.set(false);
          this.handleError('update', error);
        }
      });
    } else {
      // CREATE new product
      this.productService.createProduct(productData).subscribe({
        next: (createdProduct) => {
          this.loading.set(false);
          
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: `Product "${createdProduct.name}" has been created successfully!`
          });
          
          console.log('Product created successfully:', createdProduct);
          
          // Navigate back to products list after delay
          setTimeout(() => {
            this.goBackToProductsList();
          }, 1500);
        },
        error: (error) => {
          this.loading.set(false);
          this.handleError('create', error);
        }
      });
    }
  }

  private handleError(operation: 'create' | 'update', error: any) {
    console.error(`Error ${operation}ing product:`, error);
    
    let errorMessage = `Failed to ${operation} product. Please try again.`;
    
    if (error.error && error.error.detail) {
      errorMessage = error.error.detail;
    }
    
    this.messageService.add({
      severity: 'error',
      summary: 'Error',
      detail: errorMessage
    });
  }
}