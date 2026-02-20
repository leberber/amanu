import { Component, OnInit, OnChanges, SimpleChanges, inject, ChangeDetectorRef, DestroyRef, input, output, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { QuantityConfig } from '../../../models/product.model';
import { UnitsService } from '../../../core/services/units.service';
import { onLanguageChange } from '../../../core/utils/language-change.util';

interface QuantityOption {
  label: string;
  value: number;
}

@Component({
  selector: 'app-product-quantity-selector',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    InputNumberModule,
    SelectModule,
    TranslateModule
  ],
  template: `
    <div class="quantity-selector-container">
      <!-- Dropdown only mode (for cart) -->
      @if (dropdownOnlyInput()) {
        <div class="dropdown-only">
          <div class="cart-quantity-selector">
            <button
              pButton
              type="button"
              icon="pi pi-minus"
              class="p-button-sm p-button-text p-button-rounded"
              [disabled]="!canDecrease || disabledInput()"
              (click)="decreaseQuantity()">
            </button>

            <span class="quantity-display">{{ formatQuantityLabel(quantity) }}</span>

            <button
              pButton
              type="button"
              icon="pi pi-plus"
              class="p-button-sm p-button-text p-button-rounded"
              [disabled]="!canIncrease || disabledInput()"
              (click)="increaseQuantity()">
            </button>
          </div>
        </div>
      }

      <!-- List type selector -->
      @if (!dropdownOnlyInput() && quantityConfigInput()?.type === 'list' && quantityConfigInput()?.quantities) {
        <div class="list-selector">
          <div class="pills-and-dropdown">
            <div class="pills-container">
              @for (value of getQuickOptions(); track value) {
                <button
                  pButton
                  type="button"
                  [label]="value.toString()"
                  [class.p-button-outlined]="quantity !== value"
                  [class.p-button-primary]="quantity === value"
                  class="p-button-sm quick-pill flex-1"
                  [disabled]="disabledInput() || (maxStock && value > maxStock)"
                  (click)="selectQuantity(value)">
                </button>
              }
            </div>

            <div class="dropdown-container">
              <p-select
                [(ngModel)]="quantity"
                [options]="getAllOptions()"
                optionLabel="label"
                optionValue="value"
                [disabled]="disabledInput()"
                [filter]="false"
                [placeholder]="selectQuantityPlaceholder"
                (onChange)="onQuantityChange()"
                appendTo="body"
                styleClass="compact-select w-full">
              </p-select>
            </div>
          </div>
        </div>
      }

      <!-- Range type selector -->
      @if (!dropdownOnlyInput() && quantityConfigInput()?.type === 'range') {
        <div class="range-selector">
          <div class="pills-and-dropdown">
            <div class="pills-container">
              @for (value of getRangeOptions(); track value) {
                <button
                  pButton
                  type="button"
                  [label]="value.toString()"
                  [class.p-button-outlined]="quantity !== value"
                  [class.p-button-primary]="quantity === value"
                  class="p-button-sm quick-pill flex-1"
                  [disabled]="disabledInput() || (maxStock && value > maxStock)"
                  (click)="selectQuantity(value)">
                </button>
              }
            </div>

            <div class="dropdown-container">
              <p-select
                [(ngModel)]="quantity"
                [options]="getAllRangeOptions()"
                optionLabel="label"
                optionValue="value"
                [disabled]="disabledInput()"
                [filter]="false"
                [placeholder]="selectQuantityPlaceholder"
                (onChange)="onQuantityChange()"
                appendTo="body"
                styleClass="compact-select w-full">
              </p-select>
            </div>
          </div>
        </div>
      }

      <!-- Simple selector (fallback) -->
      @if (!dropdownOnlyInput() && (!quantityConfigInput() || !quantityConfigInput()?.type)) {
        <div class="simple-selector">
          <div class="simple-controls">
            <button
              pButton
              type="button"
              icon="pi pi-minus"
              class="p-button-outlined p-button-sm"
              [disabled]="!canDecrease || disabledInput()"
              (click)="decreaseQuantity()">
            </button>

            <input
              type="number"
              [(ngModel)]="quantity"
              [min]="min"
              [max]="max"
              [step]="step"
              [disabled]="disabledInput()"
              (ngModelChange)="onQuantityChange()"
              class="quantity-input text-center">

            <button
              pButton
              type="button"
              icon="pi pi-plus"
              class="p-button-outlined p-button-sm"
              [disabled]="!canIncrease || disabledInput()"
              (click)="increaseQuantity()">
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    * {
      box-sizing: border-box;
    }
    
    .quantity-selector-container {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      width: 100%;
    }
    
    /* Dropdown only mode */
    .dropdown-only {
      width: 100%;
    }
    
    /* Cart quantity selector */
    .cart-quantity-selector {
      display: flex;
      align-items: center;
      gap: 0.5rem;

      .quantity-display {
        min-width: 60px;
        text-align: center;
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--text-color);
        white-space: nowrap;
      }

      button {
        width: 1.75rem !important;
        height: 1.75rem !important;
        padding: 0 !important;

        .p-button-icon {
          font-size: 0.75rem;
        }
      }
    }

    /* List selector styles */
    .list-selector {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .pills-and-dropdown {
      display: flex;
      gap: 0.5rem;
      width: 100%;
      align-items: stretch;
    }
    
    .pills-container {
      display: flex;
      gap: 0.5rem;
      width: 50%;
    }
    
    .dropdown-container {
      width: 50%;
      min-height: 2.25rem;
    }

    
    ::ng-deep .compact-select {
      width: 100% !important;
      max-width: 100% !important;
      height: 2.25rem;
      min-height: 2.25rem;
      overflow: hidden;
      
      &.p-select {
        width: 100% !important;
        max-width: 100% !important;
        height: 100%;
        min-height: 2.25rem;
        min-width: 0 !important;
        border: 1px solid #e9ecef !important;
        border-radius: 6px;
        background-color: var(--surface-0) !important;
      }
      
      .p-select-label {
        padding: 0 1.5rem 0 0.5rem !important;
        font-size: 1rem;
        font-weight: normal;
        text-align: center;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .p-select-trigger {
        width: 1.5rem;
        height: 100%;
        padding: 0;
      }
      
      .p-select-trigger-icon {
        font-size: 0.625rem;
      }
    }

    .quick-pill {
      padding: 0.25rem 0.5rem;
      font-size: 1rem;
      border-radius: 6px;
      transition: all 0.2s;
      height: 2.25rem;
      box-sizing: border-box;
      min-width: 0;
      border: 1px solid #e9ecef !important;
      
      &.p-button-outlined {
        border: 1px solid #e9ecef !important;
        background-color: var(--surface-0);
      }
      
      &.p-button-primary:not(.p-button-outlined) {
        border: 1px solid var(--primary-color) !important;
      }
      
      &:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }
      
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    /* Range selector styles */
    .range-selector {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    /* Simple selector styles */
    .simple-selector {
      display: flex;
      justify-content: center;
    }

    .simple-controls {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .quantity-input {
      width: 4rem;
      height: 2.25rem;
      border: 2px solid var(--surface-300);
      border-radius: 6px;
      font-size: 1rem;
      font-weight: 500;
      text-align: center;
      
      &:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.1);
      }
      
      &:disabled {
        background-color: var(--surface-100);
        cursor: not-allowed;
      }
    }

    /* Dropdown customization */
    ::ng-deep .p-select {
      .p-select-label {
        padding: 0.5rem 0.75rem;
      }
      
      .p-select-filter {
        padding: 0.5rem 0.75rem;
        margin-bottom: 0.5rem;
      }
    }

    /* Remove number input spinners */
    input[type=number]::-webkit-inner-spin-button,
    input[type=number]::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    input[type=number] {
      -moz-appearance: textfield;
    }

    /* Ensure borders are visible on PrimeNG components */
    ::ng-deep {
      .p-button.quick-pill {
        border: 1px solid #e9ecef !important;
        border-radius: 6px !important;
      }
      
      .p-select.compact-select {
        border: 1px solid #e9ecef !important;
        border-radius: 6px !important;
      }
      
      .p-select.compact-select .p-select-label {
        border: none !important;
      }
    }
    
    /* Mobile responsiveness */
    @media (max-width: 480px) {
      .quick-pill {
        font-size: 1rem;
        padding: 0.375rem 0.5rem;
        height: 2.25rem;
        font-weight: 600;
        border: 1px solid #e9ecef !important;
      }
      
      .quantity-input {
        width: 3.5rem;
      }
      
      .pills-and-dropdown {
        gap: 0.25rem;
      }
      
      ::ng-deep .compact-select {
        height: 2.25rem !important;
        min-height: 2.25rem !important;
        
        .p-select-label {
          padding: 0.375rem 0.5rem;
          font-size: 1rem;
          font-weight: normal;
        }
        
        .p-select-trigger {
          width: 1.5rem;
        }
      }
    }
  `]
})
export class ProductQuantitySelectorComponent implements OnInit, OnChanges {
  private unitsService = inject(UnitsService);
  private translateService = inject(TranslateService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  // Inputs (using signal inputs)
  valueInput = input(1, { alias: 'value' });
  minInput = input(1, { alias: 'min' });
  maxInput = input(100, { alias: 'max' });
  stepInput = input(1, { alias: 'step' });
  unitInput = input<string | undefined>(undefined, { alias: 'unit' });
  disabledInput = input(false, { alias: 'disabled' });
  showStockInput = input(false, { alias: 'showStock' });
  maxStockInput = input<number | undefined>(undefined, { alias: 'maxStock' });
  stockQuantityInput = input<number | undefined>(undefined, { alias: 'stockQuantity' });
  quantityConfigInput = input<QuantityConfig | undefined>(undefined, { alias: 'quantityConfig' });
  pricePerUnitInput = input<number | undefined>(undefined, { alias: 'pricePerUnit' });
  currencyInput = input('$', { alias: 'currency' });
  dropdownOnlyInput = input(false, { alias: 'dropdownOnly' });

  // Outputs
  valueChange = output<number>();
  quantityChanged = output<number>();
  quantityChange = output<number>();

  // Internal state (keeping as regular properties for ngModel binding)
  quantity: number = 1;
  quantityOptions: QuantityOption[] = [];
  selectQuantityPlaceholder: string = 'Select Quantity';

  // For backward compatibility - expose as getters
  get min(): number { return this.minInput(); }
  get max(): number { return this.maxInput(); }
  get step(): number { return this.stepInput(); }
  get unit(): string | undefined { return this.unitInput(); }
  get maxStock(): number | undefined { return this._maxStock; }
  set maxStock(value: number | undefined) { this._maxStock = value; }
  private _maxStock?: number;

  get quantityConfig(): QuantityConfig | undefined { return this.quantityConfigInput(); }

  get canIncrease(): boolean {
    const config = this.quantityConfigInput();
    const hasQuantitiesList = config?.quantities && config.quantities.length > 0;
    const isListType = config?.type === 'list' || hasQuantitiesList;

    if (isListType && config?.quantities) {
      const availableQuantities = this._maxStock !== undefined
        ? config.quantities.filter(qty => qty <= this._maxStock!)
        : config.quantities;

      const currentIndex = availableQuantities.indexOf(this.quantity);
      return currentIndex >= 0 && currentIndex < availableQuantities.length - 1;
    }

    const maxAllowed = this.getMaxAllowed();
    return this.quantity < maxAllowed;
  }

  get canDecrease(): boolean {
    const config = this.quantityConfigInput();
    const hasQuantitiesList = config?.quantities && config.quantities.length > 0;
    const isListType = config?.type === 'list' || hasQuantitiesList;

    if (isListType && config?.quantities) {
      const availableQuantities = this._maxStock !== undefined
        ? config.quantities.filter(qty => qty <= this._maxStock!)
        : config.quantities;

      const currentIndex = availableQuantities.indexOf(this.quantity);
      return currentIndex > 0;
    }

    return this.quantity > this.minInput();
  }

  ngOnInit() {
    this.quantity = this.valueInput() || 1;
    this._maxStock = this.maxStockInput();
    this.initializeSelector();

    if (this.quantity !== this.valueInput()) {
      this.onQuantityChange();
    }

    onLanguageChange(this.translateService, this.destroyRef, () => {
      this.quantityOptions = [];
      this.initializeSelector();
      this.updatePlaceholder();
      this.cdr.detectChanges();
    });

    this.updatePlaceholder();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['valueInput']) {
      this.quantity = this.valueInput();
    }
    if (changes['maxStockInput']) {
      this._maxStock = this.maxStockInput();
    }
    if (changes['quantityConfigInput'] || changes['maxStockInput'] || changes['stockQuantityInput']) {
      this.initializeSelector();
    }
  }

