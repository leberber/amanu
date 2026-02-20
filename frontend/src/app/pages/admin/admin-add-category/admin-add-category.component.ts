// src/app/pages/admin/admin-add-category/admin-add-category.component.ts
import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { CheckboxModule } from 'primeng/checkbox';
import { ToastModule } from 'primeng/toast';
import { CardModule } from 'primeng/card';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ROUTES } from '../../../core/constants/routes.constants';
import { ProductService } from '../../../services/product.service';
import { Category } from '../../../models/category.model';
import { VALIDATION } from '../../../core/constants/app.constants';
import { AdminFormService } from '../../../core/services/admin-form.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';

// 🆕 UPDATED: Extended Category interface to include translations
interface CategoryWithTranslations extends Category {
  name_translations?: { [key: string]: string };
  description_translations?: { [key: string]: string };
}

@Component({
  selector: 'app-admin-add-category',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    CheckboxModule,
    ToastModule,
    CardModule,
    TranslateModule
  ],
  templateUrl: './admin-add-category.component.html',
  styleUrl: './admin-add-category.component.scss'
})
export class AdminAddCategoryComponent implements OnInit {
  visible = signal(false);
  loading = signal(false);
  categoryForm!: FormGroup;

  // NEW: Add page-based properties
  isEditMode = signal(false);
  editCategoryId: number | null = null;
  currentCategory: CategoryWithTranslations | null = null;

  // NEW: Computed properties for page mode
  get pageTitle(): string {
    return this.isEditMode() ? 'admin.categories.edit_category' : 'admin.categories.add_category';
  }

  get submitButtonLabel(): string {
    return this.isEditMode() ? 'admin.categories.form.submit_update' : 'admin.categories.form.submit_add';
  }

  private fb = inject(FormBuilder);
  private toast = inject(ToastMessageService);
  private productService = inject(ProductService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translateService = inject(TranslateService);
  private adminFormService = inject(AdminFormService);

  ngOnInit() {
    // Use AdminFormService to build translation form
    this.categoryForm = this.adminFormService.buildTranslationFormGroup(
      [
        { name: 'name', required: true, minLength: VALIDATION.MIN_NAME_LENGTH },
        { name: 'description', required: false }
      ],
      { image_url: [''], is_active: [true] }
    );

    this.detectMode();
  }

  // NEW: Mode detection method
  detectMode() {
    const routeData = this.route.snapshot.data;
    if (routeData['mode'] === 'edit') {
      this.isEditMode.set(true);
    }

    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.editCategoryId = parseInt(id, 10);
        this.isEditMode.set(true);
        this.loadCategoryForEdit();
      }
    });
  }

  // Load category for editing
  loadCategoryForEdit() {
    if (!this.editCategoryId) return;

    this.loading.set(true);

    this.productService.getCategory(this.editCategoryId).subscribe({
      next: (category) => {
        this.currentCategory = category as CategoryWithTranslations;

        // Use AdminFormService to populate form with translations
        this.adminFormService.populateFormWithTranslations(
          this.categoryForm,
          this.currentCategory,
          ['name', 'description'],
          { image_url: category.image_url || '', is_active: category.is_active }
        );

        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading category:', error);
        this.loading.set(false);
        this.toast.showError('categories.load_error');
        this.goBackToCategoriesList();
      }
    });
  }

  // Original modal method for backward compatibility
  show() {
    this.visible.set(true);
    const resetValues = this.adminFormService.getTranslationFormResetValues(
      ['name', 'description'],
      { image_url: '', is_active: true }
    );
    this.categoryForm.reset(resetValues);
  }

  // UPDATED: Cancel method that works for both modal and page
  onCancel() {
    if (!this.visible()) {
      // Page mode - navigate back
      this.goBackToCategoriesList();
    } else {
      // Modal mode - close modal
      this.visible.set(false);
      this.categoryForm.reset();
    }
  }

  // NEW: Navigation method for page mode
  goBackToCategoriesList() {
    this.router.navigate([ROUTES.ADMIN.CATEGORIES]);
  }

  onSubmit() {
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);

    const formValues = this.categoryForm.value;

    // Use AdminFormService to build category data with translations
    const categoryData = this.adminFormService.buildFormDataWithTranslations(
      formValues,
      ['name', 'description'],
      { image_url: formValues.image_url || '', is_active: formValues.is_active }
    );

    const isUpdate = this.isEditMode() && this.editCategoryId;
    const operation$ = isUpdate
      ? this.productService.updateCategory(this.editCategoryId!, categoryData)
      : this.productService.createCategory(categoryData);

    operation$.subscribe({
      next: () => {
        this.loading.set(false);
        this.handleSuccess(isUpdate ? 'update' : 'create');
      },
      error: (error) => {
        this.loading.set(false);
        this.handleError(isUpdate ? 'update' : 'create', error);
      }
    });
  }

  private handleSuccess(operation: 'create' | 'update') {
    const messageKey = operation === 'create'
      ? 'admin.categories.create_success'
      : 'admin.categories.update_success';

    if (this.visible()) {
      // Modal mode - close modal and reset
      this.toast.showSuccess(messageKey);
      this.visible.set(false);
      const resetValues = this.adminFormService.getTranslationFormResetValues(
        ['name', 'description'],
        { image_url: '', is_active: true }
      );
      this.categoryForm.reset(resetValues);
    } else {
      // Page mode - navigate back after delay
      this.adminFormService.handleSuccessWithRedirect(messageKey, ROUTES.ADMIN.CATEGORIES);
    }
  }

  private handleError(operation: 'create' | 'update', error: any) {
    this.adminFormService.handleError(operation, error, {
      createMessage: 'admin.categories.create_failed',
      updateMessage: 'admin.categories.update_failed'
    });
  }
}