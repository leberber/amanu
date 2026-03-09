import { Component, inject, output, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { RegisterStateService } from '../../register-state.service';
import { MapPickerComponent, LocationData } from '../../../../shared/components/map-picker/map-picker.component';

@Component({
  selector: 'app-location-map-step',
  standalone: true,
  imports: [CommonModule, TranslateModule, MapPickerComponent],
  template: `
    <div class="fullscreen-map-slide">
      <!-- Map Background -->
      <div class="map-fullscreen">
        <app-map-picker
          [fullscreen]="true"
          (locationSelected)="onLocationSelected($event)"
          (locationError)="locationError.emit($event)">
        </app-map-picker>
      </div>

      <!-- Overlay Header -->
      <div class="map-overlay-header">
        <div class="map-top-nav">
          <button class="map-back-btn" (click)="back.emit()">
            <i class="pi pi-arrow-left"></i>
          </button>
          <div class="map-step-dots">
            @for (step of stepDots(); track step) {
              <span class="dot"
                    [class.active]="currentStep() === step"
                    [class.completed]="currentStep() > step"
                    [class.accessible]="step <= currentStep()"></span>
            }
          </div>
          <div class="map-spacer"></div>
        </div>
      </div>

      <!-- Address Card at Bottom -->
      <div class="map-address-footer">
        <div class="map-address-card">
          <div class="map-address-icon">
            <i class="pi pi-map-marker"></i>
          </div>
          @if (state.locationData()?.address) {
            <span class="map-address-text">{{ state.locationData()?.address }}</span>
          } @else {
            <span class="map-address-text">{{ 'register.step3_title' | translate }}</span>
          }
        </div>
        @if (state.locationSelected()) {
          <button class="register-btn" (click)="confirm.emit()">
            <span>{{ 'register.confirm_location' | translate }}</span>
          </button>
        }
      </div>
    </div>
  `,
  styleUrls: ['../_shared-styles.scss']
})
export class LocationMapStepComponent {
  state = inject(RegisterStateService);

  currentStep = input<number>(3);
  stepDots = input<number[]>([0, 1, 2, 3, 4, 5]);

  back = output<void>();
  confirm = output<void>();
  locationError = output<string>();

  onLocationSelected(location: LocationData): void {
    this.state.locationData.set(location);
    this.state.locationSelected.set(true);
  }
}
