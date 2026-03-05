import { Component, OnInit, signal, inject, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { DatePickerModule } from 'primeng/datepicker';
import { ToastModule } from 'primeng/toast';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ROUTES } from '../../../core/constants/routes.constants';
import { ANIMATION, UI_DELAY, DATETIME } from '../../../core/constants/ui.constants';
import { VALIDATION } from '../../../core/constants/validation.constants';
import { DISCOUNT_TYPES, PROMOTION_DEFAULTS } from '../../../core/constants/promotion.constants';
import { onLanguageChange } from '../../../core/utils/language-change.util';
import { detectEditMode } from '../../../core/utils/edit-mode.util';
import { CrossSellPromotionService } from '../../../services/cross-sell-promotion.service';
import { ProductService } from '../../../services/product.service';
import { AdminFormService } from '../../../core/services/admin-form.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { CrossSellPromotion, CrossSellPromotionCreate, CrossSellPromotionUpdate } from '../../../models/cross-sell-promotion.model';
import { Product } from '../../../models/product.model';

interface SelectOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-admin-add-cross-sell-promotion',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    MultiSelectModule,
    DatePickerModule,
    ToastModule,
    TranslateModule,
    PageLayoutComponent
  ],
  templateUrl: './admin-add-cross-sell-promotion.component.html',
  styleUrl: './admin-add-cross-sell-promotion.component.scss'
})
export class AdminAddCrossSellPromotionComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastMessageService);
  private readonly crossSellService = inject(CrossSellPromotionService);
  private readonly productService = inject(ProductService);
  private readonly adminFormService = inject(AdminFormService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translateService = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly currencyService = inject(CurrencyService);

  promotionForm!: FormGroup;

  readonly loading = signal(false);
  readonly formInitialized = signal(false);
  readonly isEditMode = signal(false);
  private readonly editPromotionId = signal<number | null>(null);

  readonly discountTypeOptions = signal<SelectOption[]>([]);
  readonly productOptions = signal<{ label: string; value: number }[]>([]);

  private readonly currentDiscountType = signal<string>(PROMOTION_DEFAULTS.DISCOUNT_TYPE);
  private readonly nameValue = signal('');
  private readonly discountValue = signal(PROMOTION_DEFAULTS.DISCOUNT_VALUE);

  readonly pageTitle = computed(() =>
    this.isEditMode() ? 'admin.promotions.cross_sell.edit' : 'admin.promotions.cross_sell.add'
  );

  readonly pageSubtitle = computed(() =>
    this.isEditMode() ? 'admin.promotions.cross_sell.form.edit_subtitle' : 'admin.promotions.cross_sell.form.add_subtitle'
  );

  readonly mobileSubtitle = computed(() =>
    this.isEditMode() ? 'common.edit' : 'common.add'
  );

  readonly mobileTitle = computed(() =>
    this.isEditMode() && this.nameValue() ? this.nameValue() : ''
  );

  readonly submitButtonLabel = computed(() =>
    this.isEditMode() ? 'admin.promotions.cross_sell.form.submit_update' : 'admin.promotions.cross_sell.form.submit_add'
  );

  readonly isPercentageDiscount = computed(() =>
    this.currentDiscountType() === 'percentage'
  );

  readonly maxDiscountValue = computed(() =>
    this.isPercentageDiscount() ? PROMOTION_DEFAULTS.MAX_PERCENTAGE : PROMOTION_DEFAULTS.MAX_FIXED_AMOUNT
  );

  readonly discountSuffix = computed(() =>
    this.isPercentageDiscount() ? '%' : ` ${this.currencyService.getCurrencySymbol()}`
  );

  readonly isFormValid = computed(() =>
    this.nameValue().length >= VALIDATION.MIN_NAME_LENGTH && this.discountValue() >= PROMOTION_DEFAULTS.MIN_DISCOUNT
  );

  readonly ROUTES = ROUTES;
  readonly ANIMATION = ANIMATION;
  readonly MIN_DISCOUNT = PROMOTION_DEFAULTS.MIN_DISCOUNT;
  readonly DATE_FORMAT = DATETIME.PRIMENG_DATE_FORMAT;

  readonly currencySuffix = computed(() => ` ${this.currencyService.getCurrencySymbol()}`);

  ngOnInit(): void {
    this.initializeOptions();
    this.initializeForm();
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
  }

  private initializeForm(): void {
    this.promotionForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_NAME_LENGTH)]],
      target_product_id: [null, Validators.required],
      trigger_product_ids: [[], [Validators.required, Validators.minLength(1)]],
      discount_type: [PROMOTION_DEFAULTS.DISCOUNT_TYPE, Validators.required],
      discount_value: [PROMOTION_DEFAULTS.DISCOUNT_VALUE, [Validators.required, Validators.min(PROMOTION_DEFAULTS.MIN_DISCOUNT)]],
      min_trigger_quantity: [1, [Validators.required, Validators.min(1)]],
      start_date: [null],
      end_date: [null],
      is_active: [true]
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

    this.crossSellService.getPromotion(promotionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (promotion: CrossSellPromotion) => {
          this.promotionForm.patchValue({
            name: promotion.name,
            target_product_id: promotion.target_product_id,
            trigger_product_ids: promotion.trigger_product_ids,
            discount_type: promotion.discount_type,
            discount_value: promotion.discount_value,
            min_trigger_quantity: promotion.min_trigger_quantity,
            start_date: promotion.start_date ? new Date(promotion.start_date) : null,
            end_date: promotion.end_date ? new Date(promotion.end_date) : null,
            is_active: promotion.is_active
          });

          this.currentDiscountType.set(promotion.discount_type);
          this.nameValue.set(promotion.name);
          this.discountValue.set(promotion.discount_value);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.toast.showError('admin.promotions.cross_sell.load_error');
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

    if (startDate && endDate && endDate <= startDate) {
      this.toast.showError('admin.promotions.form.date_error');
      return;
    }

    this.loading.set(true);

    const formValues = this.promotionForm.value;
    const promotionData: CrossSellPromotionCreate = {
      name: formValues.name,
      target_product_id: formValues.target_product_id,
      trigger_product_ids: formValues.trigger_product_ids,
      discount_type: formValues.discount_type,
      discount_value: formValues.discount_value,
      min_trigger_quantity: formValues.min_trigger_quantity,
      start_date: formValues.start_date?.toISOString(),
      end_date: formValues.end_date?.toISOString(),
      is_active: formValues.is_active
    };

    const promotionId = this.editPromotionId();
    if (this.isEditMode() && promotionId) {
      this.crossSellService.updatePromotion(promotionId, promotionData as CrossSellPromotionUpdate)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.loading.set(false);
            this.adminFormService.handleSuccess({
              message: 'admin.promotions.cross_sell.update_success',
              redirectUrl: ROUTES.ADMIN.PROMOTIONS,
              redirectDelay: UI_DELAY.TOAST_BEFORE_NAVIGATE
            });
          },
          error: (error) => {
            this.loading.set(false);
            this.adminFormService.handleError('update', error, {
              updateMessage: 'admin.promotions.cross_sell.update_failed'
            });
          }
        });
    } else {
      this.crossSellService.createPromotion(promotionData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.loading.set(false);
            this.adminFormService.handleSuccess({
              message: 'admin.promotions.cross_sell.create_success',
              redirectUrl: ROUTES.ADMIN.PROMOTIONS,
              redirectDelay: UI_DELAY.TOAST_BEFORE_NAVIGATE
            });
          },
          error: (error) => {
            this.loading.set(false);
            this.adminFormService.handleError('create', error, {
              createMessage: 'admin.promotions.cross_sell.create_failed'
            });
          }
        });
    }
  }

  toggleActive(): void {
    const control = this.promotionForm.get('is_active');
    control?.setValue(!control.value);
  }
}
