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

// 🆕 UPDATED: Extended Product interface to include translations
interface ProductWithTranslations extends Product {
  name_translations?: { [key: string]: string };
  description_translations?: { [key: string]: string };
}

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
    .section-title {
      font-size: 1.1rem;
      font-weight: 600;
      margin: 1.5rem 0 1rem 0;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--surface-border);
      color: var(--primary-color);
    }
    .language-section {
      background: var(--surface-50);
      padding: 1rem;
      border-radius: 6px;
      margin-bottom: 1rem;
      border-left: 4px solid var(--primary-color);
    }
    .language-flag {
      font-size: 1.2rem;
      margin-right: 0.5rem;
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
  currentProduct: ProductWithTranslations | null = null;

  // Dropdown options
  unitOptions = [
    { label: 'Kilogram (Kg)', value: 'kg' },
    { label: 'Gram (g)', value: 'gram' },
    { label: 'Piece', value: 'piece' },
    { label: 'Bunch', value: 'bunch' },
    { label: 'Dozen', value: 'dozen' },
    { label: 'Pound (lb)', value: 'pound' }
  ];

  // Dynamic categories
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
    // 🆕 UPDATED: Enhanced form WITHOUT primary name/description fields
    this.productForm = this.fb.group({
      // 🚫 REMOVED: Primary name and description
      // name: ['', [Validators.required, Validators.minLength(1)]],
      // description: [''],
      
      // 🆕 NEW: Only translation fields for all 3 languages (all required)
      name_en: ['', [Validators.required, Validators.minLength(1)]],
      name_fr: ['', [Validators.required, Validators.minLength(1)]],
      name_ar: ['', [Validators.required, Validators.minLength(1)]],
      
      description_en: [''],
      description_fr: [''],
      description_ar: [''],
      
      // Pricing & Inventory
      price: [null, [Validators.required, Validators.min(0.01)]],
      unit: ['', Validators.required],
      stock_quantity: [0, [Validators.required, Validators.min(0)]],
      category_id: [null, Validators.required],
      
      // Settings
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
    const routeData = this.route.snapshot.data;
    if (routeData['mode'] === 'edit') {
      this.isEditMode.set(true);
    }

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
        this.currentProduct = product as ProductWithTranslations;
        
        // 🆕 UPDATED: Populate form with existing product data including translations
        this.productForm.patchValue({
          // 🚫 REMOVED: Primary name and description
          // name: product.name,
          // description: product.description || '',
          
          // 🆕 NEW: Load translation values or fallback to main name/description
          name_en: this.currentProduct.name_translations?.['en'] || product.name,
          name_fr: this.currentProduct.name_translations?.['fr'] || product.name,
          name_ar: this.currentProduct.name_translations?.['ar'] || product.name,
          
          description_en: this.currentProduct.description_translations?.['en'] || product.description || '',
          description_fr: this.currentProduct.description_translations?.['fr'] || product.description || '',
          description_ar: this.currentProduct.description_translations?.['ar'] || product.description || '',
          
          price: product.price,
          unit: product.unit,
          stock_quantity: product.stock_quantity,
          category_id: product.category_id,
          image_url: product.image_url || '',
          is_organic: product.is_organic,
          is_active: product.is_active
        });
        
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading product:', error);
        this.loading.set(false);
        
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load product. Please try again.'
        });
        
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
    
    const formValues = this.productForm.value;
    
    // 🆕 NEW: Build the product data with translation JSON objects
    const productData = {
      name: formValues.name_en, // Use English as primary name
      description: formValues.description_en || '', // Use English as primary description
      
      // 🆕 NEW: Create translation JSON objects
      name_translations: {
        en: formValues.name_en,
        fr: formValues.name_fr,
        ar: formValues.name_ar
      },
      description_translations: {
        en: formValues.description_en || '',
        fr: formValues.description_fr || '',
        ar: formValues.description_ar || ''
      },
      
      // Other fields
      price: formValues.price,
      unit: formValues.unit,
      stock_quantity: formValues.stock_quantity,
      category_id: formValues.category_id,
      image_url: formValues.image_url || '',
      is_organic: formValues.is_organic,
      is_active: formValues.is_active
    };
    
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