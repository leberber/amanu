import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

// PrimeNG imports
import { AccordionModule } from 'primeng/accordion';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { DividerModule } from 'primeng/divider';
import { TooltipModule } from 'primeng/tooltip';

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
    BadgeModule,
    DividerModule,
    TooltipModule
  ],
  template: `
    <!-- Filters Container -->
    <div class="h-full flex flex-column bg-white">
      <ng-container *ngTemplateOutlet="filterHeader"></ng-container>
      <ng-container *ngTemplateOutlet="filterContent"></ng-container>
      <ng-container *ngTemplateOutlet="filterActions"></ng-container>
    </div>

    <!-- ===================== TEMPLATE DEFINITIONS ===================== -->

    <!-- Filter Header Template -->
    <ng-template #filterHeader>
      <div class="px-4 py-3">
        <div class="flex align-items-center justify-content-between">
          <h3 class="m-0 text-lg font-semibold text-900">{{ 'products.filters.title' | translate }}</h3>
          <ng-container *ngIf="selectedCount > 0 && selectedCount < categories.length">
            <button 
              pButton 
              type="button" 
              icon="pi pi-times" 
              class="p-button-text p-button-rounded p-button-sm text-500"
              (click)="clearAll()"
              pTooltip="Clear all filters"
              tooltipPosition="left">
            </button>
          </ng-container>
        </div>
      </div>
      <p-divider class="m-0"></p-divider>
    </ng-template>

    <!-- Filter Content Template -->
    <ng-template #filterContent>
      <div class="flex-1 overflow-y-auto">
        <p-accordion [value]="['categories']" [multiple]="true" styleClass="filter-accordion">
          <!-- Categories Filter Panel -->
          <p-accordion-panel value="categories">
            <p-accordion-header>
              <ng-container *ngTemplateOutlet="categoriesHeader"></ng-container>
            </p-accordion-header>
            <p-accordion-content>
              <ng-container *ngTemplateOutlet="categoriesContent"></ng-container>
            </p-accordion-content>
          </p-accordion-panel>

          <!-- Future filter panels can be added here -->
          <!-- Price Range Panel
          <p-accordion-panel value="price">
            <p-accordion-header>Price Range</p-accordion-header>
            <p-accordion-content>Price slider component</p-accordion-content>
          </p-accordion-panel> -->

          <!-- Organic Only Panel
          <p-accordion-panel value="organic">
            <p-accordion-header>Organic</p-accordion-header>
            <p-accordion-content>Organic checkbox</p-accordion-content>
          </p-accordion-panel> -->
        </p-accordion>
      </div>
    </ng-template>

    <!-- Filter Actions Template -->
    <ng-template #filterActions>
      <p-divider class="m-0"></p-divider>
      <div class="p-3">
        <button 
          pButton 
          [label]="getApplyButtonLabel()" 
          icon="pi pi-check" 
          class="w-full"
          [disabled]="activeFilterCount === 0"
          (click)="applyFilters()">
        </button>
      </div>
    </ng-template>

    <!-- Categories Header Template -->
    <ng-template #categoriesHeader>
      <div class="flex align-items-center gap-2 w-full">
        <i class="pi pi-tags text-500"></i>
        <span class="font-medium">{{ 'products.filters.categories' | translate }}</span>
        <ng-container *ngIf="selectedCount > 0 && selectedCount < categories.length">
          <p-badge 
            [value]="selectedCount + '/' + categories.length" 
            severity="info" 
            class="ml-auto mr-2">
          </p-badge>
        </ng-container>
      </div>
    </ng-template>

    <!-- Categories Content Template -->
    <ng-template #categoriesContent>
      <div class="px-3 py-2">
        <!-- Quick Actions -->
        <div class="flex gap-2 mb-3">
          <ng-container *ngIf="selectedCount !== categories.length">
            <button 
              pButton 
              type="button" 
              [label]="'Select All' | translate" 
              icon="pi pi-check-square"
              class="p-button-link p-button-sm text-xs flex-1"
              (click)="selectAll()">
            </button>
          </ng-container>
          <ng-container *ngIf="selectedCount > 0">
            <button 
              pButton 
              type="button" 
              [label]="'Clear Selection' | translate" 
              icon="pi pi-times"
              class="p-button-link p-button-sm text-xs text-orange-600 flex-1"
              (click)="clearAll()">
            </button>
          </ng-container>
        </div>
        
        <!-- Category List -->
        <ng-container *ngTemplateOutlet="categoryList"></ng-container>
      </div>
    </ng-template>

    <!-- Category List Template -->
    <ng-template #categoryList>
      <div class="flex flex-column gap-2">
        <label *ngFor="let category of categories; trackBy: trackByCategoryId"
          [for]="'cat-' + category.id"
          class="category-item">
          <ng-container *ngTemplateOutlet="categoryItem; context: { category: category }"></ng-container>
        </label>
      </div>
    </ng-template>

    <!-- Category Item Template -->
    <ng-template #categoryItem let-category="category">
      <div class="flex align-items-center gap-3 py-2 px-3 border-round cursor-pointer transition-all transition-duration-150">
        <p-checkbox 
          [binary]="true"
          [ngModel]="isSelected(category)"
          [inputId]="'cat-' + category.id"
          (ngModelChange)="toggleCategory(category)"
          styleClass="checkbox-sm">
        </p-checkbox>
        <div class="flex-1 flex align-items-center justify-content-between">
          <span class="text-sm">{{ category.name }}</span>
          <!-- Product count badge - shows how many products are in this category -->
          <p-badge 
            [value]="category.product_count?.toString() || '0'" 
            [severity]="isSelected(category) ? 'info' : 'secondary'"
            styleClass="badge-sm"
            pTooltip="Products in this category"
            tooltipPosition="left">
          </p-badge>
        </div>
      </div>
    </ng-template>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }

    ::ng-deep {
      .p-divider {
        margin: 0;
      }

      .filter-accordion {
        .p-accordion-panel {
          box-shadow: none;
          border: none;
          border-radius: 0;
          margin-bottom: 0;
          background: transparent;
          overflow: hidden;
        }

        .p-accordion-panel:last-child {
          margin-bottom: 0;
        }

        .p-accordion-header-link {
          background: transparent;
          border: none;
          border-radius: 0;
          padding: 1rem 1.5rem;
          transition: all 0.2s;
          border-bottom: 1px solid var(--surface-200);
        }

        .p-accordion-header-link:hover {
          background: var(--surface-50);
        }

        .p-accordion-header-link.p-accordion-header-active {
          background: transparent;
          border-bottom: 1px solid var(--primary-200);
        }

        .p-accordion-content {
          padding: 0;
          border: none;
          border-radius: 0;
          background: transparent;
        }
      }

      .checkbox-sm .p-checkbox-box {
        width: 1.25rem;
        height: 1.25rem;
      }

      .checkbox-sm .p-checkbox-box .p-checkbox-icon {
        font-size: 0.75rem;
      }

      .badge-sm {
        font-size: 0.625rem;
        min-width: 1.25rem;
        height: 1.25rem;
        line-height: 1.25rem;
      }

      .p-button-link {
        padding: 0.25rem 0.5rem;
        font-weight: 500;
      }

      .p-button-link:hover {
        text-decoration: underline;
      }
    }

    .category-item {
      display: block;
      margin: 0;
    }

    .category-item > div {
      background-color: transparent;
      border: none;
      border-radius: 0;
      margin-bottom: 0;
      border-bottom: 1px solid var(--surface-100);
    }

    .category-item:last-child > div {
      border-bottom: none;
    }

    .category-item:hover > div {
      background-color: var(--surface-50);
    }

    .category-item:has(p-checkbox[ng-reflect-model="true"]) > div {
      background-color: var(--primary-50);
    }

    /* Custom scrollbar for filter content */
    .overflow-y-auto {
      scrollbar-width: thin;
      scrollbar-color: var(--surface-300) transparent;
    }

    .overflow-y-auto::-webkit-scrollbar {
      width: 4px;
    }

    .overflow-y-auto::-webkit-scrollbar-track {
      background: transparent;
    }

    .overflow-y-auto::-webkit-scrollbar-thumb {
      background-color: var(--surface-300);
      border-radius: 4px;
    }

    .overflow-y-auto::-webkit-scrollbar-thumb:hover {
      background-color: var(--surface-400);
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

  get activeFilterCount(): number {
    // Count active filters - for now just categories, but can be expanded
    let count = 0;
    
    // Categories filter (only count if not all selected)
    if (this.selectedCategories.length > 0 && this.selectedCategories.length < this.categories.length) {
      count++;
    }
    
    // Future filters can be added here:
    // if (this.priceRangeActive) count++;
    // if (this.organicOnly) count++;
    
    return count;
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

  getApplyButtonLabel(): string {
    const filterCount = this.activeFilterCount;
    
    if (filterCount === 0) {
      return 'Select filters to apply';
    } else if (filterCount === 1) {
      return 'Apply 1 Filter';
    } else {
      return `Apply ${filterCount} Filters`;
    }
  }

  trackByCategoryId(_index: number, category: Category): number {
    return category.id;
  }
}