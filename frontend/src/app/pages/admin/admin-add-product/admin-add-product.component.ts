import { Component, OnInit, signal, inject, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/product.model';
import { BrandService } from '../../../core/services/brand.service';
import { VALIDATION } from '../../../core/constants/validation.constants';
import { PRODUCT } from '../../../core/constants/product.constants';
import { ROUTES } from '../../../core/constants/routes.constants';
import { ANIMATION, UI_DELAY } from '../../../core/constants/ui.constants';
import { detectEditMode } from '../../../core/utils/edit-mode.util';
import { UnitsService } from '../../../core/services/units.service';
import { PackagingTypeService } from '../../../core/services/packaging-type.service';
import { AdminFormService } from '../../../core/services/admin-form.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';

interface ProductWithTranslations extends Product {
  name_translations?: { [key: string]: string };
  description_translations?: { [key: string]: string };
}

@Component({
  selector: 'app-admin-add-product',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    InputTextModule,
    InputNumberModule,
    TextareaModule,
    SelectModule,
    ToastModule,
    TranslateModule,
    PageLayoutComponent
  ],
  templateUrl: './admin-add-product.component.html',
  styleUrl: './admin-add-product.component.scss'
})
export class AdminAddProductComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastMessageService);
  private readonly productService = inject(ProductService);
  private readonly brandService = inject(BrandService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translateService = inject(TranslateService);
  private readonly unitsService = inject(UnitsService);
  private readonly packagingTypeService = inject(PackagingTypeService);
  private readonly adminFormService = inject(AdminFormService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly http = inject(HttpClient);

  productForm!: FormGroup;

  // Image upload state
  readonly isDragging = signal(false);
  readonly isUploading = signal(false);

  readonly loading = signal(false);
  readonly categoriesLoading = signal(false);
  readonly brandsLoading = signal(false);
  readonly formInitialized = signal(false);
  readonly currentStep = signal(1);
  readonly totalSteps = 2 as const;
  readonly isEditMode = signal(false);
  private readonly editProductId = signal<number | null>(null);
  private readonly currentProduct = signal<ProductWithTranslations | null>(null);
  readonly categoryOptions = signal<{ label: string; value: number }[]>([]);
  readonly brandOptions = signal<{ label: string; value: number }[]>([]);
  readonly cartonsInput = signal<number>(0);
  readonly originalStock = signal<number>(0);
  private readonly packagingTypeValue = signal<string | null>(null);
  private readonly piecesPerBoxValue = signal<number | null>(null);

  readonly pageTitle = computed(() =>
    this.isEditMode() ? 'admin.products.edit_product' : 'admin.products.add_product'
  );

  readonly submitButtonLabel = computed(() =>
    this.isEditMode() ? 'admin.products.form.submit_update' : 'admin.products.form.submit_add'
  );

  readonly pageSubtitle = computed(() =>
    this.currentStep() === 1 ? 'admin.products.form.step1_subtitle' : 'admin.products.form.step2_subtitle'
  );

  readonly mobileSubtitle = computed(() =>
    this.isEditMode() ? 'common.edit' : 'common.add'
  );

  readonly unitOptions = computed(() => this.unitsService.getUnitOptions(true));
  readonly packagingTypeOptions = computed(() => this.packagingTypeService.getPackagingTypeOptions(true));

  readonly isPackagingConfigured = computed(() =>
    !!this.packagingTypeValue() && (this.piecesPerBoxValue() ?? 0) > 1
  );

  readonly tvaRateOptions = [
    { label: '0%', value: 0 },
    { label: '9%', value: 9 },
    { label: '19%', value: 19 }
  ];

  private readonly isFactureValue = signal(false);
  readonly isFacture = computed(() => this.isFactureValue());

  readonly piecesPerBox = computed(() => this.piecesPerBoxValue() || 1);

  readonly packagingTypeLabel = computed(() => {
    const packagingType = this.packagingTypeValue();
    return packagingType
      ? this.packagingTypeService.getPackagingTypeTranslated(packagingType)
      : this.translateService.instant('products.product.packaging_types.box');
  });

  readonly stockToAdd = computed(() => this.cartonsInput() * this.piecesPerBox());

  readonly newTotalStock = computed(() => this.originalStock() + this.stockToAdd());

  private readonly nameEnValue = signal('');
  private readonly nameFrValue = signal('');
  private readonly nameArValue = signal('');

  readonly isStep1Valid = computed(() =>
    this.nameEnValue().length >= VALIDATION.MIN_NAME_LENGTH &&
    this.nameFrValue().length >= VALIDATION.MIN_NAME_LENGTH &&
    this.nameArValue().length >= VALIDATION.MIN_NAME_LENGTH
  );

  readonly ROUTES = ROUTES;

  ngOnInit(): void {
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
      brand_id: [null, Validators.required],
      image_url: [''],
      is_organic: [false],
      is_active: [true],
      pieces_per_box: [null, [Validators.required, Validators.min(1)]],
      packaging_type: [null, Validators.required],
      volume: [null],
      weight: [null],
      is_facture: [false],
      tva_rate: [0]
    });

    this.loadCategories();
    this.loadBrands();
    detectEditMode(
      this.route,
      this.destroyRef,
      this.isEditMode,
      this.editProductId,
      () => this.loadProductForEdit()
    );

    this.productForm.get('pieces_per_box')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(piecesPerBox => {
        this.piecesPerBoxValue.set(piecesPerBox);
        if (piecesPerBox && piecesPerBox > 1) {
          const stockQuantity = this.productForm.get('stock_quantity')?.value || 0;
          this.cartonsInput.set(Math.floor(stockQuantity / piecesPerBox));
        }
      });

    this.productForm.get('packaging_type')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(packagingType => {
        this.packagingTypeValue.set(packagingType);
      });

    this.productForm.get('name_en')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => this.nameEnValue.set(value || ''));

    this.productForm.get('name_fr')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => this.nameFrValue.set(value || ''));

    this.productForm.get('name_ar')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => this.nameArValue.set(value || ''));

    this.productForm.get('is_facture')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => this.isFactureValue.set(!!value));

    setTimeout(() => this.formInitialized.set(true), ANIMATION.NORMAL);
  }

  private loadCategories(): void {
    this.categoriesLoading.set(true);
    this.productService.getCategories(true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories) => {
          this.categoryOptions.set(categories.map(c => ({ label: c.name, value: c.id })));
          this.categoriesLoading.set(false);
        },
        error: () => {
          this.categoriesLoading.set(false);
          this.toast.showError('products.filters.error');
        }
      });
  }

  private loadBrands(): void {
    this.brandsLoading.set(true);
    this.brandService.getBrands(true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (brands) => {
          this.brandOptions.set(brands.map(b => ({ label: b.name, value: b.id })));
          this.brandsLoading.set(false);
        },
        error: () => {
          this.brandsLoading.set(false);
          this.toast.showError('admin.brands.load_error');
        }
      });
  }

  private loadProductForEdit(): void {
    const productId = this.editProductId();
    if (!productId) return;

    this.loading.set(true);

    this.productService.getProduct(productId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (product: Product) => {
          this.currentProduct.set(product as ProductWithTranslations);
          const currentProd = this.currentProduct();

          this.productForm.patchValue({
            name_en: currentProd?.name_translations?.['en'] || product.name,
            name_fr: currentProd?.name_translations?.['fr'] || product.name,
            name_ar: currentProd?.name_translations?.['ar'] || product.name,
            description_en: currentProd?.description_translations?.['en'] || product.description || '',
            description_fr: currentProd?.description_translations?.['fr'] || product.description || '',
            description_ar: currentProd?.description_translations?.['ar'] || product.description || '',
            price: product.price,
            unit: product.unit,
            stock_quantity: product.stock_quantity,
            category_id: product.category_id,
            brand_id: product.brand_id || null,
            image_url: product.image_url || '',
            is_organic: product.is_organic,
            is_active: product.is_active,
            pieces_per_box: product.pieces_per_box || null,
            packaging_type: product.packaging_type || null,
            volume: product.volume || '',
            weight: product.weight || '',
            is_facture: product.is_facture || false,
            tva_rate: product.tva_rate ?? 0
          });

          this.packagingTypeValue.set(product.packaging_type || null);
          this.piecesPerBoxValue.set(product.pieces_per_box || null);
          this.isFactureValue.set(product.is_facture || false);
          this.nameEnValue.set(currentProd?.name_translations?.['en'] || product.name);
          this.nameFrValue.set(currentProd?.name_translations?.['fr'] || product.name);
          this.nameArValue.set(currentProd?.name_translations?.['ar'] || product.name);
          this.originalStock.set(product.stock_quantity);
          this.cartonsInput.set(0);

          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.toast.showError('products.filters.error');
          this.router.navigate([ROUTES.ADMIN.PRODUCTS]);
        }
      });
  }

  onSubmit(): void {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);

    const formValues = this.productForm.value;
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
        packaging_type: formValues.packaging_type || null,
        volume: formValues.volume || null,
        weight: formValues.weight || null,
        is_facture: formValues.is_facture || false,
        tva_rate: formValues.tva_rate ?? 0
      }
    );

    const productId = this.editProductId();
    if (this.isEditMode() && productId) {
      this.productService.updateProduct(productId, productData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.loading.set(false);
            this.adminFormService.handleSuccess({
              message: 'admin.products.update_success',
              redirectUrl: ROUTES.ADMIN.PRODUCTS,
              redirectDelay: UI_DELAY.TOAST_BEFORE_NAVIGATE
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
      this.productService.createProduct(productData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.loading.set(false);
            this.adminFormService.handleSuccess({
              message: 'admin.products.create_success',
              redirectUrl: ROUTES.ADMIN.PRODUCTS,
              redirectDelay: UI_DELAY.TOAST_BEFORE_NAVIGATE
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

  nextStep(): void {
    if (this.currentStep() < this.totalSteps) {
      this.currentStep.set(this.currentStep() + 1);
    }
  }

  prevStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.set(this.currentStep() - 1);
    }
  }

  onCartonsInputChange(value: number): void {
    this.cartonsInput.set(value || 0);
    const piecesToAdd = (value || 0) * this.piecesPerBox();
    this.productForm.patchValue({ stock_quantity: this.originalStock() + piecesToAdd });
  }

  // Image upload methods
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.uploadImage(files[0]);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.uploadImage(input.files[0]);
      input.value = '';
    }
  }

  private uploadImage(file: File): void {
    if (!file.type.startsWith('image/')) {
      this.toast.showError('admin.products.form.invalid_image_type');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      this.toast.showError('admin.products.form.image_too_large');
      return;
    }

    const brand = this.brandOptions().find(b => b.value === this.productForm.get('brand_id')?.value)?.label || 'unknown';
    const name = this.productForm.get('name_fr')?.value || this.productForm.get('name_en')?.value || 'product';

    if (!brand || brand === 'unknown') {
      this.toast.showError('admin.products.form.select_brand_first');
      return;
    }

    this.isUploading.set(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('brand', brand);
    formData.append('name', name);

    this.http.post<{ success: boolean; url: string; key: string }>('/api/v1/products/upload-image', formData)
      .pipe(
        finalize(() => this.isUploading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          if (response.success) {
            const cacheBuster = '?t=' + Date.now();
            this.productForm.patchValue({ image_url: response.url + cacheBuster });
            this.toast.showSuccess('admin.products.form.image_uploaded');
          }
        },
        error: () => {
          this.toast.showError('admin.products.form.image_upload_failed');
        }
      });
  }

  removeImage(): void {
    this.productForm.patchValue({ image_url: '' });
  }
}