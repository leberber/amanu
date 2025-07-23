// frontend/src/app/pages/admin/admin-add-product/admin-add-product.component.ts
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { ProductService } from '../../../services/product.service';

@Component({
  selector: 'app-admin-add-product',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    TextareaModule,
    SelectModule,
    CheckboxModule,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './admin-add-product.component.html',
  styles: [`
    .field {
      margin-bottom: 1rem;
    }
    
    .grid-cols-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }
    
    .gap-4 {
      gap: 1rem;
    }
  `]
})
export class AdminAddProductComponent implements OnInit {
  visible = signal(false);
  loading = signal(false);
  productForm: FormGroup;

  // Dropdown options
  unitOptions = [
    { label: 'Kg', value: 'kg' },
    { label: 'Gram', value: 'gram' },
    { label: 'Piece', value: 'piece' },
    { label: 'Bunch', value: 'bunch' },
    { label: 'Dozen', value: 'dozen' },
    { label: 'Pound', value: 'pound' }
  ];

  // We'll load these from the API later
  categoryOptions = [
    { label: 'Fresh Fruits', value: 1 },
    { label: 'Fresh Vegetables', value: 2 },
    { label: 'Organic Produce', value: 3 }
  ];

  constructor(
    private fb: FormBuilder,
    private messageService: MessageService,
    private productService: ProductService
  ) {
    this.productForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(1)]],
      description: [''],
      price: [null, [Validators.required, Validators.min(0.01)]],
      unit: ['', Validators.required],
      stock_quantity: [0, [Validators.required, Validators.min(0)]],
      category_id: [null, Validators.required],
      image_url: [''],
      is_organic: [false]
    });
  }

  ngOnInit() {
    // We'll add category loading here later
  }

  show() {
    this.visible.set(true);
    this.productForm.reset({
      name: '',
      description: '',
      price: null,
      unit: '',
      stock_quantity: 0,
      category_id: null,
      image_url: '',
      is_organic: false
    });
  }

  onCancel() {
    this.visible.set(false);
    this.productForm.reset();
  }

  onSubmit() {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    
    // Get form data
    const productData = this.productForm.value;
    
    // Call the backend API
    this.productService.createProduct(productData).subscribe({
      next: (createdProduct) => {
        this.loading.set(false);
        
        // Show success message
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: `Product "${createdProduct.name}" has been created successfully!`
        });
        
        // Close the dialog and reset form
        this.visible.set(false);
        this.productForm.reset({
          name: '',
          description: '',
          price: null,
          unit: '',
          stock_quantity: 0,
          category_id: null,
          image_url: '',
          is_organic: false
        });
        
        console.log('Product created successfully:', createdProduct);
      },
      error: (error) => {
        this.loading.set(false);
        
        console.error('Error creating product:', error);
        
        // Show error message
        let errorMessage = 'Failed to create product. Please try again.';
        
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