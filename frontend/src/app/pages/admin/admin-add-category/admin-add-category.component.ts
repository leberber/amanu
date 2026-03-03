import { Component, OnInit, signal, inject, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { TranslateModule } from '@ngx-translate/core';

import { ROUTES } from '../../../core/constants/routes.constants';
import { ANIMATION, UI_DELAY } from '../../../core/constants/ui.constants';
import { VALIDATION } from '../../../core/constants/validation.constants';
import { ProductService } from '../../../services/product.service';
import { Category } from '../../../models/category.model';
import { AdminFormService } from '../../../core/services/admin-form.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';

const TRANSLATION_FIELDS = ['name', 'description'] as const;

interface CategoryWithTranslations extends Category {
  name_translations?: { [key: string]: string };
  description_translations?: { [key: string]: string };
}

@Component({
  selector: 'app-admin-add-category',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    TextareaModule,
    ToastModule,
    TranslateModule,
    PageLayoutComponent
  ],
  templateUrl: './admin-add-category.component.html',
  styleUrl: './admin-add-category.component.scss'
})
export class AdminAddCategoryComponent implements OnInit {
  private readonly toast = inject(ToastMessageService);
  private readonly productService = inject(ProductService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly adminFormService = inject(AdminFormService);
  private readonly destroyRef = inject(DestroyRef);

  categoryForm!: FormGroup;

  readonly loading = signal(false);
  readonly formInitialized = signal(false);
  readonly isEditMode = signal(false);
  private readonly editCategoryId = signal<number | null>(null);

  readonly pageTitle = computed(() =>
    this.isEditMode() ? 'admin.categories.edit_category' : 'admin.categories.add_category'
  );

  readonly pageSubtitle = computed(() =>
    this.isEditMode() ? 'admin.categories.form.edit_subtitle' : 'admin.categories.form.add_subtitle'
  );

  readonly mobileSubtitle = computed(() =>
    this.isEditMode() ? 'common.edit' : 'common.add'
  );

  readonly submitButtonLabel = computed(() =>
    this.isEditMode() ? 'admin.categories.form.submit_update' : 'admin.categories.form.submit_add'
  );

  readonly ROUTES = ROUTES;

  toggleActive(): void {
    const control = this.categoryForm.get('is_active');
    control?.setValue(!control.value);
  }

  ngOnInit(): void {
    this.categoryForm = this.adminFormService.buildTranslationFormGroup(
      [
        { name: 'name', required: true, minLength: VALIDATION.MIN_NAME_LENGTH },
        { name: 'description', required: false }
      ],
      { image_url: [''], is_active: [true] }
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
          this.editCategoryId.set(parseInt(id, 10));
          this.isEditMode.set(true);
          this.loadCategoryForEdit();
        }
      });
  }

  private loadCategoryForEdit(): void {
    const categoryId = this.editCategoryId();
    if (!categoryId) return;

    this.loading.set(true);

    this.productService.getCategory(categoryId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (category) => {
          const categoryWithTranslations = category as CategoryWithTranslations;

          this.adminFormService.populateFormWithTranslations(
            this.categoryForm,
            categoryWithTranslations,
            [...TRANSLATION_FIELDS],
            { image_url: category.image_url || '', is_active: category.is_active }
          );

          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.toast.showError('categories.load_error');
          this.router.navigate([ROUTES.ADMIN.CATEGORIES]);
        }
      });
  }

  onSubmit(): void {
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);

    const formValues = this.categoryForm.value;
    const categoryData = this.adminFormService.buildFormDataWithTranslations(
      formValues,
      [...TRANSLATION_FIELDS],
      { image_url: formValues.image_url || '', is_active: formValues.is_active }
    );

    const categoryId = this.editCategoryId();
    if (this.isEditMode() && categoryId) {
      this.productService.updateCategory(categoryId, categoryData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.loading.set(false);
            this.adminFormService.handleSuccess({
              message: 'admin.categories.update_success',
              redirectUrl: ROUTES.ADMIN.CATEGORIES,
              redirectDelay: UI_DELAY.TOAST_BEFORE_NAVIGATE
            });
          },
          error: (error) => {
            this.loading.set(false);
            this.adminFormService.handleError('update', error, {
              updateMessage: 'admin.categories.update_failed'
            });
          }
        });
    } else {
      this.productService.createCategory(categoryData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.loading.set(false);
            this.adminFormService.handleSuccess({
              message: 'admin.categories.create_success',
              redirectUrl: ROUTES.ADMIN.CATEGORIES,
              redirectDelay: UI_DELAY.TOAST_BEFORE_NAVIGATE
            });
          },
          error: (error) => {
            this.loading.set(false);
            this.adminFormService.handleError('create', error, {
              createMessage: 'admin.categories.create_failed'
            });
          }
        });
    }
  }
}
