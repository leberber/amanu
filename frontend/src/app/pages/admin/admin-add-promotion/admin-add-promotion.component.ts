import { Component, OnInit, signal, inject, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ToastModule } from 'primeng/toast';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ROUTES } from '../../../core/constants/routes.constants';
import { ANIMATION, UI_DELAY, DATETIME } from '../../../core/constants/ui.constants';
import { VALIDATION } from '../../../core/constants/validation.constants';
import { DISCOUNT_TYPES, SCOPE_TYPES, PROMOTION_DEFAULTS } from '../../../core/constants/promotion.constants';
import { onLanguageChange } from '../../../core/utils/language-change.util';
import { detectEditMode } from '../../../core/utils/edit-mode.util';
import { PromotionService } from '../../../services/promotion.service';
import { ProductService } from '../../../services/product.service';
import { BrandService } from '../../../core/services/brand.service';
import { AdminFormService } from '../../../core/services/admin-form.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { Promotion, PromotionCreate, PromotionUpdate } from '../../../models/promotion.model';
import { Product } from '../../../models/product.model';
import { Category } from '../../../models/category.model';
import { Brand } from '../../../models/brand.model';

interface SelectOption {
  label: string;
  value: string;
}

// Local UI constants (component-specific)
const CARD_ANIMATION_DELAY = ANIMATION.STAGGER_DELAY;
const CURRENCY_SUFFIX = ' DA';