  private initializeSelector() {
    const stockQty = this.stockQuantityInput();
    if (stockQty !== undefined) {
      this._maxStock = stockQty;
    }

    const config = this.quantityConfigInput();

    if (config?.type === 'list' && config.quantities && config.quantities.length > 0) {
      const availableQuantities = this._maxStock !== undefined
        ? config.quantities.filter(qty => qty <= this._maxStock!)
        : config.quantities;

      if (availableQuantities.length === 0) {
        this.quantity = 0;
      } else if (!availableQuantities.includes(this.quantity)) {
        this.quantity = availableQuantities[0];
      }
    }

    this.validateQuantity();
  }

  getQuickOptions(): number[] {
    const config = this.quantityConfigInput();
    if (config?.pills && config.pills.length > 0) {
      const availablePills = this._maxStock !== undefined
        ? config.pills.filter(pill => pill <= this._maxStock!)
        : config.pills;
      return availablePills.slice(0, 3);
    }

    if (config?.type === 'list' && config.quantities) {
      const availableQuantities = this._maxStock !== undefined
        ? config.quantities.filter(qty => qty <= this._maxStock!)
        : config.quantities;
      return availableQuantities.slice(0, 3);
    }
    return [];
  }

  hasMoreOptions(): boolean {
    const config = this.quantityConfigInput();
    if (config?.type === 'list' && config.quantities) {
      return config.quantities.length > 3;
    }
    return false;
  }

