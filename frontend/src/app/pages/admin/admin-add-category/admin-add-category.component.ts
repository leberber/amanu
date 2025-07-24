// frontend/src/app/pages/admin/admin-add-category/admin-add-category.component.ts
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { CheckboxModule } from 'primeng/checkbox';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

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
    ToastModule
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

  constructor(
    private fb: FormBuilder,
    private messageService: MessageService,
    private productService: ProductService
  ) {
    this.categoryForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(1)]],
      description: [''],
      image_url: [''],
      is_active: [true]
    });
  }

  ngOnInit() {
    // Nothing to load for categories
  }

  show() {
    this.visible.set(true);
    this.categoryForm.reset({
      name: '',
      description: '',
      image_url: '',
      is_active: true
    });
  }

  onCancel() {
    this.visible.set(false);
    this.categoryForm.reset();
  }

  onSubmit() {
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    
    // Get form data
    const categoryData = this.categoryForm.value;
    
    // Call the backend API
    this.productService.createCategory(categoryData).subscribe({
      next: (createdCategory) => {
        this.loading.set(false);
        
        // Show success message
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: `Category "${createdCategory.name}" has been created successfully!`
        });
        
        // Close the dialog and reset form
        this.visible.set(false);
        this.categoryForm.reset({
          name: '',
          description: '',
          image_url: '',
          is_active: true
        });
        
        console.log('Category created successfully:', createdCategory);
      },
      error: (error) => {
        this.loading.set(false);
        
        console.error('Error creating category:', error);
        
        // Show error message
        let errorMessage = 'Failed to create category. Please try again.';
        
        if (error.error && error.error.detail) {
          errorMessage = error.error.detail;
        }
        
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: errorMessage
        });
      }
    });
  }
}