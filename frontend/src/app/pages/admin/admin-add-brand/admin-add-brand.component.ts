// src/app/pages/admin/admin-add-brand/admin-add-brand.component.ts
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
import { BrandService } from '../../../core/services/brand.service';
import { Brand } from '../../../models/brand.model';
import { VALIDATION } from '../../../core/constants/app.constants';
import { AdminFormService } from '../../../core/services/admin-form.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';

interface BrandWithTranslations extends Brand {
  name_translations?: { [key: string]: string };
  description_translations?: { [key: string]: string };
}

@Component({
  selector: 'app-admin-add-brand',
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
    templateUrl: './admin-add-brand.component.html',
  styleUrl: './admin-add-brand.component.scss'
})
export class AdminAddBrandComponent implements OnInit {
  visible = signal(false);
  loading = signal(false);
  brandForm!: FormGroup;

  isEditMode = signal(false);
  editBrandId: number | null = null;
  currentBrand: BrandWithTranslations | null = null;

  get pageTitle(): string {
    return this.isEditMode() ? 'admin.brands.edit_brand' : 'admin.brands.add_brand';
  }

  get submitButtonLabel(): string {
    return this.isEditMode() ? 'admin.brands.form.submit_update' : 'admin.brands.form.submit_add';
  }

  private fb = inject(FormBuilder);
  private toast = inject(ToastMessageService);
  private brandService = inject(BrandService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translateService = inject(TranslateService);
  private adminFormService = inject(AdminFormService);

  ngOnInit() {
    // Use AdminFormService to build translation form
    this.brandForm = this.adminFormService.buildTranslationFormGroup(
      [
        { name: 'name', required: true, minLength: VALIDATION.MIN_NAME_LENGTH },
        { name: 'description', required: false }
      ],
      { logo_url: [''], is_active: [true] }
    );

    this.detectMode();
  }

  detectMode() {
    const routeData = this.route.snapshot.data;
    if (routeData['mode'] === 'edit') {
      this.isEditMode.set(true);
    }

    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.editBrandId = parseInt(id, 10);
        this.isEditMode.set(true);
        this.loadBrandForEdit();
      }
    });
  }

  loadBrandForEdit() {
    if (!this.editBrandId) return;

    this.loading.set(true);

    this.brandService.getBrand(this.editBrandId).subscribe({
      next: (brand) => {
        this.currentBrand = brand as BrandWithTranslations;

        // Use AdminFormService to populate form with translations
        this.adminFormService.populateFormWithTranslations(
          this.brandForm,
          this.currentBrand,
          ['name', 'description'],
          { logo_url: brand.logo_url || '', is_active: brand.is_active }
        );

        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.showError('admin.brands.load_error');
        this.goBackToBrandsList();
      }
    });
  }

  show() {
    this.visible.set(true);
    const resetValues = this.adminFormService.getTranslationFormResetValues(
      ['name', 'description'],
      { logo_url: '', is_active: true }
    );
    this.brandForm.reset(resetValues);
  }

  onCancel() {
    if (!this.visible()) {
      this.goBackToBrandsList();
    } else {
      this.visible.set(false);
      this.brandForm.reset();
    }
  }

  goBackToBrandsList() {
    this.router.navigate([ROUTES.ADMIN.BRANDS]);
  }

  onSubmit() {
    if (this.brandForm.invalid) {
      this.brandForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);

    const formValues = this.brandForm.value;

    const brandData = this.adminFormService.buildFormDataWithTranslations(
      formValues,
      ['name', 'description'],
      { logo_url: formValues.logo_url || null, is_active: formValues.is_active }
    );

    const isUpdate = this.isEditMode() && this.editBrandId;
    const operation$ = isUpdate
      ? this.brandService.updateBrand(this.editBrandId!, brandData)
      : this.brandService.createBrand(brandData);

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
      ? 'admin.brands.create_success'
      : 'admin.brands.update_success';

    if (this.visible()) {
      // Modal mode - close modal and reset
      this.toast.showSuccess(messageKey);
      this.visible.set(false);
      const resetValues = this.adminFormService.getTranslationFormResetValues(
        ['name', 'description'],
        { logo_url: '', is_active: true }
      );
      this.brandForm.reset(resetValues);
    } else {
      // Page mode - navigate back after delay
      this.adminFormService.handleSuccessWithRedirect(messageKey, ROUTES.ADMIN.BRANDS);
    }
  }

  private handleError(operation: 'create' | 'update', error: any) {
    this.adminFormService.handleError(operation, error, {
      createMessage: 'admin.brands.create_failed',
      updateMessage: 'admin.brands.update_failed'
    });
  }
}
