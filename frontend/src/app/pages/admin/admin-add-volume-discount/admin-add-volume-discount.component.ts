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
import { PROMOTION_DEFAULTS } from '../../../core/constants/promotion.constants';
import { onLanguageChange } from '../../../core/utils/language-change.util';
import { detectEditMode } from '../../../core/utils/edit-mode.util';
import { VolumeDiscountService } from '../../../services/volume-discount.service';
import { ProductService } from '../../../services/product.service';
import { AdminFormService } from '../../../core/services/admin-form.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { VolumeDiscount, VolumeDiscountCreate, VolumeDiscountUpdate, VolumeDiscountType } from '../../../models/volume-discount.model';
import { Product } from '../../../models/product.model';

interface SelectOption {
  label: string;
  value: string;
}

const VOLUME_DISCOUNT_TYPES: VolumeDiscountType[] = ['percentage', 'fixed_amount', 'free_units'];

@Component({
  selector: 'app-admin-add-volume-discount',
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
  templateUrl: './admin-add-volume-discount.component.html',
  styleUrl: './admin-add-volume-discount.component.scss'
})
export class AdminAddVolumeDiscountComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastMessageService);
  private readonly volumeDiscountService = inject(VolumeDiscountService);
  private readonly productService = inject(ProductService);
  private readonly adminFormService = inject(AdminFormService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translateService = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly currencyService = inject(CurrencyService);

  discountForm!: FormGroup;

  readonly loading = signal(false);
  readonly formInitialized = signal(false);
  readonly isEditMode = signal(false);
  private readonly editDiscountId = signal<number | null>(null);

  readonly discountTypeOptions = signal<SelectOption[]>([]);
  readonly productOptions = signal<{ label: string; value: number }[]>([]);

  private readonly currentDiscountType = signal<VolumeDiscountType>('percentage');
  private readonly nameValue = signal('');
  private readonly discountValue = signal(PROMOTION_DEFAULTS.DISCOUNT_VALUE);

  readonly pageTitle = computed(() =>
    this.isEditMode() ? 'admin.promotions.volume_discount.edit' : 'admin.promotions.volume_discount.add'
  );

  readonly pageSubtitle = computed(() =>
    this.isEditMode() ? 'admin.promotions.volume_discount.form.edit_subtitle' : 'admin.promotions.volume_discount.form.add_subtitle'
  );

  readonly mobileSubtitle = computed(() =>
    this.isEditMode() ? 'common.edit' : 'common.add'
  );

  readonly mobileTitle = computed(() =>
    this.isEditMode() && this.nameValue() ? this.nameValue() : ''
  );

  readonly submitButtonLabel = computed(() =>
    this.isEditMode() ? 'admin.promotions.volume_discount.form.submit_update' : 'admin.promotions.volume_discount.form.submit_add'
  );

  readonly isPercentageDiscount = computed(() =>
    this.currentDiscountType() === 'percentage'
  );

  readonly isFreeUnitsDiscount = computed(() =>
    this.currentDiscountType() === 'free_units'
  );

  readonly maxDiscountValue = computed(() => {
    if (this.isPercentageDiscount()) return PROMOTION_DEFAULTS.MAX_PERCENTAGE;
    if (this.isFreeUnitsDiscount()) return 100; // Max free units
    return PROMOTION_DEFAULTS.MAX_FIXED_AMOUNT;
  });

  readonly discountSuffix = computed(() => {
    if (this.isPercentageDiscount()) return '%';
    if (this.isFreeUnitsDiscount()) return '';
    return ` ${this.currencyService.getCurrencySymbol()}`;
  });

  readonly discountLabel = computed(() => {
    if (this.isFreeUnitsDiscount()) {
      return 'admin.promotions.volume_discount.form.free_units_hint';
    }
    return 'admin.promotions.volume_discount.form.discount_value';
  });

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
      this.editDiscountId,
      () => this.loadDiscountForEdit()
    );
    onLanguageChange(this.translateService, this.destroyRef, () => this.initializeOptions());

    setTimeout(() => this.formInitialized.set(true), ANIMATION.NORMAL);
  }

  private initializeOptions(): void {
    this.discountTypeOptions.set(VOLUME_DISCOUNT_TYPES.map(type => ({
      label: this.translateService.instant(`admin.promotions.volume_discount.type.${type}`),
      value: type
    })));
  }

  private initializeForm(): void {
    this.discountForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_NAME_LENGTH)]],
      description: [''],
      product_id: [null, Validators.required],
      min_quantity: [5, [Validators.required, Validators.min(1)]],
      discount_type: ['percentage', Validators.required],
      discount_value: [PROMOTION_DEFAULTS.DISCOUNT_VALUE, [Validators.required, Validators.min(PROMOTION_DEFAULTS.MIN_DISCOUNT)]],
      start_date: [null, Validators.required],
      end_date: [null, Validators.required],
      is_active: [true]
    });

    this.discountForm.get('discount_type')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(type => this.currentDiscountType.set(type));

    this.discountForm.get('name')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => this.nameValue.set(value || ''));

    this.discountForm.get('discount_value')?.valueChanges
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

  private loadDiscountForEdit(): void {
    const discountId = this.editDiscountId();
    if (!discountId) return;

    this.loading.set(true);

    this.volumeDiscountService.getById(discountId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (discount: VolumeDiscount) => {
          this.discountForm.patchValue({
            name: discount.name,
            description: discount.description || '',
            product_id: discount.product_id,
            min_quantity: discount.min_quantity,
            discount_type: discount.discount_type,
            discount_value: discount.discount_value,
            start_date: discount.start_date ? new Date(discount.start_date) : null,
            end_date: discount.end_date ? new Date(discount.end_date) : null,
            is_active: discount.is_active
          });

          this.currentDiscountType.set(discount.discount_type);
          this.nameValue.set(discount.name);
          this.discountValue.set(discount.discount_value);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.toast.showError('admin.promotions.volume_discount.load_error');
          this.router.navigate([ROUTES.ADMIN.PROMOTIONS]);
        }
      });
  }

  onSubmit(): void {
    if (this.discountForm.invalid) {
      this.discountForm.markAllAsTouched();
      return;
    }

    const startDate = this.discountForm.value.start_date;
    const endDate = this.discountForm.value.end_date;

    if (startDate && endDate && endDate <= startDate) {
      this.toast.showError('admin.promotions.form.date_error');
      return;
    }

    this.loading.set(true);

    const formValues = this.discountForm.value;
    const discountData: VolumeDiscountCreate = {
      name: formValues.name,
      description: formValues.description || undefined,
      product_id: formValues.product_id,
      min_quantity: formValues.min_quantity,
      discount_type: formValues.discount_type,
      discount_value: formValues.discount_value,
      start_date: formValues.start_date?.toISOString(),
      end_date: formValues.end_date?.toISOString(),
      is_active: formValues.is_active
    };

    const discountId = this.editDiscountId();
    if (this.isEditMode() && discountId) {
      this.volumeDiscountService.update(discountId, discountData as VolumeDiscountUpdate)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.loading.set(false);
            this.adminFormService.handleSuccess({
              message: 'admin.promotions.volume_discount.update_success',
              redirectUrl: ROUTES.ADMIN.PROMOTIONS,
              redirectDelay: UI_DELAY.TOAST_BEFORE_NAVIGATE
            });
          },
          error: (error) => {
            this.loading.set(false);
            this.adminFormService.handleError('update', error, {
              updateMessage: 'admin.promotions.volume_discount.update_failed'
            });
          }
        });
    } else {
      this.volumeDiscountService.create(discountData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.loading.set(false);
            this.adminFormService.handleSuccess({
              message: 'admin.promotions.volume_discount.create_success',
              redirectUrl: ROUTES.ADMIN.PROMOTIONS,
              redirectDelay: UI_DELAY.TOAST_BEFORE_NAVIGATE
            });
          },
          error: (error) => {
            this.loading.set(false);
            this.adminFormService.handleError('create', error, {
              createMessage: 'admin.promotions.volume_discount.create_failed'
            });
          }
        });
    }
  }

  toggleActive(): void {
    const control = this.discountForm.get('is_active');
    control?.setValue(!control.value);
  }
}
