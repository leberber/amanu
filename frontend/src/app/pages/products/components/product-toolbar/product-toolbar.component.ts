import { Component, EventEmitter, Input, Output, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

// PrimeNG imports
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { BadgeModule } from 'primeng/badge';
import { TooltipModule } from 'primeng/tooltip';
import { OverlayBadgeModule } from 'primeng/overlaybadge';

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
    TooltipModule,
    OverlayBadgeModule
  ],
  template: `
    <!-- Toolbar Container -->
    <div class="toolbar-container">
      <!-- Desktop Layout -->
      <div class="hidden lg:block">
        <ng-container *ngTemplateOutlet="desktopToolbar"></ng-container>
      </div>
      
      <!-- Mobile Layout -->
      <div class="block lg:hidden">
        <ng-container *ngTemplateOutlet="mobileToolbar"></ng-container>
      </div>
    </div>

    <!-- ===================== TEMPLATE DEFINITIONS ===================== -->

    <!-- Desktop Toolbar Template -->
    <ng-template #desktopToolbar>
      <div class="flex align-items-center gap-3">
        <!-- Search Section -->
        <ng-container *ngTemplateOutlet="searchBar; context: { class: 'flex-1 max-w-30rem' }"></ng-container>
        
        <!-- Center Spacer -->
        <div class="flex-1"></div>
        
        <!-- Actions Section -->
        <div class="flex align-items-center gap-2">
          <ng-container *ngTemplateOutlet="viewToggle"></ng-container>
          <ng-container *ngIf="filterCount > 0">
            <div class="mx-2 h-2rem border-left-1 surface-border"></div>
            <ng-container *ngTemplateOutlet="filterIndicator"></ng-container>
          </ng-container>
        </div>
      </div>
    </ng-template>

    <!-- Mobile Toolbar Template -->
    <ng-template #mobileToolbar>
      <div class="flex gap-2 align-items-center">
        <ng-container *ngTemplateOutlet="searchBar; context: { class: 'flex-1' }"></ng-container>
        <ng-container *ngTemplateOutlet="viewToggle"></ng-container>
        <ng-container *ngTemplateOutlet="mobileFilterButton"></ng-container>
      </div>
    </ng-template>

    <!-- Search Bar Template -->
    <ng-template #searchBar let-class="class">
      <div class="search-container" [ngClass]="class">
        <i class="pi pi-search search-icon-left"></i>
        <input 
          pInputText 
          type="text"
          [(ngModel)]="searchQuery"
          [placeholder]="'products.search.placeholder' | translate"
          (keyup.enter)="onSearch()"
          (input)="onSearchInputChange($event)"
          class="w-full search-input">
        <i class="pi pi-search cursor-pointer search-icon-right" (click)="onSearch()"></i>
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
      <button 
        pButton 
        type="button" 
        [icon]="viewMode === 'grid' ? 'pi pi-list' : 'pi pi-th-large'"
        class="p-button-text p-button-sm"
        (click)="toggleViewMode()"
        [pTooltip]="viewMode === 'grid' ? ('products.view.list' | translate) : ('products.view.grid' | translate)"
        tooltipPosition="bottom">
      </button>
    </ng-template>

    <!-- Mobile Filter Button Template -->
    <ng-template #mobileFilterButton>
      <p-overlayBadge 
        [value]="filterCount > 0 ? filterCount.toString() : null" 
        severity="danger">
        <button
          pButton
          icon="pi pi-filter"
          class="p-button-text p-button-sm"
          (click)="toggleMobileFilters()"
          [pTooltip]="'products.filters.title' | translate"
          tooltipPosition="bottom">
        </button>
      </p-overlayBadge>
    </ng-template>

    <!-- Filter Indicator Template -->
    <ng-template #filterIndicator>
      <div class="flex align-items-center gap-2">
        <span class="text-sm text-600">
          <i class="pi pi-filter-fill text-primary me-1"></i>
          {{ filterCount === 1 ? ('products.filters.active_count' | translate: {count: filterCount}) : ('products.filters.active_count_plural' | translate: {count: filterCount}) }}
        </span>
        <button
          pButton
          icon="pi pi-times"
          class="p-button-rounded p-button-text p-button-sm p-button-danger"
          [pTooltip]="'products.filters.clear_all' | translate"
          tooltipPosition="bottom"
          (click)="clearFilters()">
        </button>
      </div>
    </ng-template>
  `,
  styles: [`
    :host {
      display: block;
    }

    .toolbar-container {
      padding: 1rem 1.5rem;
      background: white;
      position: relative;
    }

    .search-container {
      position: relative;
    }

    .search-input {
      padding: 0.5rem 3rem;
      border-radius: 12px;
      background: white;
      border: 1px solid #e0e0e0;
      transition: all 0.3s ease;
      outline: none;
      -webkit-appearance: none;
      box-shadow: none;
    }

    .search-input:hover {
      border-color: #c0c0c0;
    }

    .search-input:focus {
      border-color: var(--primary-color);
      outline: none;
      box-shadow: 0 0 0 3px var(--primary-50);
    }
    
    /* Desktop specific - more padding */
    @media (min-width: 769px) {
      .search-input {
        padding: 0.875rem 3rem 0.875rem 3rem;
      }
    }
    
    /* Mobile adjustments */
    @media (max-width: 768px) {
      .search-input:focus {
        box-shadow: 0 0 0 2px var(--primary-50);
      }
    }

    .search-icon-left {
      position: absolute;
      left: 1rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-color-secondary);
      pointer-events: none;
    }

    .search-icon-right {
      position: absolute;
      right: 1rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-color-secondary);
      transition: all 0.3s ease;
      padding: 0.5rem;
      border-radius: 50%;
    }

    .search-container:hover .search-icon-right {
      color: var(--primary-600);
      background: var(--primary-50);
    }
    
    .search-input:focus ~ .search-icon-right {
      color: var(--primary-color);
      background: var(--primary-100);
      transform: translateY(-50%) scale(1.1);
    }
    
    .search-input:focus ~ .search-icon-left {
      color: var(--primary-color);
    }

    ::ng-deep {
      .p-select {
        min-width: 180px;
      }

      .p-select .p-select-label {
        font-weight: 500;
      }

      .p-select:not(.p-disabled):hover {
        border-color: var(--primary-300);
      }

      .p-select:not(.p-disabled).p-focus {
        border-color: var(--primary-500);
        box-shadow: 0 0 0 4px var(--primary-50);
      }
    }

    .view-toggle-group {
      display: flex;
      background: var(--surface-100);
      border-radius: 6px;
      padding: 2px;
      gap: 2px;
    }

    .view-toggle-group button {
      border-radius: 4px;
      transition: all 0.2s;
      color: var(--text-color-secondary);
    }

    .view-toggle-group button:hover:not(.view-active) {
      background: var(--surface-200);
      color: var(--text-color);
    }

    .view-toggle-group button.view-active {
      background: white;
      color: var(--primary-color);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }

    .view-toggle-group button.view-active:hover {
      background: white;
    }

    @media (max-width: 768px) {
      .toolbar-container {
        padding: 1rem;
      }

      .search-input {
        font-size: 16px; /* Prevents zoom on iOS */
        padding: 0.75rem 2.5rem 0.75rem 2.5rem;
        height: 2.75rem;
      }
      
      .search-container {
        width: 100%;
        max-width: 100%;
      }
      
      .search-icon-left,
      .search-icon-right {
        font-size: 1rem;
      }
    }
    
    /* Make overlay badge smaller to match cart badge */
    ::ng-deep .p-overlaybadge .p-badge {
      font-size: 0.7rem;
      min-width: 1.1rem;
      height: 1.1rem;
      line-height: 1.1rem;
      top: 0.25rem !important;
      right: 0.25rem !important;
    }
  `]
})
export class ProductToolbarComponent implements OnInit {
  private translateService = inject(TranslateService);
  @Input() searchQuery = '';
  @Input() sortBy: SortOption = 'name_asc';
  @Input() viewMode: ViewMode = 'grid';
  @Input() filterCount = 0;
  
