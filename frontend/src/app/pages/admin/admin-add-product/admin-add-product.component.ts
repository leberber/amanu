import { Component, OnInit, signal, inject } from '@angular/core';
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
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/product.model';
import { Category } from '../../../models/category.model';
import { VALIDATION, PRODUCT } from '../../../core/constants/app.constants';
import { ROUTES } from '../../../core/constants/routes.constants';
import { UnitsService } from '../../../core/services/units.service';
import { AdminFormService } from '../../../core/services/admin-form.service';

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
    CardModule,
    TranslateModule
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
  productForm!: FormGroup;

  // Mode detection
  isEditMode = signal(false);
  editProductId: number | null = null;
  currentProduct: ProductWithTranslations | null = null;

  // Dynamic categories
  categoryOptions = signal<{ label: string; value: number }[]>([]);

  // Computed properties
  get pageTitle(): string {
    return this.isEditMode() ? 'admin.products.edit_product' : 'admin.products.add_product';
  }

  get submitButtonLabel(): string {
    return this.isEditMode() ? 'admin.products.form.submit_update' : 'admin.products.form.submit_add';
  }

  private fb = inject(FormBuilder);
  private messageService = inject(MessageService);
  private productService = inject(ProductService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translateService = inject(TranslateService);
  private unitsService = inject(UnitsService);
  private adminFormService = inject(AdminFormService);

  ngOnInit() {
    this.productForm = this.fb.group({
      name_en: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_NAME_LENGTH)]],
      name_fr: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_NAME_LENGTH)]],
      name_ar: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_NAME_LENGTH)]],
      description_en: [''],
      description_fr: [''],
      description_ar: [''],
      price: [null, [Validators.required, Validators.min(PRODUCT.MIN_PRICE)]],
      unit: ['', Validators.required],
      stock_quantity: [0, [Validators.required, Validators.min(PRODUCT.MIN_STOCK)]],
      category_id: [null, Validators.required],
      image_url: [''],
      is_organic: [false],
      is_active: [true]
    });
    
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
          summary: this.translateService.instant('common.error'),
          detail: this.translateService.instant('products.filters.error')
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
        
        this.productForm.patchValue({
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
          summary: this.translateService.instant('common.error'),
          detail: this.translateService.instant('products.filters.error')
        });
        
        this.router.navigate([ROUTES.ADMIN.PRODUCTS]);
      }
    });
  }

  onCancel() {
    this.router.navigate([ROUTES.ADMIN.PRODUCTS]);
  }

  onSubmit() {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    
    const formValues = this.productForm.value;
    
    // Use AdminFormService to build product data with translations
    const productData = this.adminFormService.buildFormDataWithTranslations(
      formValues,
      ['name', 'description'],
      {
        price: formValues.price,
        unit: formValues.unit,
        stock_quantity: formValues.stock_quantity,
        category_id: formValues.category_id,
        image_url: formValues.image_url || '',
        is_organic: formValues.is_organic,
        is_active: formValues.is_active
      }
    );
    
    if (this.isEditMode() && this.editProductId) {
      // UPDATE existing product
      this.productService.updateProduct(this.editProductId, productData).subscribe({
        next: () => {
          this.loading.set(false);
          
          this.adminFormService.handleSuccess({
            message: 'admin.products.update_success',
            redirectUrl: ROUTES.ADMIN.PRODUCTS,
            redirectDelay: 1500
          });
        },
        error: (error) => {
          this.loading.set(false);
          this.adminFormService.handleError('update', error, {
            updateMessage: 'admin.products.update_failed'
          });
        }
      });
    } else {
      // CREATE new product
      this.productService.createProduct(productData).subscribe({
        next: () => {
          this.loading.set(false);
          
          this.adminFormService.handleSuccess({
            message: 'admin.products.create_success',
            redirectUrl: ROUTES.ADMIN.PRODUCTS,
            redirectDelay: 1500
          });
        },
        error: (error) => {
          this.loading.set(false);
          this.adminFormService.handleError('create', error, {
            createMessage: 'admin.products.create_failed'
          });
        }
      });
    }
  }

  // Get translated unit options
  getUnitOptions() {
    return this.unitsService.getUnitOptions(true);
  }

}