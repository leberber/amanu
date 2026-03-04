import { Component, OnInit, signal, inject, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ColorPickerModule } from 'primeng/colorpicker';
import { ToastModule } from 'primeng/toast';
import { TranslateModule } from '@ngx-translate/core';

import { ROUTES } from '../../../core/constants/routes.constants';
import { detectEditMode } from '../../../core/utils/edit-mode.util';
import { ANIMATION, UI_DELAY } from '../../../core/constants/ui.constants';
import { VALIDATION } from '../../../core/constants/validation.constants';
import { UserGroupService } from '../../../core/services/user-group.service';
import { UserGroup, UserGroupCreate, UserGroupUpdate } from '../../../models/user-group.model';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';

@Component({
  selector: 'app-admin-add-user-group',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    TextareaModule,
    ColorPickerModule,
    ToastModule,
    TranslateModule,
    PageLayoutComponent
  ],
  templateUrl: './admin-add-user-group.component.html',
  styleUrl: './admin-add-user-group.component.scss'
})
export class AdminAddUserGroupComponent implements OnInit {
  private readonly toast = inject(ToastMessageService);
  private readonly userGroupService = inject(UserGroupService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  groupForm!: FormGroup;

  readonly loading = signal(false);
  readonly formInitialized = signal(false);
  readonly isEditMode = signal(false);
  private readonly editGroupId = signal<number | null>(null);

  readonly pageTitle = computed(() =>
    this.isEditMode() ? 'admin.user_groups.edit_group' : 'admin.user_groups.add_group'
  );

  readonly pageSubtitle = computed(() =>
    this.isEditMode() ? 'admin.user_groups.form.edit_subtitle' : 'admin.user_groups.form.add_subtitle'
  );

  readonly mobileSubtitle = computed(() =>
    this.isEditMode() ? 'common.edit' : 'common.add'
  );

  readonly submitButtonLabel = computed(() =>
    this.isEditMode() ? 'admin.user_groups.form.submit_update' : 'admin.user_groups.form.submit_add'
  );

  readonly ROUTES = ROUTES;

  toggleActive(): void {
    const control = this.groupForm.get('is_active');
    control?.setValue(!control.value);
  }

  ngOnInit(): void {
    this.initForm();

    detectEditMode(
      this.route,
      this.destroyRef,
      this.isEditMode,
      this.editGroupId,
      () => this.loadGroupForEdit()
    );
    setTimeout(() => this.formInitialized.set(true), ANIMATION.NORMAL);
  }

  private initForm(): void {
    this.groupForm = this.fb.group({
      // Name translations
      name_en: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_NAME_LENGTH)]],
      name_fr: [''],
      name_ar: [''],
      // Description translations
      description_en: [''],
      description_fr: [''],
      description_ar: [''],
      // Other fields
      color: ['#3b82f6'],
      is_active: [true]
    });
  }

  private loadGroupForEdit(): void {
    const groupId = this.editGroupId();
    if (!groupId) return;

    this.loading.set(true);

    this.userGroupService.getGroup(groupId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (group) => {
          this.groupForm.patchValue({
            name_en: group.name || '',
            name_fr: group.name_translations?.['fr'] || '',
            name_ar: group.name_translations?.['ar'] || '',
            description_en: group.description || '',
            description_fr: group.description_translations?.['fr'] || '',
            description_ar: group.description_translations?.['ar'] || '',
            color: group.color || '#3b82f6',
            is_active: group.is_active
          });

          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.toast.showError('admin.user_groups.load_error');
          this.router.navigate([ROUTES.ADMIN.USER_GROUPS]);
        }
      });
  }

  onSubmit(): void {
    if (this.groupForm.invalid) {
      this.groupForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);

    const formValues = this.groupForm.value;

    // Build name translations
    const nameTranslations: Record<string, string> = {};
    if (formValues.name_fr?.trim()) {
      nameTranslations['fr'] = formValues.name_fr.trim();
    }
    if (formValues.name_ar?.trim()) {
      nameTranslations['ar'] = formValues.name_ar.trim();
    }

    // Build description translations
    const descriptionTranslations: Record<string, string> = {};
    if (formValues.description_fr?.trim()) {
      descriptionTranslations['fr'] = formValues.description_fr.trim();
    }
    if (formValues.description_ar?.trim()) {
      descriptionTranslations['ar'] = formValues.description_ar.trim();
    }

    const groupId = this.editGroupId();
    if (this.isEditMode() && groupId) {
      const updateData: UserGroupUpdate = {
        name: formValues.name_en.trim(),
        description: formValues.description_en?.trim() || undefined,
        name_translations: nameTranslations,
        description_translations: descriptionTranslations,
        color: formValues.color,
        is_active: formValues.is_active
      };

      this.userGroupService.updateGroup(groupId, updateData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.loading.set(false);
            this.toast.showSuccess('admin.user_groups.update_success');
            setTimeout(() => {
              this.router.navigate([ROUTES.ADMIN.USER_GROUPS]);
            }, UI_DELAY.TOAST_BEFORE_NAVIGATE);
          },
          error: () => {
            this.loading.set(false);
            this.toast.showError('admin.user_groups.update_error');
          }
        });
    } else {
      const createData: UserGroupCreate = {
        name: formValues.name_en.trim(),
        description: formValues.description_en?.trim() || undefined,
        name_translations: Object.keys(nameTranslations).length > 0 ? nameTranslations : undefined,
        description_translations: Object.keys(descriptionTranslations).length > 0 ? descriptionTranslations : undefined,
        color: formValues.color,
        is_active: formValues.is_active
      };

      this.userGroupService.createGroup(createData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.loading.set(false);
            this.toast.showSuccess('admin.user_groups.create_success');
            setTimeout(() => {
              this.router.navigate([ROUTES.ADMIN.USER_GROUPS]);
            }, UI_DELAY.TOAST_BEFORE_NAVIGATE);
          },
          error: () => {
            this.loading.set(false);
            this.toast.showError('admin.user_groups.create_error');
          }
        });
    }
  }
}
