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
import { CardModule } from 'primeng/card';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/product.model';
import { Category } from '../../../models/category.model';
import { Brand } from '../../../models/brand.model';
import { BrandService } from '../../../core/services/brand.service';
import { VALIDATION, PRODUCT } from '../../../core/constants/app.constants';
import { ROUTES } from '../../../core/constants/routes.constants';
import { UnitsService } from '../../../core/services/units.service';
import { PackagingTypeService } from '../../../core/services/packaging-type.service';
import { AdminFormService } from '../../../core/services/admin-form.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { ChipModule } from 'primeng/chip';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';

// Extended Product interface to include translations
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
    TranslateModule,
    ChipModule,
    InputGroupModule,
    InputGroupAddonModule,
    PageLayoutComponent
  ],
  templateUrl: './admin-add-product.component.html',
  styleUrl: './admin-add-product.component.scss'
})
export class AdminAddProductComponent implements OnInit {
  loading = signal(false);
  categoriesLoading = signal(false);
  brandsLoading = signal(false);
  formInitialized = signal(false);
  productForm!: FormGroup;

  // Mode detection
  isEditMode = signal(false);
  editProductId: number | null = null;
  currentProduct: ProductWithTranslations | null = null;

  // Dynamic categories
  categoryOptions = signal<{ label: string; value: number }[]>([]);

  // Dynamic brands
  brandOptions = signal<{ label: string; value: number }[]>([]);

  // Product count for badge
  productCount = signal(0);

  
  // Computed properties
  get pageTitle(): string {
    return this.isEditMode() ? 'admin.products.edit_product' : 'admin.products.add_product';
  }

  get submitButtonLabel(): string {
    return this.isEditMode() ? 'admin.products.form.submit_update' : 'admin.products.form.submit_add';
  }

  private fb = inject(FormBuilder);
  private toast = inject(ToastMessageService);
  private productService = inject(ProductService);
  private brandService = inject(BrandService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translateService = inject(TranslateService);
  private unitsService = inject(UnitsService);
  private packagingTypeService = inject(PackagingTypeService);
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
      brand_id: [null],
      image_url: [''],
      is_organic: [false],
      is_active: [true],
      // Box configuration
      pieces_per_box: [null],
      packaging_type: [null]
    });

    this.loadCategories();
    this.loadBrands();
    this.loadProductCount();
    this.detectMode();

    // Initialize form with slight delay for skeleton animation
    setTimeout(() => {
      this.formInitialized.set(true);
    }, 300);
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
      error: () => {
        this.categoriesLoading.set(false);
        this.toast.showError('products.filters.error');
      }
    });
  }

  loadBrands() {
    this.brandsLoading.set(true);

    this.brandService.getBrands(true).subscribe({
      next: (brands: Brand[]) => {
        const options = brands.map(brand => ({
          label: brand.name,
          value: brand.id
        }));

        this.brandOptions.set(options);
        this.brandsLoading.set(false);
      },
      error: () => {
        this.brandsLoading.set(false);
        this.toast.showError('admin.brands.load_error');
      }
    });
  }

  loadProductCount() {
    this.productService.getProducts().subscribe({
      next: (products: Product[]) => {
        this.productCount.set(products.length);
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
          brand_id: product.brand_id || null,
          image_url: product.image_url || '',
          is_organic: product.is_organic,
          is_active: product.is_active,
          pieces_per_box: product.pieces_per_box || null,
          packaging_type: product.packaging_type?.toUpperCase() || null
        });

        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.showError('products.filters.error');
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
        brand_id: formValues.brand_id || null,
        image_url: formValues.image_url || '',
        is_organic: formValues.is_organic,
        is_active: formValues.is_active,
        pieces_per_box: formValues.pieces_per_box || null,
        packaging_type: formValues.packaging_type || null
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

  // Get packaging type options
  getPackagingTypeOptions() {
    return this.packagingTypeService.getPackagingTypeOptions(true);
  }

}