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
        <p-select
          [(ngModel)]="quantity"
          [options]="getDropdownOptions()"
          optionLabel="label"
          optionValue="value"
          [disabled]="disabled"
          [filter]="false"
          [showClear]="false"
          (onChange)="onQuantityChange()"
          styleClass="w-full">
        </p-select>
      </div>
      
      <!-- List type selector -->
      <div *ngIf="!dropdownOnly && quantityConfig?.type === 'list' && quantityConfig?.quantities" class="list-selector">
        <!-- Quick select pills (first 3 options) -->
        <div class="quick-select-pills">
          <button
            *ngFor="let value of getQuickOptions()"
            pButton
            type="button"
            [label]="formatQuantityLabel(value)"
            [class.p-button-outlined]="quantity !== value"
            [class.p-button-primary]="quantity === value"
            class="p-button-sm quick-pill"
            [disabled]="disabled || (maxStock && value > maxStock)"
            (click)="selectQuantity(value)">
          </button>
        </div>
        
        <!-- Dropdown for all options (if more than 3) -->
        <div *ngIf="hasMoreOptions()" class="full-dropdown">
          <p-select
            [(ngModel)]="quantity"
            [options]="getAllOptions()"
            optionLabel="label"
            optionValue="value"
            [disabled]="disabled"
            [filter]="true"
            filterBy="label"
            [placeholder]="'products.product.select_quantity' | translate"
            (onChange)="onQuantityChange()"
            appendTo="body"
            [panelStyle]="{'bottom': '100%', 'top': 'auto', 'margin-bottom': '0.5rem'}"
            styleClass="w-full">
          </p-select>
        </div>
      </div>

      <!-- Range type selector -->
      <div *ngIf="!dropdownOnly && quantityConfig?.type === 'range'" class="range-selector">
        <!-- Quick select pills for range -->
        <div class="quick-select-pills">
          <button
            *ngFor="let value of getRangeOptions()"
            pButton
            type="button"
            [label]="formatQuantityLabel(value)"
            [class.p-button-outlined]="quantity !== value"
            [class.p-button-primary]="quantity === value"
            class="p-button-sm quick-pill"
            [disabled]="disabled || (maxStock && value > maxStock)"
            (click)="selectQuantity(value)">
          </button>
        </div>
        
        <!-- Dropdown for more options -->
        <div class="full-dropdown">
          <p-select
            [(ngModel)]="quantity"
            [options]="getAllRangeOptions()"
            optionLabel="label"
            optionValue="value"
            [disabled]="disabled"
            [filter]="true"
            filterBy="label"
            [placeholder]="'products.product.select_quantity' | translate"
            (onChange)="onQuantityChange()"
            appendTo="body"
            [panelStyle]="{'bottom': '100%', 'top': 'auto', 'margin-bottom': '0.5rem'}"
            styleClass="w-full">
          </p-select>
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
    .quantity-selector-container {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      width: 100%;
    }
    
    /* Dropdown only mode */
    .dropdown-only {
      width: 100%;
      min-width: 120px;
      
      ::ng-deep .p-select {
        .p-select-label {
          font-weight: 600;
          color: var(--primary-color);
        }
      }
    }

    /* List selector styles */
    .list-selector {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .quick-select-pills {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
    }

    .quick-pill {
      padding: 0.5rem 0.25rem;
      font-size: 0.875rem;
      border-radius: 6px;
      transition: all 0.2s;
      
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
        font-size: 0.75rem;
        padding: 0.375rem 0.125rem;
      }
      
      .quantity-input {
        width: 3.5rem;
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
    const maxAllowed = this.getMaxAllowed();
    return this.quantity < maxAllowed;
  }

  get canDecrease(): boolean {
    return this.quantity > this.min;
  }

  ngOnInit() {
    this.quantity = this.value;
    this.initializeSelector();
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
    
    // Ensure quantity is within bounds
    this.validateQuantity();
  }

  getQuickOptions(): number[] {
    if (this.quantityConfig?.type === 'list' && this.quantityConfig.quantities) {
      // Return first 3 options
      return this.quantityConfig.quantities.slice(0, 3);
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
      return this.quantityConfig.quantities.map(value => ({
        label: this.formatQuantityLabel(value),
        value: value
      }));
    }
    return [];
  }
  
  getDropdownOptions(): QuantityOption[] {
    // For dropdown-only mode, generate options based on config or defaults
    if (this.quantityConfig?.type === 'list' && this.quantityConfig.quantities) {
      return this.getAllOptions();
    }
    
    if (this.quantityConfig?.type === 'range') {
      return this.getAllRangeOptions();
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
    
    // Ensure current value is included if it's higher than max
    if (this.quantity > max) {
      options.push({
        label: this.formatQuantityLabel(this.quantity),
        value: this.quantity
      });
    }
    
    return options;
  }
  
  getRangeOptions(): number[] {
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
      
      // Generate reasonable increments based on range
      let increment = 1;
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
    if (this.canIncrease) {
      this.quantity = Math.min(this.quantity + this.step, this.getMaxAllowed());
      this.onQuantityChange();
    }
  }

  decreaseQuantity() {
    if (this.canDecrease) {
      this.quantity = Math.max(this.quantity - this.step, this.min);
      this.onQuantityChange();
    }
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

  private translate(key: string, params?: any): string {
    // Simple fallback for translation
    // In real usage, this would use TranslateService
    return key;
  }
}