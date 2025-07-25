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

import { ProductService } from '../../../services/product.service';

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
    CardModule
  ],
  providers: [MessageService],
  templateUrl: './admin-add-category.component.html',
  styles: [`
    .field {
      margin-bottom: 1rem;
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

  // NEW: Computed properties for page mode
  get pageTitle(): string {
    return this.isEditMode() ? 'Edit Category' : 'Add New Category';
  }

  get submitButtonLabel(): string {
    return this.isEditMode() ? 'Update Category' : 'Add Category';
  }

  constructor(
    private fb: FormBuilder,
    private messageService: MessageService,
    private productService: ProductService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.categoryForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(1)]],
      description: [''],
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
        this.loadCategoryForEdit(); // NOW CALLING THIS METHOD
      }
    });
  }

  // ADD: Load category for editing method
  loadCategoryForEdit() {
    if (!this.editCategoryId) return;

    this.loading.set(true);
    
    this.productService.getCategory(this.editCategoryId).subscribe({
      next: (category) => {
        // Populate form with existing category data
        this.categoryForm.patchValue({
          name: category.name,
          description: category.description || '',
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
          summary: 'Error',
          detail: 'Failed to load category. Please try again.'
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
      name: '',
      description: '',
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
    
    const categoryData = this.categoryForm.value;
    
    if (this.isEditMode() && this.editCategoryId) {
      // UPDATE existing category
      this.productService.updateCategory(this.editCategoryId, categoryData).subscribe({
        next: (updatedCategory) => {
          this.loading.set(false);
          
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: `Category "${updatedCategory.name}" has been updated successfully!`
          });
          
          console.log('Category updated successfully:', updatedCategory);

          // Handle success based on mode
          if (this.visible()) {
            // Modal mode - close modal and reset
            this.visible.set(false);
            this.categoryForm.reset({
              name: '',
              description: '',
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
            summary: 'Success',
            detail: `Category "${createdCategory.name}" has been created successfully!`
          });
          
          console.log('Category created successfully:', createdCategory);

          // Handle success based on mode
          if (this.visible()) {
            // Modal mode - close modal and reset
            this.visible.set(false);
            this.categoryForm.reset({
              name: '',
              description: '',
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
    
    let errorMessage = `Failed to ${operation} category. Please try again.`;
    
    if (error.error && error.error.detail) {
      errorMessage = error.error.detail;
    }
    
    this.messageService.add({
      severity: 'error',
      summary: 'Error',
      detail: errorMessage
    });
  }
}