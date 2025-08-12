import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

// PrimeNG imports
import { AccordionModule } from 'primeng/accordion';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';

import { Category } from '../../models/product.model';

@Component({
  selector: 'app-product-filters',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    AccordionModule,
    CheckboxModule,
    ButtonModule,
    BadgeModule
  ],
  template: `
    <div class="h-full flex flex-column surface-card">
      <!-- Header -->
      <div class="p-3 border-bottom-1 surface-border">
        <h3 class="m-0 text-xl font-semibold text-900">{{ 'products.filters.title' | translate }}</h3>
      </div>
      
      <!-- Filters Content -->
      <div class="flex-grow-1 overflow-y-auto">
        <p-accordion [value]="['categories']" [multiple]="true" styleClass="filter-accordion">
          <!-- Categories Filter -->
          <p-accordion-panel value="categories">
            <p-accordion-header>
              <div class="flex align-items-center gap-2 w-full">
                <i class="pi pi-tags text-primary"></i>
                <span class="font-semibold text-900">{{ 'products.filters.categories' | translate }}</span>
                @if (selectedCount > 0 && selectedCount < categories.length) {
                  <p-badge 
                    [value]="selectedCount.toString()" 
                    severity="info" 
                    class="ml-auto mr-2" 
                  />
                }
              </div>
            </p-accordion-header>
            <p-accordion-content>
              <!-- Quick Actions -->
              <div class="flex gap-2 mb-3 p-2">
                <button 
                  pButton 
                  type="button" 
                  [label]="'Select All' | translate" 
                  icon="pi pi-check-square" 
                  class="p-button-sm p-button-text flex-1"
                  (click)="selectAll()"
                ></button>
                <button 
                  pButton 
                  type="button" 
                  [label]="'Clear' | translate" 
                  icon="pi pi-times" 
                  class="p-button-sm p-button-text p-button-secondary flex-1"
                  (click)="clearAll()"
                ></button>
              </div>
              
              <!-- Category List -->
              <div class="flex flex-column gap-1 p-2">
                @for (category of categories; track category.id) {
                  <div 
                    class="p-2 border-round-sm hover:surface-100 transition-all transition-duration-150"
                    [ngClass]="{'bg-primary-50 border-1 border-primary': isSelected(category)}"
                  >
                    <div class="flex align-items-center">
                      <p-checkbox 
                        [binary]="true"
                        [ngModel]="isSelected(category)"
                        [inputId]="'cat-' + category.id"
                        (ngModelChange)="toggleCategory(category)"
                        styleClass="mr-2"
                      ></p-checkbox>
                      <label [for]="'cat-' + category.id" class="cursor-pointer flex-grow-1 text-900">
                        {{ category.name }}
                      </label>
                    </div>
                  </div>
                }
              </div>
            </p-accordion-content>
          </p-accordion-panel>
          
          <!-- Add more filter sections here (price, organic, etc.) -->
        </p-accordion>
      </div>
      
      <!-- Filter Actions -->
      <div class="p-3 border-top-1 surface-border">
        <button 
          pButton 
          [label]="'Apply Filters' | translate" 
          icon="pi pi-filter" 
          class="w-full"
          [disabled]="selectedCount === 0"
          (click)="applyFilters()"
        ></button>
        @if (selectedCount < categories.length && selectedCount > 0) {
          <button 
            pButton 
            [label]="'Reset' | translate" 
            icon="pi pi-refresh" 
            class="w-full mt-2 p-button-outlined p-button-secondary"
            (click)="selectAll(); applyFilters()"
          ></button>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
  `]
})
export class ProductFiltersComponent {
  @Input() categories: Category[] = [];
  @Input() selectedCategories: Category[] = [];
  @Output() categoriesChange = new EventEmitter<Category[]>();
  @Output() filtersApplied = new EventEmitter<void>();

  get selectedCount(): number {
    return this.selectedCategories.length;
  }

  isSelected(category: Category): boolean {
    return this.selectedCategories.some(c => c.id === category.id);
  }

  toggleCategory(category: Category): void {
    let newSelection: Category[];
    const index = this.selectedCategories.findIndex(c => c.id === category.id);
    if (index > -1) {
      newSelection = this.selectedCategories.filter(c => c.id !== category.id);
    } else {
      newSelection = [...this.selectedCategories, category];
    }
    this.categoriesChange.emit(newSelection);
  }

  selectAll(): void {
    this.categoriesChange.emit([...this.categories]);
  }

  clearAll(): void {
    this.categoriesChange.emit([]);
  }

  applyFilters(): void {
    this.filtersApplied.emit();
  }
}