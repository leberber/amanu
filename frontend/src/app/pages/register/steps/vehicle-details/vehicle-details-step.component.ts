import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { RegisterStateService } from '../../register-state.service';

@Component({
  selector: 'app-vehicle-details-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, SelectModule, InputNumberModule],
  template: `
    <div class="register-header" [class.hidden]="state.isInputFocused()">
      <h1>Informations véhicule</h1>
      <p>Renseignez les détails de votre véhicule</p>
    </div>

    <form [formGroup]="state.vehicleForm" class="register-form">
      <!-- Vehicle Type -->
      <div class="register-field">
        <label class="register-field__label">Type de véhicule *</label>
        <div class="register-select"
             [class.register-select--focused]="state.focusedField() === 'vehicle_type'"
             [class.register-select--filled]="state.vehicleForm.get('vehicle_type')?.value">
          <p-select
            formControlName="vehicle_type"
            [options]="state.vehicleTypeOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Sélectionner le type"
            [showClear]="false"
            (onFocus)="state.onInputFocus('vehicle_type')"
            (onBlur)="state.onInputBlur()">
          </p-select>
        </div>
      </div>

      <!-- Capacity kg -->
      <div class="register-field">
        <label class="register-field__label">
          Capacité (kg)
          <span class="register-field__optional">(optionnel)</span>
        </label>
        <div class="register-input"
             [class.register-input--focused]="state.focusedField() === 'capacity_kg'"
             [class.register-input--filled]="state.vehicleForm.get('capacity_kg')?.value">
          <p-inputNumber
            formControlName="capacity_kg"
            [min]="0"
            [max]="50000"
            placeholder="Ex: 1000"
            suffix=" kg"
            styleClass="w-full"
            (onFocus)="state.onInputFocus('capacity_kg')"
            (onBlur)="state.onInputBlur()">
          </p-inputNumber>
        </div>
        <small class="register-hint">Capacité de charge maximale</small>
      </div>

      <!-- Capacity volume -->
      <div class="register-field">
        <label class="register-field__label">
          Volume (m³)
          <span class="register-field__optional">(optionnel)</span>
        </label>
        <div class="register-input"
             [class.register-input--focused]="state.focusedField() === 'capacity_volume'"
             [class.register-input--filled]="state.vehicleForm.get('capacity_volume')?.value">
          <p-inputNumber
            formControlName="capacity_volume"
            [min]="0"
            [max]="100"
            [maxFractionDigits]="1"
            placeholder="Ex: 10"
            suffix=" m³"
            styleClass="w-full"
            (onFocus)="state.onInputFocus('capacity_volume')"
            (onBlur)="state.onInputBlur()">
          </p-inputNumber>
        </div>
        <small class="register-hint">Volume de chargement</small>
      </div>

      <!-- Continue Button -->
      <button
        type="button"
        class="register-btn"
        [disabled]="!state.isVehicleFormValid()"
        (click)="onContinue()">
        <span>Continuer</span>
      </button>
    </form>
  `,
  styleUrls: ['../_shared-styles.scss']
})
export class VehicleDetailsStepComponent {
  state = inject(RegisterStateService);

  continue = output<void>();

  onContinue(): void {
    if (this.state.isVehicleFormValid()) {
      this.continue.emit();
    }
  }
}
