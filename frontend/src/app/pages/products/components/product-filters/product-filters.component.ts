import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

// PrimeNG imports
import { AccordionModule } from 'primeng/accordion';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';

import { Category } from '../../../../models/product.model';

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
    <!-- Filters Container -->
    <div class="h-full flex flex-column">
      <ng-container *ngTemplateOutlet="filterHeader"></ng-container>
      <ng-container *ngTemplateOutlet="filterContent"></ng-container>
      <ng-container *ngTemplateOutlet="filterActions"></ng-container>
    </div>

    <!-- ===================== TEMPLATE DEFINITIONS ===================== -->

    <!-- Filter Header Template -->
    <ng-template #filterHeader>
      <div class="p-3 border-bottom-1 surface-border">
        <h3 class="m-0 text-xl font-semibold">{{ 'products.filters.title' | translate }}</h3>
      </div>
    </ng-template>

    <!-- Filter Content Template -->
    <ng-template #filterContent>
      <div class="flex-1 overflow-y-auto">
        <p-accordion [value]="['categories']" [multiple]="true">
          <p-accordion-panel value="categories">
            <p-accordion-header>
              <ng-container *ngTemplateOutlet="categoryHeader"></ng-container>
            </p-accordion-header>
            <p-accordion-content>
              <ng-container *ngTemplateOutlet="categoryQuickActions"></ng-container>
              <ng-container *ngTemplateOutlet="categoryList"></ng-container>
            </p-accordion-content>
          </p-accordion-panel>
        </p-accordion>
      </div>
    </ng-template>

    <!-- Filter Actions Template -->
    <ng-template #filterActions>
      <div class="p-3 border-top-1 surface-border">
        <button 
          pButton 
          [label]="'Apply Filters' | translate" 
          icon="pi pi-filter" 
          class="w-full"
          [disabled]="selectedCount === 0"
          (click)="applyFilters()">
        </button>
        <ng-container *ngIf="selectedCount < categories.length && selectedCount > 0">
          <button 
            pButton 
            [label]="'Reset' | translate" 
            icon="pi pi-refresh" 
            class="w-full mt-2 p-button-outlined p-button-secondary"
            (click)="resetFilters()">
          </button>
        </ng-container>
      </div>
    </ng-template>

    <!-- Category Header Template -->
    <ng-template #categoryHeader>
      <div class="flex align-items-center gap-2 w-full">
        <i class="pi pi-tags text-primary"></i>
        <span class="font-semibold">{{ 'products.filters.categories' | translate }}</span>
        <ng-container *ngIf="selectedCount > 0 && selectedCount < categories.length">
          <p-badge 
            [value]="selectedCount.toString()" 
            severity="info" 
            class="ml-auto mr-2">
          </p-badge>
        </ng-container>
      </div>
    </ng-template>

    <!-- Category Quick Actions Template -->
    <ng-template #categoryQuickActions>
      <div class="flex gap-2 mb-3 p-2">
        <button 
          pButton 
          type="button" 
          [label]="'Select All' | translate" 
          icon="pi pi-check-square" 
          class="p-button-sm p-button-text flex-1"
          (click)="selectAll()">
        </button>
        <button 
          pButton 
          type="button" 
          [label]="'Clear' | translate" 
          icon="pi pi-times" 
          class="p-button-sm p-button-text p-button-secondary flex-1"
          (click)="clearAll()">
        </button>
      </div>
    </ng-template>

    <!-- Category List Template -->
    <ng-template #categoryList>
      <div class="flex flex-column gap-1 p-2">
        <div *ngFor="let category of categories; trackBy: trackByCategoryId"
          [ngClass]="getCategoryClass(category)"
          (click)="toggleCategory(category)">
          <ng-container *ngTemplateOutlet="categoryItem; context: { category: category }"></ng-container>
        </div>
      </div>
    </ng-template>

    <!-- Category Item Template -->
    <ng-template #categoryItem let-category="category">
      <div class="flex align-items-center">
        <p-checkbox 
          [binary]="true"
          [ngModel]="isSelected(category)"
          [inputId]="'cat-' + category.id"
          (ngModelChange)="toggleCategory(category)"
          (click)="$event.stopPropagation()"
          styleClass="mr-2">
        </p-checkbox>
        <label [for]="'cat-' + category.id" class="cursor-pointer flex-1">
          {{ category.name }}
        </label>
      </div>
    </ng-template>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }

    .category-item {
      padding: 0.5rem;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .category-item:hover {
      background-color: var(--surface-hover);
    }

    .category-item.selected {
      background-color: var(--primary-50);
      border: 1px solid var(--primary-color);
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

  getCategoryClass(category: Category): string {
    const baseClass = 'category-item p-2 border-round-sm transition-all transition-duration-150';
    return this.isSelected(category) 
      ? `${baseClass} bg-primary-50 border-1 border-primary` 
      : `${baseClass} hover:surface-hover`;
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

  resetFilters(): void {
    this.selectAll();
    this.applyFilters();
  }

  trackByCategoryId(_index: number, category: Category): number {
    return category.id;
  }
}