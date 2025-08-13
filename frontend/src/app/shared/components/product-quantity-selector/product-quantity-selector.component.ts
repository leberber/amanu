import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { SliderModule } from 'primeng/slider';
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
    SliderModule,
    TranslateModule
  ],
  template: `
    <div class="quantity-selector-container">
      <!-- List type selector -->
      <div *ngIf="quantityConfig?.type === 'list' && quantityConfig.quantities" class="list-selector">
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
            styleClass="w-full">
          </p-select>
        </div>
      </div>

      <!-- Range type selector -->
      <div *ngIf="quantityConfig?.type === 'range'" class="range-selector">
        <div class="range-controls">
          <p-slider
            [(ngModel)]="quantity"
            [min]="min"
            [max]="max"
            [step]="step"
            [disabled]="disabled"
            (onChange)="onQuantityChange()"
            styleClass="flex-1">
          </p-slider>
          <p-inputnumber
            [(ngModel)]="quantity"
            [min]="min"
            [max]="max"
            [step]="step"
            [disabled]="disabled"
            (onInput)="onQuantityChange()"
            [suffix]="unit ? ' ' + unit : ''"
            styleClass="w-6rem ml-3">
          </p-inputnumber>
        </div>
      </div>

      <!-- Simple selector (fallback) -->
      <div *ngIf="!quantityConfig || (!quantityConfig.type)" class="simple-selector">
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

      <!-- Add to cart button (full width at bottom) -->
      <button
        pButton
        type="button"
        [label]="getAddToCartLabel()"
        icon="pi pi-shopping-cart"
        class="p-button-primary add-to-cart-btn"
        [disabled]="disabled || quantity === 0 || (maxStock && quantity > maxStock)"
        (click)="addToCart()">
      </button>

      <!-- Stock indicator -->
      <small *ngIf="showStock && maxStock && maxStock <= 5" class="stock-warning">
        <i class="pi pi-exclamation-triangle"></i>
        {{ 'products.stock.items_left' | translate: {count: maxStock} }}
      </small>
    </div>
  `,
  styles: [`
    .quantity-selector-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      width: 100%;
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

    .range-controls {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    ::ng-deep .p-slider {
      flex: 1;
      height: 0.5rem;
      background: var(--surface-300);
      
      .p-slider-range {
        background: var(--primary-color);
      }
      
      .p-slider-handle {
        width: 1.25rem;
        height: 1.25rem;
        border: 3px solid var(--primary-color);
        background: white;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }
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

    /* Add to cart button */
    .add-to-cart-btn {
      width: 100%;
      padding: 0.75rem;
      font-weight: 600;
      border-radius: 8px;
      transition: all 0.2s;
      
      &:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
      
      &:active:not(:disabled) {
        transform: translateY(0);
      }
    }

    /* Stock warning */
    .stock-warning {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--orange-600);
      font-size: 0.875rem;
      margin-top: -0.5rem;
      
      i {
        font-size: 0.75rem;
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
  
  // Outputs
  @Output() valueChange = new EventEmitter<number>();
  @Output() quantityChanged = new EventEmitter<number>();
  @Output() quantityChange = new EventEmitter<number>();
  @Output() addToCartClick = new EventEmitter<number>();

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
      
      // Set reasonable step based on range
      if (this.max - this.min <= 10) {
        this.step = 0.1;
      } else if (this.max - this.min <= 50) {
        this.step = 0.5;
      } else {
        this.step = 1;
      }
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

  getAddToCartLabel(): string {
    if (this.quantity === 0) {
      return this.translate('products.product.add_to_cart');
    }
    
    let label = this.translate('products.add_quantity_to_cart', {
      quantity: this.quantity,
      unit: this.unit ? this.getUnitDisplay(this.unit) : ''
    });
    
    if (this.pricePerUnit) {
      label += ` - ${this.currency}${(this.pricePerUnit * this.quantity).toFixed(2)}`;
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

  addToCart() {
    if (this.quantity > 0 && !this.disabled) {
      this.addToCartClick.emit(this.quantity);
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