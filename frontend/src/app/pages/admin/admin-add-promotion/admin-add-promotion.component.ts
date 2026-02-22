// src/app/pages/admin/admin-add-promotion/admin-add-promotion.component.ts
import { Component, OnInit, signal, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { CheckboxModule } from 'primeng/checkbox';
import { ToastModule } from 'primeng/toast';
import { CardModule } from 'primeng/card';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { DatePickerModule } from 'primeng/datepicker';
import { DividerModule } from 'primeng/divider';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ROUTES } from '../../../core/constants/routes.constants';
import { UI_DELAY } from '../../../core/constants/app.constants';
import { onLanguageChange } from '../../../core/utils/language-change.util';
import { PromotionService } from '../../../services/promotion.service';
import { ProductService } from '../../../services/product.service';
import { BrandService } from '../../../core/services/brand.service';
import { Promotion, PromotionCreate, PromotionUpdate } from '../../../models/promotion.model';
import { Category } from '../../../models/category.model';
import { Brand } from '../../../models/brand.model';
import { ToastMessageService } from '../../../core/services/toast-message.service';

interface SelectOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-admin-add-promotion',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    CheckboxModule,
    ToastModule,
    CardModule,
    SelectModule,
    InputNumberModule,
    DatePickerModule,
    DividerModule,
    TranslateModule
  ],
    templateUrl: './admin-add-promotion.component.html',
  styleUrl: './admin-add-promotion.component.scss'
})
export class AdminAddPromotionComponent implements OnInit {
  loading = signal(false);
  promotionForm!: FormGroup;
  isEditMode = signal(false);
  editPromotionId: number | null = null;
  currentPromotion: Promotion | null = null;

  // Dropdown options
  discountTypeOptions: SelectOption[] = [];
  scopeOptions: SelectOption[] = [];
  categories: Category[] = [];
  brands: Brand[] = [];
  products: { id: number; name: string }[] = [];

  get pageTitle(): string {
    return this.isEditMode() ? 'admin.promotions.edit_promotion' : 'admin.promotions.add_promotion';
  }

  get submitButtonLabel(): string {
    return this.isEditMode() ? 'admin.promotions.form.submit_update' : 'admin.promotions.form.submit_add';
  }

  private fb = inject(FormBuilder);
  private toast = inject(ToastMessageService);
  private promotionService = inject(PromotionService);
  private productService = inject(ProductService);
  private brandService = inject(BrandService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translateService = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    this.initializeOptions();
    this.initializeForm();
    this.loadCategories();
    this.loadBrands();
    this.loadProducts();
    this.detectMode();
    onLanguageChange(this.translateService, this.destroyRef, () => this.initializeOptions());
  }

  initializeOptions() {
    this.discountTypeOptions = [
      { label: this.translateService.instant('admin.promotions.discount_type.percentage'), value: 'percentage' },
      { label: this.translateService.instant('admin.promotions.discount_type.fixed_amount'), value: 'fixed_amount' }
    ];

    this.scopeOptions = [
      { label: this.translateService.instant('admin.promotions.scope.global'), value: 'global' },
      { label: this.translateService.instant('admin.promotions.scope.category'), value: 'category' },
      { label: this.translateService.instant('admin.promotions.scope.brand'), value: 'brand' },
      { label: this.translateService.instant('admin.promotions.scope.product'), value: 'product' }
    ];
  }

