import { Component, OnInit, signal, inject, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { ToastModule } from 'primeng/toast';
import { DatePickerModule } from 'primeng/datepicker';
import { ButtonModule } from 'primeng/button';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ProductService } from '../../../services/product.service';
import { Product, ProductGroupPrice, ProductGroupPriceUpsert, GroupDiscountType } from '../../../models/product.model';
import { fractionLabel } from '../../../shared/utils/box-options.utils';
import { SegmentService } from '../../../core/services/segment.service';
import { Segment } from '../../../models/segment.model';
import { UserGroupService } from '../../../core/services/user-group.service';
import { UserGroup } from '../../../models/user-group.model';
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
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    InputTextModule,
    InputNumberModule,
    TextareaModule,
    SelectModule,
    MultiSelectModule,
    ToastModule,
    DatePickerModule,
    ButtonModule,
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
  private readonly userGroupService = inject(UserGroupService);
  private readonly segmentService = inject(SegmentService);

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

  // ── Segments ──────────────────────────────────────────────────────────────
  allSegments = signal<Segment[]>([]);
  selectedSegmentIds = signal<number[]>([]);

  readonly fractionLabel = fractionLabel;

  // ── Fraction Options ───────────────────────────────────────────────────────
  fractionOptions = signal<{n: number; d: number}[]>([]);
  newFractionN = signal<number>(1);
  newFractionD = signal<number>(2);
  fractionError = computed(() => {
    const ppb = this.piecesPerBoxValue();
    const d = this.newFractionD();
    if (!ppb || !d) return null;
    return ppb % d !== 0 ? `pieces_per_box (${ppb}) doit être divisible par ${d}` : null;
  });

  addFraction(): void {
    const n = this.newFractionN();
    const d = this.newFractionD();
    if (!n || !d || d <= 0 || n <= 0 || n >= d) return;
    if (this.fractionError()) return;
    const exists = this.fractionOptions().some(f => f.n === n && f.d === d);
    if (!exists) {
      this.fractionOptions.update(list => [...list, {n, d}]);
    }
  }

  removeFraction(index: number): void {
    this.fractionOptions.update(list => list.filter((_, i) => i !== index));
  }
  readonly segmentOptions = computed(() =>
    this.allSegments().map(s => ({ label: s.label_fr, value: s.id }))
  );

  private loadSegments(): void {
    this.segmentService.getSegments()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (segments) => this.allSegments.set(segments) });
  }

  // ── Group Pricing ─────────────────────────────────────────────────────────
  // For 'fixed': discount_value stores the TARGET PRICE (what the group pays)
  // For 'percentage': discount_value stores the % off
  // Conversion to actual discount happens on save.
  allGroups = signal<UserGroup[]>([]);
  groupPrices = signal<ProductGroupPriceUpsert[]>([]);
  savingGroupPrices = signal(false);

  readonly discountTypeOptions = [
    { label: 'Prix fixe (DA)', value: 'fixed' as GroupDiscountType },
    { label: '% de réduction', value: 'percentage' as GroupDiscountType }
  ];

  private get productPrice(): number {
    return this.productForm.get('price')?.value || 0;
  }

  isGroupInPrices(groupId: number): boolean {
    return this.groupPrices().some(p => p.group_id === groupId);
  }

  getGroupPrice(groupId: number): ProductGroupPriceUpsert | undefined {
    return this.groupPrices().find(p => p.group_id === groupId);
  }

  getGroupEffectivePrice(groupId: number): number {
    const entry = this.getGroupPrice(groupId);
    if (!entry) return this.productPrice;
    if (entry.discount_type === 'fixed') return entry.discount_value;
    return Math.max(0, this.productPrice - (this.productPrice * entry.discount_value / 100));
  }

  toggleGroupDiscount(groupId: number): void {
    if (this.isGroupInPrices(groupId)) {
      this.groupPrices.update(prices => prices.filter(p => p.group_id !== groupId));
    } else {
      // Default target price = catalog price (admin adjusts downward)
      this.groupPrices.update(prices => [...prices, {
        group_id: groupId,
        discount_type: 'fixed',
        discount_value: this.productPrice
      }]);
    }
  }

  updateGroupDiscountValue(groupId: number, value: number): void {
    this.groupPrices.update(prices =>
      prices.map(p => p.group_id === groupId ? { ...p, discount_value: value } : p)
    );
  }

  updateGroupDiscountType(groupId: number, type: GroupDiscountType): void {
    const price = this.productPrice;
    this.groupPrices.update(prices =>
      prices.map(p => p.group_id === groupId ? {
        ...p,
        discount_type: type,
        // Reset to sensible default when switching type
        discount_value: type === 'fixed' ? price : 0
      } : p)
    );
  }

  saveGroupPrices(): void {
    const productId = this.editProductId();
    if (!productId) return;
    const price = this.productPrice;

    // Convert UI values to actual discount amounts before saving
    const toSave: ProductGroupPriceUpsert[] = this.groupPrices().map(p => ({
      group_id: p.group_id,
      discount_type: p.discount_type,
      discount_value: p.discount_type === 'fixed'
        ? Math.max(0, price - p.discount_value)  // target price → discount amount
        : p.discount_value                         // percentage stays as-is
    }));

    this.savingGroupPrices.set(true);
    this.productService.setGroupPrices(productId, toSave)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.savingGroupPrices.set(false);
          this.toast.showSuccess('admin.products.group_prices_saved');
        },
        error: () => {
          this.savingGroupPrices.set(false);
          this.toast.showError('admin.products.group_prices_error');
        }
      });
  }

  private loadGroupData(): void {
    const productId = this.editProductId();
    if (!productId) return;

    this.userGroupService.getGroups(false)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (groups) => this.allGroups.set(groups) });

    this.productService.getGroupPrices(productId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (prices) => {
          const price = this.productPrice;
          // Convert stored discount amounts back to UI values (target prices)
          this.groupPrices.set(prices.map(p => ({
            group_id: p.group_id,
            discount_type: p.discount_type,
            discount_value: p.discount_type === 'fixed'
              ? price - p.discount_value   // discount amount → target price
              : p.discount_value            // percentage stays as-is
          })));
        }
      });
  }

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
      tva_rate: [0],
      barcode: [null],
      max_order_cartons: [null],
      new_until: [null],
    });

    this.loadCategories();
    this.loadBrands();
    this.loadSegments();
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
            tva_rate: product.tva_rate ?? 0,
            barcode: product.barcode ?? null,
            max_order_cartons: product.max_order_cartons ?? null,
            new_until: product.new_until ? new Date(product.new_until) : null,
          });
          this.selectedSegmentIds.set(product.segment_ids ?? []);
          this.fractionOptions.set(product.fraction_options ?? []);

          this.packagingTypeValue.set(product.packaging_type || null);
          this.piecesPerBoxValue.set(product.pieces_per_box || null);
          this.nameEnValue.set(currentProd?.name_translations?.['en'] || product.name);
          this.nameFrValue.set(currentProd?.name_translations?.['fr'] || product.name);
          this.nameArValue.set(currentProd?.name_translations?.['ar'] || product.name);
          this.originalStock.set(product.stock_quantity);
          this.cartonsInput.set(0);

          this.loadGroupData();
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
        tva_rate: formValues.tva_rate ?? 0,
        barcode: formValues.barcode?.trim() || null,
        max_order_cartons: formValues.max_order_cartons || null,
        new_until: formValues.new_until ? (formValues.new_until as Date).toISOString() : null,
        segment_ids: this.selectedSegmentIds(),
        fraction_options: this.fractionOptions().length > 0 ? this.fractionOptions() : null,
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