import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { TranslateModule } from '@ngx-translate/core';
import { QuantityConfig } from '../../../models/product.model';

interface QuantityOption {
  label: string;
  value: number;
}

@Component({
  selector: 'app-product-quantity-selector',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputNumberModule,
    SelectModule,
    TranslateModule
  ],
  template: `
    <div class="quantity-selector-container">
      <!-- Dropdown only mode (for cart) -->
      <div *ngIf="dropdownOnly" class="dropdown-only">
        <div class="cart-quantity-selector">
          <button
            pButton
            type="button"
            icon="pi pi-minus"
            class="p-button-sm p-button-text p-button-rounded"
            [disabled]="!canDecrease || disabled"
            (click)="decreaseQuantity()">
          </button>
          
          <p-select
            [(ngModel)]="quantity"
            [options]="getDropdownOptions()"
            optionLabel="label"
            optionValue="value"
            [disabled]="disabled"
            [filter]="false"
            [showClear]="false"
            (onChange)="onQuantityChange()"
            appendTo="body"
            styleClass="compact-dropdown">
          </p-select>
          
          <button
            pButton
            type="button"
            icon="pi pi-plus"
            class="p-button-sm p-button-text p-button-rounded"
            [disabled]="!canIncrease || disabled"
            (click)="increaseQuantity()">
          </button>
        </div>
      </div>
      
      <!-- List type selector -->
      <div *ngIf="!dropdownOnly && quantityConfig?.type === 'list' && quantityConfig?.quantities" class="list-selector">
        <div class="pills-and-dropdown">
          <!-- Pills container - 50% width -->
          <div class="pills-container">
            <button
              *ngFor="let value of getQuickOptions()"
              pButton
              type="button"
              [label]="value.toString()"
              [class.p-button-outlined]="quantity !== value"
              [class.p-button-primary]="quantity === value"
              class="p-button-sm quick-pill flex-1"
              [disabled]="disabled || (maxStock && value > maxStock)"
              (click)="selectQuantity(value)">
            </button>
          </div>
          
          <!-- Dropdown container - 50% width -->
          <div class="dropdown-container">
            <p-select
              [(ngModel)]="quantity"
              [options]="getAllOptions()"
              optionLabel="label"
              optionValue="value"
              [disabled]="disabled"
              [filter]="false"
              [placeholder]="'Select quantity'"
              (onChange)="onQuantityChange()"
              appendTo="body"
              styleClass="compact-select w-full">
            </p-select>
          </div>
        </div>
      </div>

      <!-- Range type selector -->
      <div *ngIf="!dropdownOnly && quantityConfig?.type === 'range'" class="range-selector">
        <div class="pills-and-dropdown">
          <!-- Pills container - 50% width -->
          <div class="pills-container">
            <button
              *ngFor="let value of getRangeOptions()"
              pButton
              type="button"
              [label]="value.toString()"
              [class.p-button-outlined]="quantity !== value"
              [class.p-button-primary]="quantity === value"
              class="p-button-sm quick-pill flex-1"
              [disabled]="disabled || (maxStock && value > maxStock)"
              (click)="selectQuantity(value)">
            </button>
          </div>
          
          <!-- Dropdown container - 50% width -->
          <div class="dropdown-container">
            <p-select
              [(ngModel)]="quantity"
              [options]="getAllRangeOptions()"
              optionLabel="label"
              optionValue="value"
              [disabled]="disabled"
              [filter]="false"
              [placeholder]="'Select quantity'"
              (onChange)="onQuantityChange()"
              appendTo="body"
              styleClass="compact-select w-full">
            </p-select>
          </div>
        </div>
      </div>

      <!-- Simple selector (fallback) -->
      <div *ngIf="!dropdownOnly && (!quantityConfig || (!quantityConfig.type))" class="simple-selector">
        <div class="simple-controls">
          <button
            pButton
            type="button"
            icon="pi pi-minus"
            class="p-button-outlined p-button-sm"
            [disabled]="!canDecrease || disabled"
            (click)="decreaseQuantity()">
          </button>
          
          <input
            type="number"
            [(ngModel)]="quantity"
            [min]="min"
            [max]="max"
            [step]="step"
            [disabled]="disabled"
            (ngModelChange)="onQuantityChange()"
            class="quantity-input text-center">
          
          <button
            pButton
            type="button"
            icon="pi pi-plus"
            class="p-button-outlined p-button-sm"
            [disabled]="!canIncrease || disabled"
            (click)="increaseQuantity()">
          </button>
        </div>
      </div>
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
      gap: 0.25rem;
      
      ::ng-deep .compact-dropdown {
        flex: 1;
        min-width: 70px;
        max-width: 90px;
        
        .p-select {
          min-width: 100%;
        }
        
        .p-select-label {
          padding: 0.25rem 0.25rem 0.25rem 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--primary-color);
          text-align: center;
          white-space: nowrap;
          overflow: visible !important;
          text-overflow: clip !important;
        }
        
        .p-select-trigger {
          width: 2rem;
          padding: 0 0.25rem;
        }
        
        .p-select-trigger-icon {
          font-size: 0.75rem;
        }
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
        border: 1px solid #ced4da;
        border-radius: 6px;
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
      border: 1px solid #ced4da !important;
      
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

    /* Mobile responsiveness */
    @media (max-width: 480px) {
      .quick-pill {
        font-size: 1rem;
        padding: 0.375rem 0.5rem;
        height: 2.25rem;
        font-weight: 600;
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
  // Inputs
  @Input() value: number = 1;
  @Input() min: number = 1;
  @Input() max: number = 100;
  @Input() step: number = 1;
  @Input() unit?: string;
  @Input() disabled: boolean = false;
  @Input() showStock: boolean = false;
  @Input() maxStock?: number;
  @Input() stockQuantity?: number;
  @Input() quantityConfig?: QuantityConfig;
  @Input() pricePerUnit?: number;
  @Input() currency: string = '$';
  @Input() dropdownOnly: boolean = false;
  
  // Outputs
  @Output() valueChange = new EventEmitter<number>();
  @Output() quantityChanged = new EventEmitter<number>();
  @Output() quantityChange = new EventEmitter<number>();

  // Internal state
  quantity: number = 1;
  quantityOptions: QuantityOption[] = [];

  get canIncrease(): boolean {
    // For list type, check if there's a next value
    if (this.quantityConfig?.type === 'list' && this.quantityConfig.quantities) {
      // Filter based on stock first
      const availableQuantities = this.maxStock !== undefined
        ? this.quantityConfig.quantities.filter(qty => qty <= this.maxStock!)
        : this.quantityConfig.quantities;
      
      const currentIndex = availableQuantities.indexOf(this.quantity);
      return currentIndex >= 0 && currentIndex < availableQuantities.length - 1;
    }
    
    // For range or default
    const maxAllowed = this.getMaxAllowed();
    return this.quantity < maxAllowed;
  }

  get canDecrease(): boolean {
    // For list type, check if there's a previous value
    if (this.quantityConfig?.type === 'list' && this.quantityConfig.quantities) {
      // Filter based on stock first
      const availableQuantities = this.maxStock !== undefined
        ? this.quantityConfig.quantities.filter(qty => qty <= this.maxStock!)
        : this.quantityConfig.quantities;
      
      const currentIndex = availableQuantities.indexOf(this.quantity);
      return currentIndex > 0;
    }
    
    // For range or default
    return this.quantity > this.min;
  }

  ngOnInit() {
    this.quantity = this.value || 1;
    this.initializeSelector();
    // Emit the initial value in case it was adjusted
    if (this.quantity !== this.value) {
      this.onQuantityChange();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['value']) {
      this.quantity = this.value;
    }
    if (changes['quantityConfig'] || changes['maxStock'] || changes['stockQuantity']) {
      this.initializeSelector();
    }
  }

  private initializeSelector() {
    // Update maxStock if stockQuantity is provided
    if (this.stockQuantity !== undefined) {
      this.maxStock = this.stockQuantity;
    }

    // Set up range limits if using range config
    if (this.quantityConfig?.type === 'range') {
      if (this.quantityConfig.min !== undefined) this.min = this.quantityConfig.min;
      if (this.quantityConfig.max !== undefined) this.max = this.quantityConfig.max;
      this.step = 1; // Always use step of 1 for pills
    }
    
    // For list type, ensure quantity is one of the valid options
    if (this.quantityConfig?.type === 'list' && this.quantityConfig.quantities && this.quantityConfig.quantities.length > 0) {
      // Filter options based on stock
      const availableQuantities = this.maxStock !== undefined
        ? this.quantityConfig.quantities.filter(qty => qty <= this.maxStock!)
        : this.quantityConfig.quantities;
      
      // If no available quantities within stock, set to 0
      if (availableQuantities.length === 0) {
        this.quantity = 0;
      } else if (!availableQuantities.includes(this.quantity)) {
        // If current quantity is not in the available list, set it to the first available option
        this.quantity = availableQuantities[0];
      }
    }
    
    // Ensure quantity is within bounds
    this.validateQuantity();
  }

  getQuickOptions(): number[] {
    // First check if custom pills are defined
    if (this.quantityConfig?.pills && this.quantityConfig.pills.length > 0) {
      // Filter pills based on stock if needed
      const availablePills = this.maxStock !== undefined
        ? this.quantityConfig.pills.filter(pill => pill <= this.maxStock!)
        : this.quantityConfig.pills;
      return availablePills.slice(0, 3);
    }
    
    // Otherwise use default behavior
    if (this.quantityConfig?.type === 'list' && this.quantityConfig.quantities) {
      // Filter based on stock and return first 3 options
      const availableQuantities = this.maxStock !== undefined
        ? this.quantityConfig.quantities.filter(qty => qty <= this.maxStock!)
        : this.quantityConfig.quantities;
      return availableQuantities.slice(0, 3);
    }
    return [];
  }

  hasMoreOptions(): boolean {
    if (this.quantityConfig?.type === 'list' && this.quantityConfig.quantities) {
      return this.quantityConfig.quantities.length > 3;
    }
    return false;
  }

  getAllOptions(): QuantityOption[] {
    if (this.quantityConfig?.type === 'list' && this.quantityConfig.quantities) {
      // Filter options based on stock quantity
      const availableQuantities = this.maxStock !== undefined
        ? this.quantityConfig.quantities.filter(qty => qty <= this.maxStock!)
        : this.quantityConfig.quantities;
        
      return availableQuantities.map(value => ({
        label: this.formatQuantityLabel(value),
        value: value
      }));
    }
    return [];
  }
  
  getDropdownOptions(): QuantityOption[] {
    // For dropdown-only mode, generate options based on config or defaults
    if (this.quantityConfig?.type === 'list' && this.quantityConfig.quantities) {
      return this.getAllOptions(); // Already filtered by stock
    }
    
    if (this.quantityConfig?.type === 'range') {
      return this.getAllRangeOptions(); // Already respects maxStock
    }
    
    // Default: generate 1-10 or up to maxStock
    const max = Math.min(this.maxStock || 10, 10);
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
    // First check if custom pills are defined
    if (this.quantityConfig?.pills && this.quantityConfig.pills.length > 0) {
      // Filter pills based on stock if needed
      const availablePills = this.maxStock !== undefined
        ? this.quantityConfig.pills.filter(pill => pill <= this.maxStock!)
        : this.quantityConfig.pills;
      return availablePills.slice(0, 3);
    }
    
    if (this.quantityConfig?.type === 'range') {
      // Generate 3 evenly spaced options for quick selection
      const min = this.quantityConfig.min || this.min;
      const max = Math.min(this.quantityConfig.max || this.max, this.maxStock || this.max);
      const step = (max - min) / 2;
      
      const options = [
        min,
        Math.round(min + step),
        max
      ];
      
      // Remove duplicates and sort
      return [...new Set(options)].sort((a, b) => a - b);
    }
    return [];
  }
  
  getAllRangeOptions(): QuantityOption[] {
    if (this.quantityConfig?.type === 'range') {
      const min = this.quantityConfig.min || this.min;
      const max = Math.min(this.quantityConfig.max || this.max, this.maxStock || this.max);
      const options: number[] = [];
      
      // Use step from config if provided, otherwise calculate reasonable increments
      let increment = this.quantityConfig.step || 1;
      
      if (!this.quantityConfig.step) {
        // Only calculate increment if not provided in config
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
      
      // Always include max if not already included
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
    
    // Format decimals nicely
    if (value % 1 !== 0) {
      label = value.toFixed(1);
    }
    
    // Always add unit to dropdown options
    if (this.unit) {
      const unitDisplay = this.getUnitDisplay(this.unit);
      label = `${label} ${unitDisplay}`;
    }
    
    return label;
  }


  selectQuantity(value: number) {
    this.quantity = value;
    this.onQuantityChange();
  }

  private validateQuantity() {
    // For list type, ensure quantity is one of the valid options
    if (this.quantityConfig?.type === 'list' && this.quantityConfig.quantities) {
      // Filter options based on stock
      const availableQuantities = this.maxStock !== undefined
        ? this.quantityConfig.quantities.filter(qty => qty <= this.maxStock!)
        : this.quantityConfig.quantities;
      
      if (availableQuantities.length === 0) {
        this.quantity = 0;
      } else if (!availableQuantities.includes(this.quantity)) {
        // Set to first available option
        this.quantity = availableQuantities[0];
      }
      return;
    }
    
    // For range type or default
    const maxAllowed = this.getMaxAllowed();
    if (this.quantity < this.min) {
      this.quantity = this.min;
    } else if (this.quantity > maxAllowed) {
      this.quantity = maxAllowed;
    }
  }

  private getMaxAllowed(): number {
    if (this.maxStock !== undefined) {
      return Math.min(this.max, this.maxStock);
    }
    return this.max;
  }

  onQuantityChange() {
    this.validateQuantity();
    this.valueChange.emit(this.quantity);
    this.quantityChange.emit(this.quantity);
    this.quantityChanged.emit(this.quantity);
  }

  increaseQuantity() {
    if (!this.canIncrease) return;
    
    // For list type, move to next value in list
    if (this.quantityConfig?.type === 'list' && this.quantityConfig.quantities) {
      // Filter based on stock first
      const availableQuantities = this.maxStock !== undefined
        ? this.quantityConfig.quantities.filter(qty => qty <= this.maxStock!)
        : this.quantityConfig.quantities;
      
      const currentIndex = availableQuantities.indexOf(this.quantity);
      if (currentIndex >= 0 && currentIndex < availableQuantities.length - 1) {
        this.quantity = availableQuantities[currentIndex + 1];
        this.onQuantityChange();
      }
      return;
    }
    
    // For range or default
    this.quantity = Math.min(this.quantity + this.step, this.getMaxAllowed());
    this.onQuantityChange();
  }

  decreaseQuantity() {
    if (!this.canDecrease) return;
    
    // For list type, move to previous value in list
    if (this.quantityConfig?.type === 'list' && this.quantityConfig.quantities) {
      // Filter based on stock first
      const availableQuantities = this.maxStock !== undefined
        ? this.quantityConfig.quantities.filter(qty => qty <= this.maxStock!)
        : this.quantityConfig.quantities;
      
      const currentIndex = availableQuantities.indexOf(this.quantity);
      if (currentIndex > 0) {
        this.quantity = availableQuantities[currentIndex - 1];
        this.onQuantityChange();
      }
      return;
    }
    
    // For range or default
    this.quantity = Math.max(this.quantity - this.step, this.min);
    this.onQuantityChange();
  }


  private getUnitDisplay(unit: string): string {
    const unitMap: { [key: string]: string } = {
      'kg': 'kg',
      'gram': 'g',
      'piece': 'pcs',
      'bunch': 'bunch',
      'dozen': 'dozen',
      'pound': 'lb'
    };
    return unitMap[unit] || unit;
  }

}