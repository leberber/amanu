import { Component, OnInit, AfterViewInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { ROUTES } from '../../core/constants/routes.constants';

// Interfaces for wilaya data
interface Commune {
  code: number;
  name: string;
}

interface Daira {
  daira_name: string;
  daira_code: number;
  communes: Commune[];
}

interface WilayaData {
  wilaya: string;
  wilaya_code: number;
  dairas: Daira[];
}

declare const L: any;

@Component({
  selector: 'app-complete-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ToastModule,
    TranslateModule
  ],
  templateUrl: './complete-profile.component.html',
  styleUrl: './complete-profile.component.scss'
})
export class CompleteProfileComponent implements OnInit, AfterViewInit {
  profileForm!: FormGroup;
  loading = signal(false);
  pageReady = signal(false);
  currentStep = signal(1);

  // Location data
  wilayaDataList: WilayaData[] = [];
  wilayas: { label: string; value: string }[] = [];
  dairas: { label: string; value: string }[] = [];
  communes: { label: string; value: string }[] = [];
  selectedLocation = signal<{ lat: number; lng: number } | null>(null);
  locationAddress = signal('');

  // Map
  private map: any;
  private marker: any;

  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private toast = inject(ToastMessageService);

  ngOnInit() {
    this.initializeForm();
    this.loadWilayaData();
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.pageReady.set(true);
    }, 500);
  }

  private initializeForm(): void {
    const user = this.authService.currentUserValue;

    this.profileForm = this.fb.group({
      phone: [user?.phone || '', [Validators.required, Validators.pattern(/^0[567]\d{8}$/)]],
      store_name: [user?.store_name || '', [Validators.required, Validators.minLength(2)]],
      wilaya: [user?.wilaya || '', Validators.required],
      daira: [user?.daira || ''],
      commune: [user?.commune || '', Validators.required],
      address: [user?.address || ''],
      latitude: [user?.latitude || null, Validators.required],
      longitude: [user?.longitude || null, Validators.required]
    });
  }

  private loadWilayaData(): void {
    this.http.get<WilayaData>('assets/tizi_ouzou_wilaya_full.json').subscribe({
      next: (data) => {
        this.wilayaDataList = [data];
        this.wilayas = this.wilayaDataList.map(w => ({
          label: w.wilaya,
          value: w.wilaya
        }));
      },
      error: () => this.toast.showError('errors.network_error')
    });
  }

  onWilayaChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const wilayaName = select.value;

    const wilayaData = this.wilayaDataList.find(w => w.wilaya === wilayaName);
    if (wilayaData) {
      this.dairas = wilayaData.dairas.map(d => ({
        label: d.daira_name,
        value: d.daira_name
      }));
      this.communes = [];
      this.profileForm.patchValue({ daira: '', commune: '' });
    } else {
      this.dairas = [];
      this.communes = [];
    }
  }

  onDairaChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const dairaName = select.value;
    const wilayaName = this.profileForm.get('wilaya')?.value;

    const wilayaData = this.wilayaDataList.find(w => w.wilaya === wilayaName);
    const dairaData = wilayaData?.dairas.find(d => d.daira_name === dairaName);

    if (dairaData) {
      this.communes = dairaData.communes.map(c => ({
        label: c.name,
        value: c.name
      }));
      this.profileForm.patchValue({ commune: '' });
    } else {
      this.communes = [];
    }
  }

  nextStep(): void {
    if (this.currentStep() === 1) {
      const step1Valid =
        this.profileForm.get('phone')?.valid &&
        this.profileForm.get('store_name')?.valid &&
        this.profileForm.get('wilaya')?.valid &&
        this.profileForm.get('commune')?.valid;

      if (step1Valid) {
        this.currentStep.set(2);
        setTimeout(() => this.initMap(), 100);
      } else {
        this.profileForm.get('phone')?.markAsTouched();
        this.profileForm.get('store_name')?.markAsTouched();
        this.profileForm.get('wilaya')?.markAsTouched();
        this.profileForm.get('commune')?.markAsTouched();
      }
    }
  }

  prevStep(): void {
    if (this.currentStep() === 2) {
      this.currentStep.set(1);
    }
  }

  private initMap(): void {
    if (this.map) return;

    const defaultLat = 36.7;
    const defaultLng = 4.0;

    this.map = L.map('profile-map').setView([defaultLat, defaultLng], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(this.map);

    this.map.on('click', (e: any) => {
      this.setLocation(e.latlng.lat, e.latlng.lng);
    });

    setTimeout(() => this.map.invalidateSize(), 100);
  }

  private setLocation(lat: number, lng: number): void {
    this.selectedLocation.set({ lat, lng });
    this.profileForm.patchValue({ latitude: lat, longitude: lng });

    if (this.marker) {
      this.marker.setLatLng([lat, lng]);
    } else {
      this.marker = L.marker([lat, lng]).addTo(this.map);
    }

    this.reverseGeocode(lat, lng);
  }

  private reverseGeocode(lat: number, lng: number): void {
    this.locationAddress.set('...');

    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
      .then(res => res.json())
      .then(data => {
        if (data.display_name) {
          this.locationAddress.set(data.display_name);
          this.profileForm.patchValue({ address: data.display_name });
        }
      })
      .catch(() => {
        this.locationAddress.set('');
      });
  }

  useMyLocation(): void {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          this.setLocation(lat, lng);
          this.map.setView([lat, lng], 15);
        },
        () => {
          this.toast.showError('register.location_error');
        }
      );
    }
  }

  onSubmit(): void {
    if (this.profileForm.invalid) {
      Object.keys(this.profileForm.controls).forEach(key => {
        this.profileForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.loading.set(true);

    this.userService.updateProfile(this.profileForm.value)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (updatedUser) => {
          this.authService.updateCurrentUser(updatedUser);
          this.toast.showSuccess('account.profile_updated');
          setTimeout(() => {
            this.router.navigate([ROUTES.HOME]);
          }, 1000);
        },
        error: (error) => {
          this.toast.showApiError(error, 'account.profile_update_failed');
        }
      });
  }

  get user() {
    return this.authService.currentUserValue;
  }
}
