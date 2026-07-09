import { Component, inject, output, OnInit, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { SelectModule } from 'primeng/select';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RegisterStateService } from '../../register-state.service';

@Component({
  selector: 'app-store-details-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, SelectModule],
  template: `
    <div class="register-header" [class.hidden]="state.isInputFocused()">
      <h1>{{ 'register.step4_store_title' | translate }}</h1>
      <p>{{ 'register.step4_store_subtitle' | translate }}</p>
    </div>

    <form [formGroup]="state.storeDetailsForm" class="register-form">
      <!-- Business Type (Optional) -->
      <div class="register-field">
        <label class="register-field__label">
          {{ 'register.business_type' | translate }}
          <span class="register-field__optional">({{ 'common.optional' | translate }})</span>
        </label>
        <div class="register-select"
             [class.register-select--focused]="state.focusedField() === 'segment_id'"
             [class.register-select--filled]="state.storeDetailsForm.get('segment_id')?.value">
          <p-select
            formControlName="segment_id"
            [options]="state.segments()"
            optionLabel="label"
            optionValue="value"
            [placeholder]="'register.select_business_type' | translate"
            [showClear]="true"
            (onFocus)="state.onInputFocus('segment_id')"
            (onBlur)="state.onInputBlur()">
          </p-select>
        </div>
      </div>

      <!-- Store Name (Optional) -->
      <div class="register-field">
        <label class="register-field__label">
          {{ 'register.store_name' | translate }}
          <span class="register-field__optional">({{ 'common.optional' | translate }})</span>
        </label>
        <div class="register-input"
             [class.register-input--focused]="state.focusedField() === 'store_name'"
             [class.register-input--filled]="state.storeDetailsForm.get('store_name')?.value">
          <input
            type="text"
            formControlName="store_name"
            [placeholder]="'register.store_name_placeholder' | translate"
            (focus)="state.onInputFocus('store_name')"
            (blur)="state.onInputBlur()">
        </div>
      </div>

      <!-- Wilaya -->
      <div class="register-field">
        <label class="register-field__label">{{ 'register.wilaya' | translate }}</label>
        <div class="register-select"
             [class.register-select--focused]="state.focusedField() === 'wilaya'"
             [class.register-select--filled]="state.storeDetailsForm.get('wilaya')?.value">
          <p-select
            formControlName="wilaya"
            [options]="state.wilayas()"
            optionLabel="label"
            optionValue="value"
            [placeholder]="'register.select_wilaya' | translate"
            [showClear]="false"
            (onFocus)="state.onInputFocus('wilaya')"
            (onBlur)="state.onInputBlur()">
          </p-select>
        </div>
      </div>

      <!-- Daira -->
      <div class="register-field">
        <label class="register-field__label">{{ 'register.daira' | translate }}</label>
        <div class="register-select"
             [class.register-select--focused]="state.focusedField() === 'daira'"
             [class.register-select--filled]="state.storeDetailsForm.get('daira')?.value">
          <p-select
            formControlName="daira"
            [options]="state.dairas()"
            optionLabel="label"
            optionValue="value"
            [placeholder]="'register.select_daira' | translate"
            [showClear]="false"
            (onFocus)="state.onInputFocus('daira')"
            (onBlur)="state.onInputBlur()">
          </p-select>
        </div>
      </div>

      <!-- Commune -->
      <div class="register-field">
        <label class="register-field__label">{{ 'register.commune' | translate }}</label>
        <div class="register-select"
             [class.register-select--focused]="state.focusedField() === 'commune'"
             [class.register-select--filled]="state.storeDetailsForm.get('commune')?.value">
          <p-select
            formControlName="commune"
            [options]="state.communes()"
            optionLabel="label"
            optionValue="value"
            [placeholder]="'register.select_commune' | translate"
            [showClear]="false"
            (onFocus)="state.onInputFocus('commune')"
            (onBlur)="state.onInputBlur()">
          </p-select>
        </div>
      </div>

      <!-- Continue Button -->
      <button
        type="button"
        class="register-btn"
        [disabled]="!state.isStoreDetailsValid()"
        (click)="onContinue()">
        <span>{{ 'common.continue' | translate }}</span>
      </button>
    </form>
  `,
  styleUrls: ['../_shared-styles.scss']
})
export class StoreDetailsStepComponent implements OnInit {
  state = inject(RegisterStateService);
  private destroyRef = inject(DestroyRef);

  continue = output<void>();

  ngOnInit(): void {
    this.setupFormSubscriptions();
  }

  private setupFormSubscriptions(): void {
    // Listen for wilaya changes
    this.state.storeDetailsForm.get('wilaya')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => {
        this.state.storeDetailsForm.get('daira')?.setValue('');
        this.state.storeDetailsForm.get('commune')?.setValue('');
        this.state.updateDairas(value);
      });

    // Listen for daira changes
    this.state.storeDetailsForm.get('daira')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => {
        this.state.storeDetailsForm.get('commune')?.setValue('');
        this.state.updateCommunes(value);
      });
  }

  onContinue(): void {
    if (this.state.isStoreDetailsValid()) {
      this.continue.emit();
    }
  }
}
