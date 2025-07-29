// src/app/pages/admin/admin-add-category/admin-add-category.component.ts
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { CheckboxModule } from 'primeng/checkbox';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ProductService } from '../../../services/product.service';
import { Category } from '../../../models/category.model';

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
  providers: [MessageService],
  templateUrl: './admin-add-category.component.html',
  styles: [`
    .field {
      margin-bottom: 1rem;
    }
    .section-title {
      font-size: 1.1rem;
      font-weight: 600;
      margin: 1.5rem 0 1rem 0;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--surface-border);
      color: var(--primary-color);
    }
    .language-section {
      background: var(--surface-50);
      padding: 1rem;
      border-radius: 6px;
      margin-bottom: 1rem;
      border-left: 4px solid var(--primary-color);
    }
    .language-flag {
      font-size: 1.2rem;
      margin-right: 0.5rem;
    }
  `]
})
export class AdminAddCategoryComponent implements OnInit {
  visible = signal(false);
  loading = signal(false);
  categoryForm: FormGroup;

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

  constructor(
    private fb: FormBuilder,
    private messageService: MessageService,
    private productService: ProductService,
    private route: ActivatedRoute,
    private router: Router,
    private translateService: TranslateService
  ) {
    // 🆕 UPDATED: Enhanced form WITHOUT primary name/description fields
    this.categoryForm = this.fb.group({
      // 🚫 REMOVED: Primary name and description
      // name: ['', [Validators.required, Validators.minLength(1)]],
      // description: [''],
      
      // 🆕 NEW: Only translation fields for all 3 languages (all required for names)
      name_en: ['', [Validators.required, Validators.minLength(1)]],
      name_fr: ['', [Validators.required, Validators.minLength(1)]],
      name_ar: ['', [Validators.required, Validators.minLength(1)]],
      
      description_en: [''],
      description_fr: [''],
      description_ar: [''],
      
      // Settings
      image_url: [''],
      is_active: [true]
    });
  }

  ngOnInit() {
    // NEW: Detect if we're in edit mode
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

  // ADD: Load category for editing method
  loadCategoryForEdit() {
    if (!this.editCategoryId) return;

    this.loading.set(true);
    
    this.productService.getCategory(this.editCategoryId).subscribe({
      next: (category) => {
        this.currentCategory = category as CategoryWithTranslations;
        
        // 🆕 UPDATED: Populate form with existing category data including translations
        this.categoryForm.patchValue({
          // 🚫 REMOVED: Primary name and description
          // name: category.name,
          // description: category.description || '',
          
          // 🆕 NEW: Load translation values or fallback to main name/description
          name_en: this.currentCategory.name_translations?.['en'] || category.name,
          name_fr: this.currentCategory.name_translations?.['fr'] || category.name,
          name_ar: this.currentCategory.name_translations?.['ar'] || category.name,
          
          description_en: this.currentCategory.description_translations?.['en'] || category.description || '',
          description_fr: this.currentCategory.description_translations?.['fr'] || category.description || '',
          description_ar: this.currentCategory.description_translations?.['ar'] || category.description || '',
          
          image_url: category.image_url || '',
          is_active: category.is_active
        });
        
        this.loading.set(false);
        console.log('Category loaded for editing:', category);
      },
      error: (error) => {
        console.error('Error loading category:', error);
        this.loading.set(false);
        
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: this.translateService.instant('categories.load_error')
        });
        
        // Redirect back if category not found
        this.goBackToCategoriesList();
      }
    });
  }

  // KEEP: Original modal method for backward compatibility
  show() {
    this.visible.set(true);
    this.categoryForm.reset({
      // 🆕 UPDATED: Reset translation fields instead of primary fields
      name_en: '',
      name_fr: '',
      name_ar: '',
      description_en: '',
      description_fr: '',
      description_ar: '',
      image_url: '',
      is_active: true
    });
  }

  // UPDATED: Cancel method that works for both modal and page
  onCancel() {
    if (this.isEditMode() && !this.visible()) {
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
    this.router.navigate(['/admin/categories']);
  }

  onSubmit() {
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    
    const formValues = this.categoryForm.value;
    
    // 🆕 NEW: Build the category data with translation JSON objects
    const categoryData = {
      name: formValues.name_en, // Use English as primary name
      description: formValues.description_en || '', // Use English as primary description
      
      // 🆕 NEW: Create translation JSON objects
      name_translations: {
        en: formValues.name_en,
        fr: formValues.name_fr,
        ar: formValues.name_ar
      },
      description_translations: {
        en: formValues.description_en || '',
        fr: formValues.description_fr || '',
        ar: formValues.description_ar || ''
      },
      
      // Other fields
      image_url: formValues.image_url || '',
      is_active: formValues.is_active
    };
    
    if (this.isEditMode() && this.editCategoryId) {
      // UPDATE existing category
      this.productService.updateCategory(this.editCategoryId, categoryData).subscribe({
        next: (updatedCategory) => {
          this.loading.set(false);
          
          this.messageService.add({
            severity: 'success',
            summary: this.translateService.instant('common.success'),
            detail: this.translateService.instant('admin.categories.update_success')
          });
          
          console.log('Category updated successfully:', updatedCategory);

          // Handle success based on mode
          if (this.visible()) {
            // Modal mode - close modal and reset
            this.visible.set(false);
            this.categoryForm.reset({
              name_en: '',
              name_fr: '',
              name_ar: '',
              description_en: '',
              description_fr: '',
              description_ar: '',
              image_url: '',
              is_active: true
            });
          } else {
            // Page mode - navigate back after delay
            setTimeout(() => {
              this.goBackToCategoriesList();
            }, 1500);
          }
        },
        error: (error) => {
          this.loading.set(false);
          this.handleError('update', error);
        }
      });
    } else {
      // CREATE new category
      this.productService.createCategory(categoryData).subscribe({
        next: (createdCategory) => {
          this.loading.set(false);
          
          this.messageService.add({
            severity: 'success',
            summary: this.translateService.instant('common.success'),
            detail: this.translateService.instant('admin.categories.create_success')
          });
          
          console.log('Category created successfully:', createdCategory);

          // Handle success based on mode
          if (this.visible()) {
            // Modal mode - close modal and reset
            this.visible.set(false);
            this.categoryForm.reset({
              name_en: '',
              name_fr: '',
              name_ar: '',
              description_en: '',
              description_fr: '',
              description_ar: '',
              image_url: '',
              is_active: true
            });
          } else {
            // Page mode - navigate back after delay
            setTimeout(() => {
              this.goBackToCategoriesList();
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

  // ADD: Error handling method
  private handleError(operation: 'create' | 'update', error: any) {
    console.error(`Error ${operation}ing category:`, error);
    
    let errorMessage = this.translateService.instant(
      operation === 'create' ? 'admin.categories.create_failed' : 'admin.categories.update_failed'
    );
    
    if (error.error && error.error.detail) {
      errorMessage = error.error.detail;
    }
    
    this.messageService.add({
      severity: 'error',
      summary: this.translateService.instant('common.error'),
      detail: errorMessage
    });
  }
}