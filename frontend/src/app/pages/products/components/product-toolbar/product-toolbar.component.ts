import { Component, EventEmitter, Input, Output, inject, OnInit, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { onLanguageChange } from '../../../../core/utils/language-change.util';

// PrimeNG imports
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';

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
    TooltipModule
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
      </div>
    </ng-template>

    <!-- Mobile Toolbar Template -->
    <ng-template #mobileToolbar>
      <div class="flex gap-2 align-items-center">
        <ng-container *ngTemplateOutlet="searchBar; context: { class: 'flex-1' }"></ng-container>
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
      padding-block: 0.5rem;
      padding-inline: 3rem;
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
        padding-block: 0.875rem;
        padding-inline: 3rem;
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
      inset-inline-start: 1rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-color-secondary);
      pointer-events: none;
    }

    .search-icon-right {
      position: absolute;
      inset-inline-end: 1rem;
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

    @media (max-width: 768px) {
      .toolbar-container {
        padding: 0.75rem;
      }

      .search-input {
        font-size: 16px; /* Prevents zoom on iOS */
        padding: 0.625rem 0.75rem;
        height: 2.5rem;
      }

      .search-container {
        width: 100%;
        max-width: 100%;
      }

      .search-icon-left {
        inset-inline-start: 0.625rem;
        font-size: 0.875rem;
      }

      .search-icon-right {
        inset-inline-end: 0.5rem;
        font-size: 0.875rem;
        padding: 0.375rem;
      }
    }
    
  `]
})
export class ProductToolbarComponent implements OnInit {
  private translateService = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  @Input() searchQuery = '';
  @Input() sortBy: SortOption = 'name_asc';

  @Output() searchQueryChange = new EventEmitter<string>();
  @Output() sortByChange = new EventEmitter<SortOption>();
  @Output() search = new EventEmitter<void>();
  @Output() searchInput = new EventEmitter<string>();

  sortOptions: { label: string; value: string }[] = [];

  ngOnInit(): void {
    this.initializeSortOptions();
    onLanguageChange(this.translateService, this.destroyRef, () => this.initializeSortOptions());
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

  onSearchInputChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQueryChange.emit(value);
    this.searchInput.emit(value);
  }
}