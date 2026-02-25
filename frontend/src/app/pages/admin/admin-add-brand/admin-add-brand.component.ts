import { Component, OnInit, signal, inject, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { TranslateModule } from '@ngx-translate/core';

import { ROUTES } from '../../../core/constants/routes.constants';
import { ANIMATION, UI_DELAY, VALIDATION } from '../../../core/constants/app.constants';
import { BrandService } from '../../../core/services/brand.service';
import { Brand } from '../../../models/brand.model';
import { AdminFormService } from '../../../core/services/admin-form.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';

const TRANSLATION_FIELDS = ['name', 'description'] as const;

interface BrandWithTranslations extends Brand {
  name_translations?: { [key: string]: string };
  description_translations?: { [key: string]: string };
}

@Component({
  selector: 'app-admin-add-brand',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    TextareaModule,
    ToastModule,
    TranslateModule,
    PageLayoutComponent
  ],
  templateUrl: './admin-add-brand.component.html',
  styleUrl: './admin-add-brand.component.scss'
})
export class AdminAddBrandComponent implements OnInit {
  private readonly toast = inject(ToastMessageService);
  private readonly brandService = inject(BrandService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly adminFormService = inject(AdminFormService);
  private readonly destroyRef = inject(DestroyRef);

  brandForm!: FormGroup;

  readonly loading = signal(false);
  readonly formInitialized = signal(false);
  readonly isEditMode = signal(false);
  private readonly editBrandId = signal<number | null>(null);

  readonly pageTitle = computed(() =>
    this.isEditMode() ? 'admin.brands.edit_brand' : 'admin.brands.add_brand'
  );

  readonly pageSubtitle = computed(() =>
    this.isEditMode() ? 'admin.brands.form.edit_subtitle' : 'admin.brands.form.add_subtitle'
  );

  readonly mobileSubtitle = computed(() =>
    this.isEditMode() ? 'common.edit' : 'common.add'
  );

  readonly submitButtonLabel = computed(() =>
    this.isEditMode() ? 'admin.brands.form.submit_update' : 'admin.brands.form.submit_add'
  );

  readonly ROUTES = ROUTES;

  toggleActive(): void {
    const control = this.brandForm.get('is_active');
    control?.setValue(!control.value);
  }

  ngOnInit(): void {
    this.brandForm = this.adminFormService.buildTranslationFormGroup(
      [
        { name: 'name', required: true, minLength: VALIDATION.MIN_NAME_LENGTH },
        { name: 'description', required: false }
      ],
      { logo_url: [''], is_active: [true] }
    );

    this.detectMode();
    setTimeout(() => this.formInitialized.set(true), ANIMATION.NORMAL);
  }

  private detectMode(): void {
    const routeData = this.route.snapshot.data;
    if (routeData['mode'] === 'edit') {
      this.isEditMode.set(true);
    }

    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const id = params.get('id');
        if (id) {
          this.editBrandId.set(parseInt(id, 10));
          this.isEditMode.set(true);
          this.loadBrandForEdit();
        }
      });
  }

  private loadBrandForEdit(): void {
    const brandId = this.editBrandId();
    if (!brandId) return;

    this.loading.set(true);

    this.brandService.getBrand(brandId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (brand) => {
          const brandWithTranslations = brand as BrandWithTranslations;

          this.adminFormService.populateFormWithTranslations(
            this.brandForm,
            brandWithTranslations,
            [...TRANSLATION_FIELDS],
            { logo_url: brand.logo_url || '', is_active: brand.is_active }
          );

          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.toast.showError('brands.load_error');
          this.router.navigate([ROUTES.ADMIN.BRANDS]);
        }
      });
  }

  onSubmit(): void {
    if (this.brandForm.invalid) {
      this.brandForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);

    const formValues = this.brandForm.value;
    const brandData = this.adminFormService.buildFormDataWithTranslations(
      formValues,
      [...TRANSLATION_FIELDS],
      { logo_url: formValues.logo_url || '', is_active: formValues.is_active }
    );

    const brandId = this.editBrandId();
    if (this.isEditMode() && brandId) {
      this.brandService.updateBrand(brandId, brandData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.loading.set(false);
            this.adminFormService.handleSuccess({
              message: 'admin.brands.update_success',
              redirectUrl: ROUTES.ADMIN.BRANDS,
              redirectDelay: UI_DELAY.TOAST_BEFORE_NAVIGATE
            });
          },
          error: (error) => {
            this.loading.set(false);
            this.adminFormService.handleError('update', error, {
              updateMessage: 'admin.brands.update_failed'
            });
          }
        });
    } else {
      this.brandService.createBrand(brandData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.loading.set(false);
            this.adminFormService.handleSuccess({
              message: 'admin.brands.create_success',
              redirectUrl: ROUTES.ADMIN.BRANDS,
              redirectDelay: UI_DELAY.TOAST_BEFORE_NAVIGATE
            });
          },
          error: (error) => {
            this.loading.set(false);
            this.adminFormService.handleError('create', error, {
              createMessage: 'admin.brands.create_failed'
            });
          }
        });
    }
  }
}