  getAllOptions(): QuantityOption[] {
    const config = this.quantityConfigInput();
    if (config?.type === 'list' && config.quantities) {
      const availableQuantities = this._maxStock !== undefined
        ? config.quantities.filter(qty => qty <= this._maxStock!)
        : config.quantities;

      return availableQuantities.map(value => ({
        label: this.formatQuantityLabel(value),
        value: value
      }));
    }
    return [];
  }

  getDropdownOptions(): QuantityOption[] {
    const config = this.quantityConfigInput();
    if (config?.type === 'list' && config.quantities) {
      return this.getAllOptions();
    }

    if (config?.type === 'range') {
      return this.getAllRangeOptions();
    }

    const max = Math.min(this._maxStock || 10, 10);
    const options: QuantityOption[] = [];
    for (let i = 1; i <= max; i++) {
      options.push({
        label: this.formatQuantityLabel(i),
        value: i
      });
    }

    return options;
  }

  getRangeOptions(): number[] {
    const config = this.quantityConfigInput();
    if (config?.pills && config.pills.length > 0) {
      const availablePills = this._maxStock !== undefined
        ? config.pills.filter(pill => pill <= this._maxStock!)
        : config.pills;
      return availablePills.slice(0, 3);
    }

    if (config?.type === 'range') {
      const min = config.min || this.minInput();
      const max = Math.min(config.max || this.maxInput(), this._maxStock || this.maxInput());
      const step = (max - min) / 2;

      const options = [
        min,
        Math.round(min + step),
        max
      ];

      return [...new Set(options)].sort((a, b) => a - b);
    }
    return [];
  }

