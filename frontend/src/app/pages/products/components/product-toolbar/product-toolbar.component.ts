import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

// PrimeNG imports
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
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
    SelectModule,
    BadgeModule,
    TooltipModule
  ],
  template: `
    <!-- Toolbar Container -->
    <div class="p-3">
      <!-- Desktop Layout -->
      <div class="hidden lg:block">
        <ng-container *ngTemplateOutlet="desktopToolbar"></ng-container>
      </div>
      
      <!-- Mobile Layout -->
      <div class="block lg:hidden">
        <ng-container *ngTemplateOutlet="mobileToolbar"></ng-container>
      </div>
      
      <!-- Active Filters Indicator -->
      <ng-container *ngIf="filterCount > 0">
        <ng-container *ngTemplateOutlet="activeFilters"></ng-container>
      </ng-container>
    </div>

    <!-- ===================== TEMPLATE DEFINITIONS ===================== -->

    <!-- Desktop Toolbar Template -->
    <ng-template #desktopToolbar>
      <div class="flex gap-3">
        <ng-container *ngTemplateOutlet="searchBar; context: { class: 'flex-1' }"></ng-container>
        <ng-container *ngTemplateOutlet="sortDropdown"></ng-container>
        <ng-container *ngTemplateOutlet="viewToggle"></ng-container>
      </div>
    </ng-template>

    <!-- Mobile Toolbar Template -->
    <ng-template #mobileToolbar>
      <div class="flex flex-column gap-3">
        <div class="flex gap-2">
          <ng-container *ngTemplateOutlet="searchBar; context: { class: 'flex-1' }"></ng-container>
          <ng-container *ngTemplateOutlet="mobileFilterButton"></ng-container>
        </div>
        <div class="flex gap-2">
          <ng-container *ngTemplateOutlet="sortDropdown; context: { class: 'flex-1' }"></ng-container>
          <ng-container *ngTemplateOutlet="viewToggle"></ng-container>
        </div>
      </div>
    </ng-template>

    <!-- Search Bar Template -->
    <ng-template #searchBar let-class="class">
      <div class="p-input-icon-left" [ngClass]="class">
        <i class="pi pi-search"></i>
        <input 
          pInputText 
          type="text"
          [(ngModel)]="searchQuery"
          [placeholder]="'products.search_placeholder' | translate"
          (keyup.enter)="onSearch()"
          class="w-full">
      </div>
    </ng-template>

    <!-- Sort Dropdown Template -->
    <ng-template #sortDropdown let-class="class">
      <p-select
        [(ngModel)]="sortBy"
        [options]="sortOptions"
        optionLabel="label"
        optionValue="value"
        [placeholder]="'products.sort.label' | translate"
        (onChange)="onSortChange()"
        [styleClass]="class || 'w-12rem'">
        <ng-template let-option pTemplate="selectedItem">
          <div class="flex align-items-center gap-2">
            <i class="pi pi-sort-alt"></i>
            <span>{{ option.label }}</span>
          </div>
        </ng-template>
      </p-select>
    </ng-template>

    <!-- View Toggle Template -->
    <ng-template #viewToggle>
      <div class="p-buttonset">
        <button 
          pButton 
          type="button" 
          [icon]="'pi pi-th-large'"
          [class.p-button-outlined]="viewMode !== 'grid'"
          (click)="setViewMode('grid')"
          [pTooltip]="'Grid View' | translate"
          tooltipPosition="bottom">
        </button>
        <button 
          pButton 
          type="button" 
          [icon]="'pi pi-list'"
          [class.p-button-outlined]="viewMode !== 'list'"
          (click)="setViewMode('list')"
          [pTooltip]="'List View' | translate"
          tooltipPosition="bottom">
        </button>
      </div>
    </ng-template>

    <!-- Mobile Filter Button Template -->
    <ng-template #mobileFilterButton>
      <div class="relative">
        <button
          pButton
          icon="pi pi-filter"
          class="p-button-outlined"
          (click)="toggleMobileFilters()"
          [pTooltip]="'Filters' | translate"
          tooltipPosition="bottom">
        </button>
        <ng-container *ngIf="filterCount > 0">
          <p-badge 
            [value]="filterCount.toString()" 
            severity="danger" 
            styleClass="absolute -top-2 -right-2">
          </p-badge>
        </ng-container>
      </div>
    </ng-template>

    <!-- Active Filters Template -->
    <ng-template #activeFilters>
      <div class="mt-3 flex align-items-center gap-2">
        <span class="text-600">{{ 'products.active_filters' | translate }}:</span>
        <p-badge [value]="filterCount.toString()" severity="info"></p-badge>
        <button
          pButton
          [label]="'products.clear_filters' | translate"
          icon="pi pi-times"
          class="p-button-text p-button-sm ml-auto"
          (click)="clearFilters()">
        </button>
      </div>
    </ng-template>
  `,
  styles: [`
    :host {
      display: block;
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

  onSearch(): void {
    this.searchQueryChange.emit(this.searchQuery);
    this.search.emit();
  }

  onSortChange(): void {
    this.sortByChange.emit(this.sortBy);
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
    this.viewModeChange.emit(this.viewMode);
  }

  toggleMobileFilters(): void {
    this.mobileFiltersToggle.emit();
  }

  clearFilters(): void {
    this.filtersCleared.emit();
  }
}