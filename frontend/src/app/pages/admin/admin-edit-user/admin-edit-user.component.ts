import { Component, OnInit, signal, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { ToastModule } from 'primeng/toast';
import { PasswordModule } from 'primeng/password';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { onLanguageChange } from '../../../core/utils/language-change.util';
import { AuthService } from '../../../services/auth.service';
import { AdminService } from '../../../services/admin.service';
import { UserManage } from '../../../models/admin.model';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { VALIDATION } from '../../../core/constants/validation.constants';
import { USER_ROLES } from '../../../core/constants/user.constants';
import { UI_DELAY, UI } from '../../../core/constants/ui.constants';
import { ROUTES } from '../../../core/constants/routes.constants';
import { StatusSeverityService } from '../../../core/services/status-severity.service';
import { UserGroupService } from '../../../core/services/user-group.service';
import { UserGroup } from '../../../models/user-group.model';
import { SegmentService } from '../../../core/services/segment.service';
import { MapPickerComponent, LocationData } from '../../../shared/components/map-picker/map-picker.component';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';

@Component({
  selector: 'app-admin-edit-user',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    MultiSelectModule,
    ToastModule,
    PasswordModule,
    TranslateModule,
    MapPickerComponent,
    PageLayoutComponent
  ],
  templateUrl: './admin-edit-user.component.html',
  styleUrl: './admin-edit-user.component.scss'
})
export class AdminEditUserComponent implements OnInit {
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly formInitialized = signal(false);
  readonly currentStep = signal(1);
  readonly totalSteps = 4;
  readonly ROUTES = ROUTES;
  readonly userName = signal('');

  userForm!: FormGroup;
  userId: number | null = null;
  currentUser: UserManage | null = null;

  // Map location
  initialLatitude: number | undefined;
  initialLongitude: number | undefined;

  // Role options
  roleOptions = signal<{ label: string; value: string }[]>([]);


  // Wilaya options (Algeria regions)
  wilayaOptions = signal<{ label: string; value: string }[]>([]);

  // Group options
  groupOptions = signal<{ label: string; value: number; color: string }[]>([]);
  selectedGroupIds = signal<number[]>([]);

  // Segment options
  segmentOptions = signal<{ label: string; value: number }[]>([]);

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private userGroupService = inject(UserGroupService);
  private segmentService = inject(SegmentService);
  private toast = inject(ToastMessageService);
  private adminService = inject(AdminService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translateService = inject(TranslateService);
  private statusService = inject(StatusSeverityService);
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    this.initForm();
    this.loadRoleOptions();
    this.loadWilayaOptions();
    this.loadGroups();
    this.loadSegments();
    this.loadUser();
    onLanguageChange(this.translateService, this.destroyRef, () => {
      this.loadRoleOptions();
    });
  }