  getAllRangeOptions(): QuantityOption[] {
    const config = this.quantityConfigInput();
    if (config?.type === 'range') {
      const min = config.min || this.minInput();
      const max = Math.min(config.max || this.maxInput(), this._maxStock || this.maxInput());
      const options: number[] = [];

      let increment = config.step || 1;

      if (!config.step) {
        const range = max - min;

        if (range <= 10) {
          increment = 1;
        } else if (range <= 50) {
          increment = 5;
        } else if (range <= 100) {
          increment = 10;
        } else {
          increment = 25;
        }
      }

      for (let i = min; i <= max; i += increment) {
        options.push(i);
      }

      if (options[options.length - 1] !== max) {
        options.push(max);
      }

      return options.map(value => ({
        label: this.formatQuantityLabel(value),
        value: value
      }));
    }
    return [];
  }

  formatQuantityLabel(value: number): string {
    let label = value.toString();

    if (value % 1 !== 0) {
      label = value.toFixed(1);
    }

    const unit = this.unitInput();
    if (unit) {
      const unitDisplay = this.getUnitDisplay(unit);
      label = `${label} ${unitDisplay}`;
    }

    return label;
  }


  selectQuantity(value: number) {
    this.quantity = value;
    this.onQuantityChange();
  }

  private validateQuantity() {
    const config = this.quantityConfigInput();
    if (config?.type === 'list' && config.quantities) {
      const availableQuantities = this._maxStock !== undefined
        ? config.quantities.filter(qty => qty <= this._maxStock!)
        : config.quantities;

      if (availableQuantities.length === 0) {
        this.quantity = 0;
      } else if (!availableQuantities.includes(this.quantity)) {
        this.quantity = availableQuantities[0];
      }
      return;
    }

    const maxAllowed = this.getMaxAllowed();
    if (this.quantity < this.minInput()) {
      this.quantity = this.minInput();
    } else if (this.quantity > maxAllowed) {
      this.quantity = maxAllowed;
    }
  }

