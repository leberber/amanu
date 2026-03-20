import { Component, OnInit, inject, DestroyRef, signal, computed } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';

import { ADMIN_FORM_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { SupplierService } from '../../../core/services/supplier.service';
import { AdminFormService } from '../../../core/services/admin-form.service';
import { detectEditMode } from '../../../core/utils/edit-mode.util';
import { ROUTES } from '../../../core/constants/routes.constants';
import { Supplier, SupplierCreate, SupplierUpdate } from '../../../models/supplier.model';

@Component({
  selector: 'app-admin-add-supplier',
  standalone: true,
  imports: [
    ...ADMIN_FORM_IMPORTS,
    PageLayoutComponent
  ],
  templateUrl: './admin-add-supplier.component.html',
  styleUrl: './admin-add-supplier.component.scss'
})
export class AdminAddSupplierComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private supplierService = inject(SupplierService);
  private adminForm = inject(AdminFormService);
  private translate = inject(TranslateService);

  // State
  readonly isEditMode = signal(false);
  readonly editSupplierId = signal<number | null>(null);
  readonly loading = signal(false);
  readonly formInitialized = signal(false);

  // Form
  supplierForm!: FormGroup;

  // Computed
  pageTitle = computed(() =>
    this.isEditMode()
      ? this.translate.instant('admin.suppliers.form.edit_title')
      : this.translate.instant('admin.suppliers.form.add_title')
  );

  pageSubtitle = computed(() =>
    this.isEditMode()
      ? this.translate.instant('admin.suppliers.form.edit_subtitle')
      : this.translate.instant('admin.suppliers.form.add_subtitle')
  );

  submitButtonLabel = computed(() =>
    this.isEditMode()
      ? 'common.save_changes'
      : 'common.create'
  );

  // Route constant
  readonly ROUTES = ROUTES;

  ngOnInit(): void {
    this.initForm();
    this.detectMode();
  }

  private initForm(): void {
    this.supplierForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      contact_person: [''],
      phone: [''],
      email: ['', [Validators.email]],
      address: [''],
      city: [''],
      notes: [''],
      is_active: [true]
    });

    // Mark form as initialized for new suppliers
    if (!this.isEditMode()) {
      setTimeout(() => this.formInitialized.set(true), 100);
    }
  }

  private detectMode(): void {
    detectEditMode(
      this.route,
      this.destroyRef,
      this.isEditMode,
      this.editSupplierId,
      () => this.loadSupplierForEdit()
    );
  }

  private loadSupplierForEdit(): void {
    const id = this.editSupplierId();
    if (!id) return;

    this.loading.set(true);
    this.supplierService.getSupplier(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (supplier) => {
          this.populateForm(supplier);
          this.loading.set(false);
          this.formInitialized.set(true);
        },
        error: (error) => {
          this.adminForm.handleError('update', error, {
            genericMessage: 'admin.suppliers.load_error'
          });
          this.loading.set(false);
        }
      });
  }

  private populateForm(supplier: Supplier): void {
    this.supplierForm.patchValue({
      name: supplier.name,
      contact_person: supplier.contact_person || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      city: supplier.city || '',
      notes: supplier.notes || '',
      is_active: supplier.is_active
    });
  }

  onSubmit(): void {
    if (this.supplierForm.invalid) {
      this.supplierForm.markAllAsTouched();
      this.adminForm.showFormValidationErrors(this.supplierForm);
      return;
    }

    this.loading.set(true);
    const formData = this.supplierForm.value;

    if (this.isEditMode()) {
      this.updateSupplier(formData);
    } else {
      this.createSupplier(formData);
    }
  }

  private createSupplier(data: SupplierCreate): void {
    this.supplierService.createSupplier(data)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.adminForm.handleSuccessWithRedirect(
            this.translate.instant('admin.suppliers.create_success'),
            ROUTES.ADMIN.SUPPLIERS
          );
        },
        error: (error) => {
          this.adminForm.handleError('create', error, {
            createMessage: 'admin.suppliers.create_error'
          });
          this.loading.set(false);
        }
      });
  }

  private updateSupplier(data: SupplierUpdate): void {
    const id = this.editSupplierId();
    if (!id) return;

    this.supplierService.updateSupplier(id, data)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.adminForm.handleSuccessWithRedirect(
            this.translate.instant('admin.suppliers.update_success'),
            ROUTES.ADMIN.SUPPLIERS
          );
        },
        error: (error) => {
          this.adminForm.handleError('update', error, {
            updateMessage: 'admin.suppliers.update_error'
          });
          this.loading.set(false);
        }
      });
  }
}