  @Output() searchQueryChange = new EventEmitter<string>();
  @Output() sortByChange = new EventEmitter<SortOption>();
  @Output() viewModeChange = new EventEmitter<ViewMode>();
  @Output() search = new EventEmitter<void>();
  @Output() searchInput = new EventEmitter<string>();
  @Output() mobileFiltersToggle = new EventEmitter<void>();
  @Output() filtersCleared = new EventEmitter<void>();

  sortOptions: { label: string; value: string }[] = [];

  ngOnInit(): void {
    this.initializeSortOptions();
    
    // Re-initialize on language change
    this.translateService.onLangChange.subscribe(() => {
      this.initializeSortOptions();
    });
  }

  private initializeSortOptions(): void {
    this.sortOptions = [
      { label: this.translateService.instant('products.sort.name_asc'), value: 'name_asc' },
      { label: this.translateService.instant('products.sort.name_desc'), value: 'name_desc' },
      { label: this.translateService.instant('products.sort.price_asc'), value: 'price_asc' },
      { label: this.translateService.instant('products.sort.price_desc'), value: 'price_desc' },
      { label: this.translateService.instant('products.sort.newest'), value: 'created_at_desc' }
    ];
  }

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
  
  toggleViewMode(): void {
    const newMode = this.viewMode === 'grid' ? 'list' : 'grid';
    this.setViewMode(newMode);
  }

  toggleMobileFilters(): void {
    this.mobileFiltersToggle.emit();
  }

  clearFilters(): void {
    this.filtersCleared.emit();
  }

  onSearchInputChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQueryChange.emit(value);
    this.searchInput.emit(value);
  }
}