@Component({
  selector: 'app-admin-add-promotion',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    InputNumberModule,
    TextareaModule,
    SelectModule,
    DatePickerModule,
    ToastModule,
    TranslateModule,
    PageLayoutComponent
  ],
  templateUrl: './admin-add-promotion.component.html',
  styleUrl: './admin-add-promotion.component.scss'
})
export class AdminAddPromotionComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastMessageService);
  private readonly promotionService = inject(PromotionService);
  private readonly productService = inject(ProductService);
  private readonly brandService = inject(BrandService);
  private readonly adminFormService = inject(AdminFormService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translateService = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  promotionForm!: FormGroup;

  readonly loading = signal(false);
  readonly formInitialized = signal(false);
  readonly isEditMode = signal(false);
  readonly currentStep = signal(1);
  readonly totalSteps = 2 as const;
  private readonly editPromotionId = signal<number | null>(null);

  readonly discountTypeOptions = signal<SelectOption[]>([]);
  readonly scopeOptions = signal<SelectOption[]>([]);
  readonly categoryOptions = signal<{ label: string; value: number }[]>([]);
  readonly brandOptions = signal<{ label: string; value: number }[]>([]);
  readonly productOptions = signal<{ label: string; value: number }[]>([]);

  private readonly currentScope = signal<string>(PROMOTION_DEFAULTS.SCOPE);
  private readonly currentDiscountType = signal<string>(PROMOTION_DEFAULTS.DISCOUNT_TYPE);
  private readonly nameValue = signal('');
  private readonly discountValue = signal(PROMOTION_DEFAULTS.DISCOUNT_VALUE);

  readonly pageTitle = computed(() =>
    this.isEditMode() ? 'admin.promotions.edit_promotion' : 'admin.promotions.add_promotion'
  );

  readonly pageSubtitle = computed(() =>
    this.currentStep() === 1
      ? 'admin.promotions.form.step1_subtitle'
      : 'admin.promotions.form.step2_subtitle'
  );

  readonly mobileSubtitle = computed(() =>
    this.isEditMode() ? 'common.edit' : 'common.add'
  );

  readonly mobileTitle = computed(() =>
    this.isEditMode() && this.nameValue() ? this.nameValue() : ''
  );

  readonly submitButtonLabel = computed(() =>
    this.isEditMode() ? 'admin.promotions.form.submit_update' : 'admin.promotions.form.submit_add'
  );

  readonly isPercentageDiscount = computed(() =>
    this.currentDiscountType() === 'percentage'
  );

  readonly maxDiscountValue = computed(() =>
    this.isPercentageDiscount() ? PROMOTION_DEFAULTS.MAX_PERCENTAGE : PROMOTION_DEFAULTS.MAX_FIXED_AMOUNT
  );

  readonly discountSuffix = computed(() =>
    this.isPercentageDiscount() ? '%' : CURRENCY_SUFFIX
  );

  readonly showCategorySelect = computed(() => this.currentScope() === 'category');
  readonly showBrandSelect = computed(() => this.currentScope() === 'brand');
  readonly showProductSelect = computed(() => this.currentScope() === 'product');

  readonly isStep1Valid = computed(() =>
    this.nameValue().length >= VALIDATION.MIN_NAME_LENGTH && this.discountValue() >= PROMOTION_DEFAULTS.MIN_DISCOUNT
  );

  readonly ROUTES = ROUTES;
  readonly MIN_DISCOUNT = PROMOTION_DEFAULTS.MIN_DISCOUNT;
  readonly MIN_USAGE_LIMIT = PROMOTION_DEFAULTS.MIN_USAGE_LIMIT;
  readonly CARD_ANIMATION_DELAY = CARD_ANIMATION_DELAY;
  readonly CURRENCY_SUFFIX = CURRENCY_SUFFIX;
  readonly DATE_FORMAT = DATETIME.PRIMENG_DATE_FORMAT;

  ngOnInit(): void {
    this.initializeOptions();
    this.initializeForm();
    this.loadCategories();
    this.loadBrands();
    this.loadProducts();
    detectEditMode(
      this.route,
      this.destroyRef,
      this.isEditMode,
      this.editPromotionId,
      () => this.loadPromotionForEdit()
    );
    onLanguageChange(this.translateService, this.destroyRef, () => this.initializeOptions());

    setTimeout(() => this.formInitialized.set(true), ANIMATION.NORMAL);
  }

  private initializeOptions(): void {
    this.discountTypeOptions.set(DISCOUNT_TYPES.map(type => ({
      label: this.translateService.instant(`admin.promotions.discount_type.${type}`),
      value: type
    })));

    this.scopeOptions.set(SCOPE_TYPES.map(scope => ({
      label: this.translateService.instant(`admin.promotions.scope.${scope}`),
      value: scope
    })));
  }

  private initializeForm(): void {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    this.promotionForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_NAME_LENGTH)]],
      description: [''],
      code: ['', [Validators.pattern(/^[A-Z0-9_-]+$/i)]],
      discount_type: [PROMOTION_DEFAULTS.DISCOUNT_TYPE, Validators.required],
      discount_value: [PROMOTION_DEFAULTS.DISCOUNT_VALUE, [Validators.required, Validators.min(PROMOTION_DEFAULTS.MIN_DISCOUNT)]],
      scope: [PROMOTION_DEFAULTS.SCOPE, Validators.required],
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

    this.promotionForm.get('scope')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(scope => {
        this.currentScope.set(scope);
        this.updateScopeValidation(scope);
      });

    this.promotionForm.get('discount_type')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(type => this.currentDiscountType.set(type));

    this.promotionForm.get('name')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => this.nameValue.set(value || ''));

    this.promotionForm.get('discount_value')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => this.discountValue.set(value || 0));
  }

  private updateScopeValidation(scope: string): void {
    const categoryControl = this.promotionForm.get('category_id');
    const brandControl = this.promotionForm.get('brand_id');
    const productControl = this.promotionForm.get('product_id');

    categoryControl?.clearValidators();
    brandControl?.clearValidators();
    productControl?.clearValidators();

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

  private loadCategories(): void {
    this.productService.getCategories(true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories: Category[]) => {
          this.categoryOptions.set(categories.map(c => ({ label: c.name, value: c.id })));
        }
      });
  }

  private loadBrands(): void {
    this.brandService.getBrands(true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (brands: Brand[]) => {
          this.brandOptions.set(brands.map(b => ({ label: b.name, value: b.id })));
        }
      });
  }

  private loadProducts(): void {
    this.productService.getProducts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (products: Product[]) => {
          this.productOptions.set(products.map(p => ({ label: p.name, value: p.id })));
        }
      });
  }

  private loadPromotionForEdit(): void {
    const promotionId = this.editPromotionId();
    if (!promotionId) return;

    this.loading.set(true);

    this.promotionService.getPromotion(promotionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (promotion: Promotion) => {
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

          this.currentScope.set(promotion.scope);
          this.currentDiscountType.set(promotion.discount_type);
          this.nameValue.set(promotion.name);
          this.discountValue.set(promotion.discount_value);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.toast.showError('admin.promotions.load_error');
          this.router.navigate([ROUTES.ADMIN.PROMOTIONS]);
        }
      });
  }

  onSubmit(): void {
    if (this.promotionForm.invalid) {
      this.promotionForm.markAllAsTouched();
      return;
    }

    const startDate = this.promotionForm.value.start_date;
    const endDate = this.promotionForm.value.end_date;

    if (endDate <= startDate) {
      this.toast.showError('admin.promotions.form.date_error');
      return;
    }

    this.loading.set(true);

    const formValues = this.promotionForm.value;
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

    const promotionId = this.editPromotionId();
    if (this.isEditMode() && promotionId) {
      this.promotionService.updatePromotion(promotionId, promotionData as PromotionUpdate)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.loading.set(false);
            this.adminFormService.handleSuccess({
              message: 'admin.promotions.update_success',
              redirectUrl: ROUTES.ADMIN.PROMOTIONS,
              redirectDelay: UI_DELAY.TOAST_BEFORE_NAVIGATE
            });
          },
          error: (error) => {
            this.loading.set(false);
            this.adminFormService.handleError('update', error, {
              updateMessage: 'admin.promotions.update_failed'
            });
          }
        });
    } else {
      this.promotionService.createPromotion(promotionData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.loading.set(false);
            this.adminFormService.handleSuccess({
              message: 'admin.promotions.create_success',
              redirectUrl: ROUTES.ADMIN.PROMOTIONS,
              redirectDelay: UI_DELAY.TOAST_BEFORE_NAVIGATE
            });
          },
          error: (error) => {
            this.loading.set(false);
            this.adminFormService.handleError('create', error, {
              createMessage: 'admin.promotions.create_failed'
            });
          }
        });
    }
  }

  toggleActive(): void {
    const control = this.promotionForm.get('is_active');
    control?.setValue(!control.value);
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
}
