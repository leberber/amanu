import { Component, OnInit, signal, inject, computed, DestroyRef } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ROUTES } from '../../../core/constants/routes.constants';
import { ANIMATION, UI_DELAY } from '../../../core/constants/ui.constants';
import { ShippingService } from '../../../services/shipping.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { ShippingPriceConfig, ShippingDiscountTier, DeliveryZoneStats } from '../../../models/shipping.model';

@Component({
  selector: 'app-admin-shipping-config',
  standalone: true,
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    InputTextModule,
    InputNumberModule,
    ToastModule,
    ButtonModule,
    TranslateModule,
    PageLayoutComponent
  ],
  templateUrl: './admin-shipping-config.component.html',
  styleUrl: './admin-shipping-config.component.scss'
})
export class AdminShippingConfigComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastMessageService);
  private readonly shippingService = inject(ShippingService);
  private readonly router = inject(Router);
  private readonly translateService = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly currencyService = inject(CurrencyService);

  configForm!: FormGroup;

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly formInitialized = signal(false);
  readonly configExists = signal(false);
  readonly zoneStats = signal<DeliveryZoneStats | null>(null);

  readonly currencySuffix = computed(() => ` ${this.currencyService.getCurrencySymbol()}`);

  readonly ROUTES = ROUTES;
  readonly ANIMATION = ANIMATION;

  get discountTiers(): FormArray {
    return this.configForm.get('shipping_discount_tiers') as FormArray;
  }

  ngOnInit(): void {
    this.initializeForm();
    this.loadConfig();
  }

  private initializeForm(): void {
    this.configForm = this.fb.group({
      warehouse_id: ['default', Validators.required],
      base_cost: [200, [Validators.required, Validators.min(0)]],
      price_per_km: [30, [Validators.required, Validators.min(0)]],
      price_per_kg: [10, [Validators.required, Validators.min(0)]],
      price_per_m3: [500, [Validators.required, Validators.min(0)]],
      price_per_min: [0, [Validators.required, Validators.min(0)]],
      min_shipping_cost: [200, [Validators.required, Validators.min(0)]],
      max_shipping_cost: [5000, [Validators.required, Validators.min(0)]],
      shipping_discount_tiers: this.fb.array([]),
      is_active: [true]
    });

    setTimeout(() => this.formInitialized.set(true), ANIMATION.NORMAL);
  }

  private loadConfig(): void {
    this.loading.set(true);

    this.shippingService.getConfigByWarehouse('default')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (config: ShippingPriceConfig) => {
          this.configExists.set(true);
          this.patchForm(config);
          this.loadZoneStats();
          this.loading.set(false);
        },
        error: () => {
          // Config doesn't exist, use defaults
          this.configExists.set(false);
          this.loading.set(false);
        }
      });
  }

  private loadZoneStats(): void {
    this.shippingService.getZoneStats('default')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (stats) => this.zoneStats.set(stats),
        error: () => {} // Silently fail
      });
  }

  private patchForm(config: ShippingPriceConfig): void {
    this.configForm.patchValue({
      warehouse_id: config.warehouse_id,
      base_cost: config.base_cost,
      price_per_km: config.price_per_km,
      price_per_kg: config.price_per_kg,
      price_per_m3: config.price_per_m3,
      price_per_min: config.price_per_min,
      min_shipping_cost: config.min_shipping_cost,
      max_shipping_cost: config.max_shipping_cost,
      is_active: config.is_active
    });

    // Clear existing tiers and add from config
    this.discountTiers.clear();
    if (config.shipping_discount_tiers && config.shipping_discount_tiers.length > 0) {
      config.shipping_discount_tiers.forEach(tier => this.addTier(tier));
    }
  }

  addTier(tier?: ShippingDiscountTier): void {
    const tierGroup = this.fb.group({
      min_order: [tier?.min_order || 5000, [Validators.required, Validators.min(1)]],
      discount_percent: [tier?.discount_percent || 10, [Validators.required, Validators.min(1), Validators.max(100)]]
    });
    this.discountTiers.push(tierGroup);
  }

  removeTier(index: number): void {
    this.discountTiers.removeAt(index);
  }

  onSubmit(): void {
    if (this.configForm.invalid) {
      this.configForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);

    const formValues = this.configForm.value;

    // Sort tiers by min_order ascending
    const sortedTiers = [...(formValues.shipping_discount_tiers || [])].sort(
      (a: ShippingDiscountTier, b: ShippingDiscountTier) => a.min_order - b.min_order
    );

    const configData = {
      ...formValues,
      shipping_discount_tiers: sortedTiers.length > 0 ? sortedTiers : null
    };

    if (this.configExists()) {
      this.shippingService.updateConfig('default', configData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.toast.showSuccess('admin.shipping.update_success');
          },
          error: () => {
            this.saving.set(false);
            this.toast.showError('admin.shipping.update_failed');
          }
        });
    } else {
      this.shippingService.createConfig(configData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.configExists.set(true);
            this.toast.showSuccess('admin.shipping.create_success');
          },
          error: () => {
            this.saving.set(false);
            this.toast.showError('admin.shipping.create_failed');
          }
        });
    }
  }

  toggleActive(): void {
    const control = this.configForm.get('is_active');
    control?.setValue(!control.value);
  }
}
