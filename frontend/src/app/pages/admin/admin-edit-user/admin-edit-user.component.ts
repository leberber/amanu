// src/app/pages/admin/admin-edit-user/admin-edit-user.component.ts
import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { PasswordModule } from 'primeng/password';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AdminService } from '../../../services/admin.service';
import { UserManage } from '../../../models/admin.model';
import { VALIDATION } from '../../../core/constants/app.constants';
import { ROUTES } from '../../../core/constants/routes.constants';
import { MapPickerComponent, LocationData } from '../../../shared/components/map-picker/map-picker.component';

@Component({
  selector: 'app-admin-edit-user',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    SelectButtonModule,
    ToastModule,
    CardModule,
    PasswordModule,
    TranslateModule,
    MapPickerComponent
  ],
  templateUrl: './admin-edit-user.component.html',
  styleUrl: './admin-edit-user.component.scss'
})
export class AdminEditUserComponent implements OnInit {
  loading = signal(false);
  userForm!: FormGroup;
  userId: number | null = null;
  currentUser: UserManage | null = null;

  // Map location
  initialLatitude: number | undefined;
  initialLongitude: number | undefined;

  // Role options
  roleOptions = signal<{ label: string; value: string }[]>([]);

  // Status options
  statusOptions = signal<{ label: string; value: boolean }[]>([]);

  // Wilaya options (Algeria regions)
  wilayaOptions = signal<{ label: string; value: string }[]>([]);

  private fb = inject(FormBuilder);
  private messageService = inject(MessageService);
  private adminService = inject(AdminService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translateService = inject(TranslateService);

  ngOnInit() {
    this.initForm();
    this.loadRoleOptions();
    this.loadStatusOptions();
    this.loadWilayaOptions();
    this.loadUser();

    // Update options on language change
    this.translateService.onLangChange.subscribe(() => {
      this.loadRoleOptions();
      this.loadStatusOptions();
    });
  }

  private initForm() {
    this.userForm = this.fb.group({
      full_name: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_NAME_LENGTH)]],
      email: [{ value: '', disabled: true }],
      phone: [''],
      address: [''],
      store_name: [''],
      wilaya: [''],
      daira: [''],
      commune: [''],
      latitude: [null],
      longitude: [null],
      role: ['customer', Validators.required],
      is_active: [true],
      password: ['', [Validators.minLength(VALIDATION.MIN_PASSWORD_LENGTH)]]
    });
  }

  private loadRoleOptions() {
    this.roleOptions.set([
      { label: this.translateService.instant('admin.users.roles.customer'), value: 'customer' },
      { label: this.translateService.instant('admin.users.roles.staff'), value: 'staff' },
      { label: this.translateService.instant('admin.users.roles.admin'), value: 'admin' }
    ]);
  }

  private loadStatusOptions() {
    this.statusOptions.set([
      { label: this.translateService.instant('admin.users.status.active'), value: true },
      { label: this.translateService.instant('admin.users.status.inactive'), value: false }
    ]);
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
          wilaya: user.wilaya || '',
          daira: user.daira || '',
          commune: user.commune || '',
          latitude: user.latitude || null,
          longitude: user.longitude || null,
          role: user.role,
          is_active: user.is_active
        });
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading user:', error);
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: this.translateService.instant('admin.users.load_error')
        });
        this.router.navigate([ROUTES.ADMIN.USERS]);
      }
    });
  }

  onCancel() {
    this.router.navigate([ROUTES.ADMIN.USERS]);
  }

  onSubmit() {
    if (this.userForm.invalid || !this.userId) {
      this.userForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const formValues = this.userForm.getRawValue();

    // Build update data
    const updateData: Partial<UserManage> & { password?: string } = {
      full_name: formValues.full_name,
      phone: formValues.phone || null,
      address: formValues.address || null,
      store_name: formValues.store_name || null,
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
        this.loading.set(false);
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('common.success'),
          detail: this.translateService.instant('admin.users.update_success')
        });

        setTimeout(() => {
          this.router.navigate([ROUTES.ADMIN.USERS]);
        }, 1500);
      },
      error: (error) => {
        this.loading.set(false);
        console.error('Error updating user:', error);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: this.translateService.instant('admin.users.update_error')
        });
      }
    });
  }

  onLocationSelected(location: LocationData): void {
    // Update form with location data
    this.userForm.patchValue({
      latitude: location.latitude,
      longitude: location.longitude,
      address: location.address || this.userForm.get('address')?.value,
      wilaya: location.wilaya || this.userForm.get('wilaya')?.value,
      daira: location.daira || this.userForm.get('daira')?.value,
      commune: location.commune || this.userForm.get('commune')?.value
    });

    // Update initial coordinates for map
    this.initialLatitude = location.latitude;
    this.initialLongitude = location.longitude;
  }

  onLocationError(errorType: string): void {
    let message = this.translateService.instant('register.location_error');

    switch (errorType) {
      case 'permission_denied':
        message = this.translateService.instant('register.location_permission_denied');
        break;
      case 'position_unavailable':
        message = this.translateService.instant('register.location_unavailable');
        break;
      case 'timeout':
        message = this.translateService.instant('register.location_timeout');
        break;
    }

    this.messageService.add({
      severity: 'warn',
      summary: this.translateService.instant('common.warning'),
      detail: message,
      life: 5000
    });
  }
}
