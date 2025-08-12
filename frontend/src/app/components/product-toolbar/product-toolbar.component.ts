import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

// PrimeNG imports
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SelectModule } from 'primeng/select';
import { BadgeModule } from 'primeng/badge';
import { TooltipModule } from 'primeng/tooltip';

export type ViewMode = 'grid' | 'list';
export type SortOption = 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'created_at_desc';

@Component({
  selector: 'app-product-toolbar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    InputTextModule,
    ButtonModule,
    SelectButtonModule,
    SelectModule,
    BadgeModule,
    TooltipModule
  ],
  template: `
    <div class="surface-card p-3 border-bottom-1 surface-border">
      <div class="flex flex-column lg:flex-row gap-3">
        <!-- Search Bar -->
        <div class="flex-grow-1">
          <div class="p-input-icon-left w-full">
            <i class="pi pi-search"></i>
            <input 
              pInputText 
              type="text"
              [(ngModel)]="searchQuery"
              [placeholder]="'products.search_placeholder' | translate"
              (keyup.enter)="onSearch()"
              class="w-full"
            >
          </div>
        </div>
        
        <!-- Actions -->
        <div class="flex gap-2 align-items-center">
          <!-- Sort Dropdown -->
          <p-select
            [(ngModel)]="sortBy"
            [options]="sortOptions"
            optionLabel="label"
            optionValue="value"
            [placeholder]="'products.sort.label' | translate"
            (onChange)="onSortChange()"
            styleClass="w-12rem"
          ></p-select>
          
          <!-- View Toggle -->
          <p-select-button
            [(ngModel)]="viewMode"
            [options]="viewOptions"
            optionValue="value"
            (onChange)="onViewChange()"
          >
            <ng-template let-option pTemplate>
              <i [class]="option.icon" [pTooltip]="option.tooltip" tooltipPosition="bottom"></i>
            </ng-template>
          </p-select-button>
          
          <!-- Mobile Filter Toggle -->
          <div class="relative lg:hidden">
            <button
              pButton
              icon="pi pi-filter"
              class="p-button-outlined"
              (click)="toggleMobileFilters()"
            ></button>
            @if (filterCount > 0) {
              <p-badge [value]="filterCount.toString()" severity="danger" styleClass="absolute -top-2 -right-2"></p-badge>
            }
          </div>
        </div>
      </div>
      
      <!-- Active Filters (if any) -->
      @if (filterCount > 0) {
        <div class="mt-3 flex align-items-center gap-2">
          <span class="text-600">{{ 'products.active_filters' | translate }}:</span>
          <p-badge [value]="filterCount.toString()" severity="info"></p-badge>
          <button
            pButton
            [label]="'products.clear_filters' | translate"
            icon="pi pi-times"
            class="p-button-text p-button-sm ml-auto"
            (click)="clearFilters()"
          ></button>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    
    ::ng-deep .p-selectbutton .p-button {
      padding: 0.5rem 0.75rem;
    }
    
    ::ng-deep .p-selectbutton .p-button i {
      font-size: 1.25rem;
    }
  `]
})
export class ProductToolbarComponent {
  @Input() searchQuery = '';
  @Input() sortBy: SortOption = 'name_asc';
  @Input() viewMode: ViewMode = 'grid';
  @Input() filterCount = 0;
  
  @Output() searchQueryChange = new EventEmitter<string>();
  @Output() sortByChange = new EventEmitter<SortOption>();
  @Output() viewModeChange = new EventEmitter<ViewMode>();
  @Output() search = new EventEmitter<void>();
  @Output() mobileFiltersToggle = new EventEmitter<void>();
  @Output() filtersCleared = new EventEmitter<void>();

  sortOptions = [
    { label: 'Name (A-Z)', value: 'name_asc' },
    { label: 'Name (Z-A)', value: 'name_desc' },
    { label: 'Price (Low to High)', value: 'price_asc' },
    { label: 'Price (High to Low)', value: 'price_desc' },
    { label: 'Newest First', value: 'created_at_desc' }
  ];

  viewOptions = [
    { icon: 'pi pi-th-large', value: 'grid', tooltip: 'Grid View' },
    { icon: 'pi pi-list', value: 'list', tooltip: 'List View' }
  ];

  onSearch(): void {
    this.searchQueryChange.emit(this.searchQuery);
    this.search.emit();
  }

  onSortChange(): void {
    this.sortByChange.emit(this.sortBy);
  }

  onViewChange(): void {
    this.viewModeChange.emit(this.viewMode);
  }

  toggleMobileFilters(): void {
    this.mobileFiltersToggle.emit();
  }

  clearFilters(): void {
    this.filtersCleared.emit();
  }
}