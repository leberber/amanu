import { Component, Input, Output, EventEmitter, OnInit, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { TranslateModule } from '@ngx-translate/core';

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
    SelectModule,
    InputNumberModule,
    ButtonModule,
    TranslateModule
  ],
  template: `
    <div class="quantity-selector" [ngClass]="{'compact': compact}">
      <!-- Dropdown mode (default) -->
      <ng-container *ngIf="mode === 'dropdown'">
        <p-select
          [(ngModel)]="quantity"
          [options]="quantityOptions"
          optionLabel="label"
          optionValue="value"
          [placeholder]="placeholder || ('Qty' | translate)"
          [styleClass]="'w-full ' + customClass"
          [disabled]="disabled"
          (onChange)="onQuantityChange()">
        </p-select>
      </ng-container>

      <!-- Input mode -->
      <ng-container *ngIf="mode === 'input'">
        <p-inputnumber
          [(ngModel)]="quantity"
          [min]="min"
          [max]="maxAllowed"
          [step]="step"
          [showButtons]="true"
          [disabled]="disabled"
          [inputStyleClass]="'text-center ' + customClass"
          [suffix]="' ' + unitLabel"
          (onInput)="onQuantityChange()">
        </p-inputnumber>
      </ng-container>

      <!-- Inline buttons mode -->
      <ng-container *ngIf="mode === 'inline'">
        <div class="flex align-items-center gap-2">
          <button
            pButton
            type="button"
            icon="pi pi-minus"
            class="p-button-rounded p-button-text p-button-sm"
            [disabled]="disabled || quantity <= min"
            (click)="decrementQuantity()">
          </button>
          <span class="quantity-display font-medium">
            {{ quantity }} {{ unitLabel }}
          </span>
          <button
            pButton
            type="button"
            icon="pi pi-plus"
            class="p-button-rounded p-button-text p-button-sm"
            [disabled]="disabled || quantity >= maxAllowed"
            (click)="incrementQuantity()">
          </button>
        </div>
      </ng-container>

      <!-- Grid overlay mode -->
      <ng-container *ngIf="mode === 'grid-overlay'">
        <button
          pButton
          type="button"
          [label]="quantity + ' ' + unitLabel"
          icon="pi pi-chevron-down"
          class="p-button-outlined w-full"
          [disabled]="disabled"
          (click)="toggleGridOverlay()">
        </button>
      </ng-container>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .quantity-selector {
      width: 100%;
    }

    .quantity-selector.compact {
      width: auto;
    }

    ::ng-deep {
      .p-select {
        min-width: 6rem;
      }

      .p-inputnumber {
        .p-inputnumber-input {
          width: 7rem;
        }
      }

      .p-inputnumber-button-group {
        .p-button {
          width: 2rem;
        }
      }
    }

    .quantity-display {
      min-width: 5rem;
      text-align: center;
    }
  `]
})
export class ProductQuantitySelectorComponent implements OnInit {
  @Input() mode: 'dropdown' | 'input' | 'inline' | 'grid-overlay' = 'dropdown';
  @Input() value: number = 5;
  @Input() min: number = 1;
  @Input() max: number = 100;
  @Input() step: number = 1;
  @Input() stockQuantity?: number;
  @Input() unit: string = 'kg';
  @Input() unitLabel: string = '';
  @Input() disabled: boolean = false;
  @Input() placeholder?: string;
  @Input() compact: boolean = false;
  @Input() customClass: string = '';
  @Input() predefinedOptions?: number[];
  
  @Output() valueChange = new EventEmitter<number>();
  @Output() quantityChanged = new EventEmitter<number>();
  @Output() gridToggled = new EventEmitter<boolean>();

  quantity: number = 5;
  quantityOptions: QuantityOption[] = [];
  showGridOverlay: boolean = false;
  gridQuantities: number[] = [];

  get maxAllowed(): number {
    if (this.stockQuantity !== undefined) {
      return Math.min(this.max, this.stockQuantity);
    }
    return this.max;
  }

  ngOnInit(): void {
    this.quantity = this.value;
    this.generateQuantityOptions();
    this.generateGridQuantities();
    
    // Update unit label if not provided
    if (!this.unitLabel) {
      this.unitLabel = this.getUnitDisplay(this.unit);
    }
  }

  generateQuantityOptions(): void {
    if (this.mode !== 'dropdown') return;

    const options: QuantityOption[] = [];
    
    if (this.predefinedOptions) {
      // Use predefined options if provided
      this.predefinedOptions.forEach(value => {
        if (value <= this.maxAllowed) {
          options.push({
            label: `${value} ${this.unitLabel || this.getUnitDisplay(this.unit)}`,
            value: value
          });
        }
      });
    } else {
      // Generate default options (5, 10, 15, etc.)
      const defaultStep = 5;
      const maxOption = Math.min(this.maxAllowed, 100);
      
      for (let i = defaultStep; i <= maxOption; i += defaultStep) {
        options.push({
          label: `${i} ${this.unitLabel || this.getUnitDisplay(this.unit)}`,
          value: i
        });
      }
      
      // Add max if it's not already included
      if (this.maxAllowed % defaultStep !== 0 && this.maxAllowed <= 100) {
        options.push({
          label: `${this.maxAllowed} ${this.unitLabel || this.getUnitDisplay(this.unit)}`,
          value: this.maxAllowed
        });
      }
    }
    
    this.quantityOptions = options;
  }

  onQuantityChange(): void {
    // Ensure quantity is within bounds
    if (this.quantity < this.min) {
      this.quantity = this.min;
    } else if (this.quantity > this.maxAllowed) {
      this.quantity = this.maxAllowed;
    }
    
    this.valueChange.emit(this.quantity);
    this.quantityChanged.emit(this.quantity);
  }

  incrementQuantity(): void {
    if (this.quantity < this.maxAllowed) {
      this.quantity = Math.min(this.quantity + this.step, this.maxAllowed);
      this.onQuantityChange();
    }
  }

  decrementQuantity(): void {
    if (this.quantity > this.min) {
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

  generateGridQuantities(): void {
    if (this.mode !== 'grid-overlay') return;
    
    this.gridQuantities = [];
    const max = this.maxAllowed;
    
    // Generate all quantities from min to max
    for (let i = this.min; i <= max; i += this.step) {
      this.gridQuantities.push(i);
    }
  }

  toggleGridOverlay(): void {
    this.showGridOverlay = !this.showGridOverlay;
    this.gridToggled.emit(this.showGridOverlay);
  }

  selectGridQuantity(qty: number): void {
    this.quantity = qty;
    this.showGridOverlay = false;
    this.gridToggled.emit(false);
    this.onQuantityChange();
  }
}