  initializeForm() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    this.promotionForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: [''],
      code: ['', [Validators.pattern(/^[A-Z0-9_-]+$/i)]],
      discount_type: ['percentage', Validators.required],
      discount_value: [10, [Validators.required, Validators.min(0.01)]],
      scope: ['global', Validators.required],
      category_id: [null],
      brand_id: [null],
      product_id: [null],
      min_order_amount: [0, [Validators.min(0)]],
      max_discount: [null],
      usage_limit: [null],
      start_date: [tomorrow, Validators.required],
      end_date: [nextMonth, Validators.required],
      is_active: [true]
    });

    // Watch scope changes to validate related fields - properly cleaned up on destroy
    this.promotionForm.get('scope')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(scope => {
        this.updateScopeValidation(scope);
      });
  }

  updateScopeValidation(scope: string) {
    const categoryControl = this.promotionForm.get('category_id');
    const brandControl = this.promotionForm.get('brand_id');
    const productControl = this.promotionForm.get('product_id');

    // Clear all validators first
    categoryControl?.clearValidators();
    brandControl?.clearValidators();
    productControl?.clearValidators();

    // Add required validator based on scope
    switch (scope) {
      case 'category':
        categoryControl?.setValidators([Validators.required]);
        break;
      case 'brand':
        brandControl?.setValidators([Validators.required]);
        break;
      case 'product':
        productControl?.setValidators([Validators.required]);
        break;
    }

    categoryControl?.updateValueAndValidity();
    brandControl?.updateValueAndValidity();
    productControl?.updateValueAndValidity();
  }

  loadCategories() {
    this.productService.getCategories(true).subscribe({
      next: (categories: Category[]) => {
        this.categories = categories;
      },
      error: () => {
        // Categories load failed silently
      }
    });
  }

  loadBrands() {
    this.brandService.getBrands(true).subscribe({
      next: (brands: Brand[]) => {
        this.brands = brands;
      },
      error: () => {
        // Brands load failed silently
      }
    });
  }

  loadProducts() {
    this.productService.getProducts().subscribe({
      next: (products: any[]) => {
        this.products = products.map(p => ({ id: p.id, name: p.name }));
      },
      error: () => {
        // Products load failed silently
      }
    });
  }

  detectMode() {
    const routeData = this.route.snapshot.data;
    if (routeData['mode'] === 'edit') {
      this.isEditMode.set(true);
    }

    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.editPromotionId = parseInt(id, 10);
        this.isEditMode.set(true);
        this.loadPromotionForEdit();
      }
    });
  }

  loadPromotionForEdit() {
    if (!this.editPromotionId) return;

    this.loading.set(true);

    this.promotionService.getPromotion(this.editPromotionId).subscribe({
      next: (promotion) => {
        this.currentPromotion = promotion;

        this.promotionForm.patchValue({
          name: promotion.name,
          description: promotion.description || '',
          code: promotion.code || '',
          discount_type: promotion.discount_type,
          discount_value: promotion.discount_value,
          scope: promotion.scope,
          category_id: promotion.category_id,
          brand_id: promotion.brand_id,
          product_id: promotion.product_id,
          min_order_amount: promotion.min_order_amount || 0,
          max_discount: promotion.max_discount,
          usage_limit: promotion.usage_limit,
          start_date: new Date(promotion.start_date),
          end_date: new Date(promotion.end_date),
          is_active: promotion.is_active
        });

        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.showError('admin.promotions.load_error');
        this.goBackToPromotionsList();
      }
    });
  }

  onCancel() {
    this.goBackToPromotionsList();
  }

  goBackToPromotionsList() {
    this.router.navigate([ROUTES.ADMIN.PROMOTIONS]);
  }

  onSubmit() {
    if (this.promotionForm.invalid) {
      this.promotionForm.markAllAsTouched();
      return;
    }

    // Validate dates
    const startDate = this.promotionForm.value.start_date;
    const endDate = this.promotionForm.value.end_date;

    if (endDate <= startDate) {
      this.toast.showError('admin.promotions.form.date_error');
      return;
    }

    this.loading.set(true);

    const formValues = this.promotionForm.value;

    // Build promotion data
    const promotionData: PromotionCreate = {
      name: formValues.name,
      description: formValues.description || undefined,
      code: formValues.code?.toUpperCase() || undefined,
      discount_type: formValues.discount_type,
      discount_value: formValues.discount_value,
      scope: formValues.scope,
      category_id: formValues.scope === 'category' ? formValues.category_id : undefined,
      brand_id: formValues.scope === 'brand' ? formValues.brand_id : undefined,
      product_id: formValues.scope === 'product' ? formValues.product_id : undefined,
      min_order_amount: formValues.min_order_amount || 0,
      max_discount: formValues.max_discount || undefined,
      usage_limit: formValues.usage_limit || undefined,
      start_date: formValues.start_date.toISOString(),
      end_date: formValues.end_date.toISOString(),
      is_active: formValues.is_active
    };

    if (this.isEditMode() && this.editPromotionId) {
      this.promotionService.updatePromotion(this.editPromotionId, promotionData as PromotionUpdate).subscribe({
        next: () => {
          this.loading.set(false);
          this.toast.showSuccess('admin.promotions.update_success');
          setTimeout(() => {
            this.goBackToPromotionsList();
          }, UI_DELAY.TOAST_BEFORE_NAVIGATE);
        },
        error: (error) => {
          this.loading.set(false);
          this.handleError('update', error);
        }
      });
    } else {
      this.promotionService.createPromotion(promotionData).subscribe({
        next: () => {
          this.loading.set(false);
          this.toast.showSuccess('admin.promotions.create_success');
          setTimeout(() => {
            this.goBackToPromotionsList();
          }, UI_DELAY.TOAST_BEFORE_NAVIGATE);
        },
        error: (error) => {
          this.loading.set(false);
          this.handleError('create', error);
        }
      });
    }
  }

  private handleError(operation: 'create' | 'update', error: any) {
    const fallbackKey = operation === 'create' ? 'admin.promotions.create_failed' : 'admin.promotions.update_failed';
    this.toast.showApiError(error, fallbackKey);
  }

  // Helper to check if discount type is percentage
  isPercentageDiscount(): boolean {
    return this.promotionForm.get('discount_type')?.value === 'percentage';
  }

  // Get current scope value
  getCurrentScope(): string {
    return this.promotionForm.get('scope')?.value || 'global';
  }
}
