import { Component, OnInit, signal, computed, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';

import { ADMIN_FORM_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { MapPickerComponent, LocationData } from '../../../shared/components/map-picker/map-picker.component';
import { PhoneFormatDirective } from '../../../directives/phone-format.directive';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { AdminService } from '../../../services/admin.service';
import { SegmentService } from '../../../core/services/segment.service';
import { ROUTES } from '../../../core/constants/routes.constants';
import { ALGERIA_WILAYAS, matchAlgeriaWilaya } from '../../../core/constants/map.constants';
import { normalizeAlgerianPhone } from '../../../core/utils/format.util';

@Component({
  selector: 'app-admin-create-user',
  standalone: true,
  imports: [...ADMIN_FORM_IMPORTS, PageLayoutComponent, MapPickerComponent, PhoneFormatDirective],
  templateUrl: './admin-create-user.component.html',
  styleUrl: './admin-create-user.component.scss',
  animations: [
    trigger('stepAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(8px)' }),
        animate('180ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class AdminCreateUserComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly adminService = inject(AdminService);
  private readonly segmentService = inject(SegmentService);
  private readonly toast = inject(ToastMessageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly ROUTES = ROUTES;

  step = signal(1);
  firstName = signal('');
  lastName = signal('');
  storeName = signal('');
  segmentId = signal<number | null>(null);
  role = signal('customer');
  phone = signal('');
  phoneTouched = signal(false);
  email = signal('');
  password = signal('Agro2202');
  creating = signal(false);

  // Location (step 2)
  latitude = signal<number | null>(null);
  longitude = signal<number | null>(null);
  address = signal('');
  wilaya = signal('');
  daira = signal('');
  commune = signal('');

  segmentOptions = signal<{ label: string; value: number }[]>([]);

  isPhoneValid = computed(() => {
    const p = this.phone().trim();
    if (!p) return true; // optional field
    return /^0[567]\d{8}$/.test(normalizeAlgerianPhone(p));
  });

  readonly wilayaOptions = ALGERIA_WILAYAS;

  readonly roleOptions = [
    { label: 'Client', value: 'customer' },
    { label: 'Chauffeur', value: 'driver' }
  ];

  ngOnInit(): void {
    this.segmentService.getSegments()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (segs) => {
          this.segmentOptions.set(segs.map(s => ({ label: s.label_fr, value: s.id })));
        }
      });
  }

  onFirstName(value: string): void {
    this.firstName.set(value);
    this.updateEmail();
  }

  onLastName(value: string): void {
    this.lastName.set(value);
    this.updateEmail();
  }

  private updateEmail(): void {
    const first = this.firstName().trim().toLowerCase().replace(/\s+/g, '');
    const last = this.lastName().trim().toLowerCase().replace(/\s+/g, '');
    if (first || last) {
      this.email.set(`${last}.${first}@gmail.com`);
    }
  }

  isStep1Valid(): boolean {
    return !!this.firstName().trim() && !!this.lastName().trim() &&
           !!this.email().trim() && !!this.password().trim() &&
           this.isPhoneValid();
  }

  nextStep(): void {
    if (this.isStep1Valid()) {
      this.step.set(2);
    }
  }

  prevStep(): void {
    this.step.set(this.step() - 1);
  }

  onLocationSelected(location: LocationData): void {
    this.latitude.set(location.latitude);
    this.longitude.set(location.longitude);
    this.address.set(location.address || '');
    this.wilaya.set(matchAlgeriaWilaya(location.wilaya || ''));
    this.daira.set(location.daira || '');
    this.commune.set(location.commune || '');
  }

  goToLocationDetails(): void {
    this.step.set(3);
  }

  onLocationError(_errorType: string): void {
    this.toast.showWarn('register.location_error');
  }

  submit(): void {
    const firstName = this.firstName().trim();
    const lastName = this.lastName().trim();
    const email = this.email().trim();
    const password = this.password().trim();

    if (!firstName || !lastName || !email || !password) {
      this.toast.showError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    this.creating.set(true);
    this.adminService.createUser({
      full_name: `${firstName} ${lastName}`,
      store_name: this.storeName().trim() || null,
      role: this.role(),
      phone: this.phone().trim() ? normalizeAlgerianPhone(this.phone().trim()) : null,
      email,
      password,
      segment_id: this.segmentId() || null,
      address: this.address().trim() || null,
      latitude: this.latitude() || null,
      longitude: this.longitude() || null,
      wilaya: this.wilaya() || null,
      daira: this.daira() || null,
      commune: this.commune() || null,
    }).subscribe({
      next: () => {
        this.creating.set(false);
        this.toast.showSuccess('Compte créé avec succès');
        this.router.navigate([ROUTES.ADMIN.USERS]);
      },
      error: (err) => {
        this.creating.set(false);
        const detail = err?.error?.detail || '';
        this.toast.showError(
          detail.includes('already exists') ? 'Cet email est déjà utilisé' : 'Erreur lors de la création du compte'
        );
      }
    });
  }
}