  private initForm() {
    this.userForm = this.fb.group({
      full_name: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_NAME_LENGTH)]],
      email: [{ value: '', disabled: true }],
      phone: [''],
      address: [''],
      store_name: [''],
      segment_id: [null as number | null, Validators.required],
      fiscal_rc: [''],
      fiscal_na: [''],
      fiscal_nif: [''],
      fiscal_nis: [''],
      fiscal_montant_declare: [null as number | null],
      wilaya: [''],
      daira: [''],
      commune: [''],
      latitude: [null],
      longitude: [null],
      role: [{ value: USER_ROLES.CUSTOMER, disabled: this.authService.isStaff() }, Validators.required],
      is_active: [true],
      password: ['', [Validators.minLength(VALIDATION.MIN_PASSWORD_LENGTH)]]
    });
  }

  private loadRoleOptions() {
    const options = this.statusService.getRoleOptions();
    // Staff cannot assign the Admin role
    if (this.authService.isStaff()) {
      this.roleOptions.set(options.filter(o => o.value !== USER_ROLES.ADMIN));
    } else {
      this.roleOptions.set(options);
    }
  }


  private matchWilayaOption(value: string): string {
    if (!value) return '';
    const normalized = value.toLowerCase().replace(/-/g, ' ').trim();
    const match = this.wilayaOptions().find(opt =>
      opt.value.toLowerCase().replace(/-/g, ' ').trim() === normalized
    );
    return match ? match.value : value;
  }

  private loadWilayaOptions() {
    // Algeria's 58 wilayas
    const wilayas = [
      'Adrar', 'Chlef', 'Laghouat', 'Oum El Bouaghi', 'Batna', 'Béjaïa', 'Biskra', 'Béchar',
      'Blida', 'Bouira', 'Tamanrasset', 'Tébessa', 'Tlemcen', 'Tiaret', 'Tizi Ouzou', 'Alger',
      'Djelfa', 'Jijel', 'Sétif', 'Saïda', 'Skikda', 'Sidi Bel Abbès', 'Annaba', 'Guelma',
      'Constantine', 'Médéa', 'Mostaganem', 'M\'Sila', 'Mascara', 'Ouargla', 'Oran', 'El Bayadh',
      'Illizi', 'Bordj Bou Arréridj', 'Boumerdès', 'El Tarf', 'Tindouf', 'Tissemsilt', 'El Oued',
      'Khenchela', 'Souk Ahras', 'Tipaza', 'Mila', 'Aïn Defla', 'Naâma', 'Aïn Témouchent',
      'Ghardaïa', 'Relizane', 'Timimoun', 'Bordj Badji Mokhtar', 'Ouled Djellal', 'Béni Abbès',
      'In Salah', 'In Guezzam', 'Touggourt', 'Djanet', 'El M\'Ghair', 'El Meniaa'
    ];

    this.wilayaOptions.set(wilayas.map(w => ({ label: w, value: w })));
  }

  private loadSegments() {
    this.segmentService.getSegments()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (segs) => {
          this.segmentOptions.set(segs.map(s => ({ label: s.label_fr, value: s.id })));
        }
      });
  }

  private loadGroups() {
    this.userGroupService.getGroups(true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (groups: UserGroup[]) => {
          this.groupOptions.set(
            groups.map(g => ({
              label: g.name,
              value: g.id,
              color: g.color || '#3b82f6'
            }))
          );
        },
        error: () => {
          // Groups are optional, silently fail
        }
      });
  }

  private loadUser() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate([ROUTES.ADMIN.USERS]);
      return;
    }

    this.userId = parseInt(id, 10);
    this.loading.set(true);

    this.adminService.getUserById(this.userId).subscribe({
      next: (user: UserManage) => {
        this.currentUser = user;
        this.userName.set(user.full_name);

        // Set initial map coordinates if available
        if (user.latitude && user.longitude) {
          this.initialLatitude = user.latitude;
          this.initialLongitude = user.longitude;
        }

        this.userForm.patchValue({
          full_name: user.full_name,
          email: user.email,
          phone: user.phone || '',
          address: user.address || '',
          store_name: user.store_name || '',
          segment_id: user.segment_id ?? null,
          fiscal_rc: user.fiscal_info?.rc || '',
          fiscal_na: user.fiscal_info?.na || '',
          fiscal_nif: user.fiscal_info?.nif || '',
          fiscal_nis: user.fiscal_info?.nis || '',
          fiscal_montant_declare: user.fiscal_info?.montant_declare ?? null,
          wilaya: this.matchWilayaOption(user.wilaya || ''),
          daira: user.daira || '',
          commune: user.commune || '',
          latitude: user.latitude || null,
          longitude: user.longitude || null,
          role: user.role,
          is_active: user.is_active
        });

        // Set selected groups
        if (user.groups && user.groups.length > 0) {
          this.selectedGroupIds.set(user.groups.map(g => g.id));
        }

        this.loading.set(false);
        setTimeout(() => this.formInitialized.set(true), UI.TABLE_INIT_DELAY);
      },
      error: () => {
        this.loading.set(false);
        this.toast.showError('admin.users.load_error');
        this.router.navigate([ROUTES.ADMIN.USERS]);
      }
    });
  }

  onCancel() {
    this.router.navigate([ROUTES.ADMIN.USERS]);
  }

  // Step navigation
  nextStep(): void {
    if (this.currentStep() < this.totalSteps && this.isCurrentStepValid()) {
      this.currentStep.update(s => s + 1);
    }
  }

  prevStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update(s => s - 1);
    }
  }

  isCurrentStepValid(): boolean {
    switch (this.currentStep()) {
      case 1:
        return (this.userForm.get('full_name')?.valid ?? false) &&
               (this.userForm.get('segment_id')?.valid ?? false);
      case 2:
        return this.userForm.get('role')?.valid ?? false;
      case 3:
        return true;
      case 4:
        return true;
      default:
        return true;
    }
  }

  onSubmit() {
    if (this.userForm.invalid || !this.userId) {
      this.userForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const formValues = this.userForm.getRawValue();

    // Build update data
    const fiscalInfo = {
      rc: formValues.fiscal_rc || undefined,
      na: formValues.fiscal_na || undefined,
      nif: formValues.fiscal_nif || undefined,
      nis: formValues.fiscal_nis || undefined,
      montant_declare: formValues.fiscal_montant_declare ?? undefined,
    };
    const hasFiscal = Object.values(fiscalInfo).some(v => v !== undefined);

    const updateData: Partial<UserManage> & { password?: string } = {
      full_name: formValues.full_name,
      phone: formValues.phone || null,
      address: formValues.address || null,
      store_name: formValues.store_name || null,
      segment_id: formValues.segment_id ?? null,
      fiscal_info: hasFiscal ? fiscalInfo : undefined,
      wilaya: formValues.wilaya || null,
      daira: formValues.daira || null,
      commune: formValues.commune || null,
      latitude: formValues.latitude || null,
      longitude: formValues.longitude || null,
      role: formValues.role,
      is_active: formValues.is_active
    };

    // Only include password if provided
    if (formValues.password && formValues.password.trim()) {
      updateData.password = formValues.password;
    }

    this.adminService.updateUser(this.userId, updateData).subscribe({
      next: () => {
        // Update user groups
        this.userGroupService.updateUserGroups(this.userId!, this.selectedGroupIds()).subscribe({
          next: () => {
            this.submitting.set(false);
            this.toast.showSuccess('admin.users.update_success');
            setTimeout(() => {
              this.router.navigate([ROUTES.ADMIN.USERS]);
            }, UI_DELAY.TOAST_BEFORE_NAVIGATE);
          },
          error: () => {
            // User was updated but groups failed
            this.submitting.set(false);
            this.toast.showWarn('admin.users.groups_update_error');
            setTimeout(() => {
              this.router.navigate([ROUTES.ADMIN.USERS]);
            }, UI_DELAY.TOAST_BEFORE_NAVIGATE);
          }
        });
      },
      error: () => {
        this.submitting.set(false);
        this.toast.showError('admin.users.update_error');
      }
    });
  }

  onGroupsChange(groupIds: number[]): void {
    this.selectedGroupIds.set(groupIds);
  }

  onLocationSelected(location: LocationData): void {
    // Update form with location data
    this.userForm.patchValue({
      latitude: location.latitude,
      longitude: location.longitude,
      address: location.address || this.userForm.get('address')?.value,
      wilaya: this.matchWilayaOption(location.wilaya || '') || this.userForm.get('wilaya')?.value,
      daira: location.daira || this.userForm.get('daira')?.value,
      commune: location.commune || this.userForm.get('commune')?.value
    });

    // Update initial coordinates for map
    this.initialLatitude = location.latitude;
    this.initialLongitude = location.longitude;
  }

  onLocationError(errorType: string): void {
    let messageKey = 'register.location_error';

    switch (errorType) {
      case 'permission_denied':
        messageKey = 'register.location_permission_denied';
        break;
      case 'position_unavailable':
        messageKey = 'register.location_unavailable';
        break;
      case 'timeout':
        messageKey = 'register.location_timeout';
        break;
    }

    this.toast.showWarn(messageKey);
  }
}
