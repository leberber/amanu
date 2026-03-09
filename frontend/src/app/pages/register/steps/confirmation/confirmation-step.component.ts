import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { RegisterStateService } from '../../register-state.service';
import { VehicleType } from '../../../../driver/services/driver.service';

@Component({
  selector: 'app-confirmation-step',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="slide-header">
      <div class="icon-wrapper success">
        <div class="icon-bg"></div>
        <div class="icon-circle">
          <i class="pi pi-check"></i>
        </div>
      </div>
      <h1>{{ 'register.step5_title' | translate }}</h1>
      <p>{{ 'register.step5_subtitle' | translate }}</p>
    </div>

    <div class="summary-cards">
      <!-- Personal Info -->
      @if (!state.fromGoogle()) {
        <div class="summary-card" (click)="goToStep.emit(0)">
          <div class="card-icon"><i class="pi pi-user"></i></div>
          <div class="card-info">
            <span class="card-label">{{ 'auth.full_name' | translate }}</span>
            <span class="card-value">{{ state.personalInfoForm.value.full_name }}</span>
          </div>
          <i class="pi pi-chevron-right card-arrow"></i>
        </div>

        <div class="summary-card" (click)="goToStep.emit(0)">
          <div class="card-icon"><i class="pi pi-envelope"></i></div>
          <div class="card-info">
            <span class="card-label">{{ 'common.email' | translate }}</span>
            <span class="card-value">{{ state.personalInfoForm.value.email }}</span>
          </div>
          <i class="pi pi-chevron-right card-arrow"></i>
        </div>

        <div class="summary-card" (click)="goToStep.emit(0)">
          <div class="card-icon"><i class="pi pi-phone"></i></div>
          <div class="card-info">
            <span class="card-label">{{ 'common.phone' | translate }}</span>
            <span class="card-value">{{ state.personalInfoForm.value.phone }}</span>
          </div>
          <i class="pi pi-chevron-right card-arrow"></i>
        </div>
      } @else {
        <!-- Google flow -->
        <div class="summary-card" (click)="goToStep.emit(0)">
          <div class="card-icon"><i class="pi pi-user"></i></div>
          <div class="card-info">
            <span class="card-label">{{ 'auth.full_name' | translate }}</span>
            <span class="card-value">{{ state.personalInfoForm.value.full_name }}</span>
          </div>
          <i class="pi pi-chevron-right card-arrow"></i>
        </div>

        <div class="summary-card">
          <div class="card-icon"><i class="pi pi-envelope"></i></div>
          <div class="card-info">
            <span class="card-label">{{ 'common.email' | translate }}</span>
            <span class="card-value">{{ state.personalInfoForm.value.email }}</span>
          </div>
        </div>

        <div class="summary-card" (click)="goToStep.emit(0)">
          <div class="card-icon"><i class="pi pi-phone"></i></div>
          <div class="card-info">
            <span class="card-label">{{ 'common.phone' | translate }}</span>
            <span class="card-value">{{ state.personalInfoForm.value.phone }}</span>
          </div>
          <i class="pi pi-chevron-right card-arrow"></i>
        </div>
      }

      @if (!state.isDriverMode()) {
        <!-- Customer: Location and Store -->
        <div class="summary-card location" (click)="goToStep.emit(3)">
          <div class="card-icon"><i class="pi pi-map-marker"></i></div>
          <div class="card-info">
            <span class="card-label">{{ 'register.delivery_location' | translate }}</span>
            <span class="card-value">{{ state.locationData()?.address || ('register.location_selected' | translate) }}</span>
          </div>
          <i class="pi pi-chevron-right card-arrow"></i>
        </div>

        <div class="summary-card" (click)="goToStep.emit(4)">
          <div class="card-icon"><i class="pi pi-building"></i></div>
          <div class="card-info">
            <span class="card-label">{{ 'register.store_details' | translate }}</span>
            <span class="card-value">{{ state.storeDetailsForm.value.commune }}, {{ state.storeDetailsForm.value.daira }}</span>
          </div>
          <i class="pi pi-chevron-right card-arrow"></i>
        </div>
      } @else {
        <!-- Driver: Vehicle Details -->
        <div class="summary-card" (click)="goToStep.emit(4)">
          <div class="card-icon"><i class="pi pi-truck"></i></div>
          <div class="card-info">
            <span class="card-label">Véhicule</span>
            <span class="card-value">
              {{ getVehicleTypeLabel(state.vehicleForm.value.vehicle_type) }}
              @if (state.vehicleForm.value.capacity_kg) {
                - {{ state.vehicleForm.value.capacity_kg }} kg
              }
            </span>
          </div>
          <i class="pi pi-chevron-right card-arrow"></i>
        </div>
      }
    </div>

    <div class="terms-text">
      <small>
        {{ 'auth.terms_agreement' | translate }}
        <a href="#">{{ 'auth.terms_of_service' | translate }}</a>
        {{ 'common.and' | translate }}
        <a href="#">{{ 'auth.privacy_policy' | translate }}</a>
      </small>
    </div>
  `,
  styleUrls: ['../_shared-styles.scss']
})
export class ConfirmationStepComponent {
  state = inject(RegisterStateService);

  goToStep = output<number>();

  readonly VehicleType = VehicleType;

  getVehicleTypeLabel(type: VehicleType): string {
    switch (type) {
      case VehicleType.TRUCK:
        return 'Camion';
      case VehicleType.VAN:
        return 'Fourgon';
      case VehicleType.MINI_VAN:
        return 'Mini Fourgon';
      default:
        return '';
    }
  }
}
