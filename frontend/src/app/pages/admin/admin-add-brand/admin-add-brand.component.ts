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
    this.brandForm = this.fb.group({
      name_en: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_NAME_LENGTH)]],
      name_fr: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_NAME_LENGTH)]],
      name_ar: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_NAME_LENGTH)]],
      description_en: [''],
      description_fr: [''],
      description_ar: [''],
      logo_url: [''],
      is_active: [true]
    });

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

        this.brandForm.patchValue({
          name_en: this.currentBrand.name_translations?.['en'] || brand.name,
          name_fr: this.currentBrand.name_translations?.['fr'] || brand.name,
          name_ar: this.currentBrand.name_translations?.['ar'] || brand.name,

          description_en: this.currentBrand.description_translations?.['en'] || brand.description || '',
          description_fr: this.currentBrand.description_translations?.['fr'] || brand.description || '',
          description_ar: this.currentBrand.description_translations?.['ar'] || brand.description || '',

          logo_url: brand.logo_url || '',
          is_active: brand.is_active
        });

        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading brand:', error);
        this.loading.set(false);
        this.toast.showError('admin.brands.load_error');
        this.goBackToBrandsList();
      }
    });
  }

  show() {
    this.visible.set(true);
    this.brandForm.reset({
      name_en: '',
      name_fr: '',
      name_ar: '',
      description_en: '',
      description_fr: '',
      description_ar: '',
      logo_url: '',
      is_active: true
    });
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
    this.router.navigate(['/admin/brands']);
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
      {
        logo_url: formValues.logo_url || null,
        is_active: formValues.is_active
      }
    );

    if (this.isEditMode() && this.editBrandId) {
      this.brandService.updateBrand(this.editBrandId, brandData).subscribe({
        next: (updatedBrand) => {
          this.loading.set(false);
          this.toast.showSuccess('admin.brands.update_success');

          if (this.visible()) {
            this.visible.set(false);
            this.brandForm.reset({
              name_en: '',
              name_fr: '',
              name_ar: '',
              description_en: '',
              description_fr: '',
              description_ar: '',
              logo_url: '',
              is_active: true
            });
          } else {
            setTimeout(() => {
              this.goBackToBrandsList();
            }, 1500);
          }
        },
        error: (error) => {
          this.loading.set(false);
          this.handleError('update', error);
        }
      });
    } else {
      this.brandService.createBrand(brandData).subscribe({
        next: (createdBrand) => {
          this.loading.set(false);
          this.toast.showSuccess('admin.brands.create_success');

          if (this.visible()) {
            this.visible.set(false);
            this.brandForm.reset({
              name_en: '',
              name_fr: '',
              name_ar: '',
              description_en: '',
              description_fr: '',
              description_ar: '',
              logo_url: '',
              is_active: true
            });
          } else {
            setTimeout(() => {
              this.goBackToBrandsList();
            }, 1500);
          }
        },
        error: (error) => {
          this.loading.set(false);
          this.handleError('create', error);
        }
      });
    }
  }

  private handleError(operation: 'create' | 'update', error: any) {
    console.error(`Error ${operation}ing brand:`, error);
    const fallbackKey = operation === 'create' ? 'admin.brands.create_failed' : 'admin.brands.update_failed';
    this.toast.showApiError(error, fallbackKey);
  }
}