  private getMaxAllowed(): number {
    if (this._maxStock !== undefined) {
      return Math.min(this.maxInput(), this._maxStock);
    }
    return this.maxInput();
  }

  onQuantityChange() {
    this.validateQuantity();
    this.valueChange.emit(this.quantity);
    this.quantityChange.emit(this.quantity);
    this.quantityChanged.emit(this.quantity);
  }

  increaseQuantity() {
    if (!this.canIncrease) return;

    const config = this.quantityConfigInput();
    const hasQuantitiesList = config?.quantities && config.quantities.length > 0;
    const isListType = config?.type === 'list' || hasQuantitiesList;

    if (isListType && config?.quantities) {
      const availableQuantities = this._maxStock !== undefined
        ? config.quantities.filter(qty => qty <= this._maxStock!)
        : config.quantities;

      const currentIndex = availableQuantities.indexOf(this.quantity);
      if (currentIndex >= 0 && currentIndex < availableQuantities.length - 1) {
        this.quantity = availableQuantities[currentIndex + 1];
        this.onQuantityChange();
      }
      return;
    }

    const stepValue = config?.step || this.stepInput();
    this.quantity = Math.min(this.quantity + stepValue, this.getMaxAllowed());
    this.onQuantityChange();
  }

  decreaseQuantity() {
    if (!this.canDecrease) return;

    const config = this.quantityConfigInput();
    const hasQuantitiesList = config?.quantities && config.quantities.length > 0;
    const isListType = config?.type === 'list' || hasQuantitiesList;

    if (isListType && config?.quantities) {
      const availableQuantities = this._maxStock !== undefined
        ? config.quantities.filter(qty => qty <= this._maxStock!)
        : config.quantities;

      const currentIndex = availableQuantities.indexOf(this.quantity);
      if (currentIndex > 0) {
        this.quantity = availableQuantities[currentIndex - 1];
        this.onQuantityChange();
      }
      return;
    }

    const stepValue = config?.step || this.stepInput();
    this.quantity = Math.max(this.quantity - stepValue, this.minInput());
    this.onQuantityChange();
  }


  private getUnitDisplay(unit: string): string {
    return this.unitsService.getUnitTranslated(unit, true);
  }

  private updatePlaceholder(): void {
    this.selectQuantityPlaceholder = this.translateService.instant('products.product.quantity_selector.select_quantity');
    this.cdr.markForCheck();
  }

  }