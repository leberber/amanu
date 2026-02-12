import { Component, Input, Output, EventEmitter, ViewChildren, QueryList, ElementRef, AfterViewInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Category } from '../../../models/product.model';

@Component({
  selector: 'app-category-bar',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './category-bar.component.html',
  styleUrls: ['./category-bar.component.scss']
})
export class CategoryBarComponent implements AfterViewInit, OnChanges {
  @Input() categories: Category[] = [];
  @Input() activeCategoryId: number | null = null;
  @Input() showAllOption = true;
  @Input() allLabel = 'products.filters.all';
  @Input() compact = false;
  @Input() showSearchIcon = false;
  @Input() showFilterToggle = false; // Show toggle button instead of "All"
  @Input() filterMode: 'categories' | 'brands' = 'categories'; // Current filter mode

  @ViewChildren('categoryItem') categoryItems!: QueryList<ElementRef>;

  // Internal state for search toggle
  isSearchOpen = false;

  // Indicator position
  indicatorLeft = 0;
  indicatorWidth = 0;

  @Output() categorySelected = new EventEmitter<number | null>();
  @Output() searchToggle = new EventEmitter<void>();
  @Output() filterModeToggle = new EventEmitter<void>(); // Toggle between categories/brands

  ngAfterViewInit(): void {
    setTimeout(() => this.updateIndicator(), 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activeCategoryId']) {
      setTimeout(() => this.updateIndicator(), 0);
    }
  }

  updateIndicator(): void {
    const items = this.categoryItems?.toArray() || [];
    const activeIndex = this.getActiveIndex();

    if (activeIndex >= 0 && activeIndex < items.length) {
      const activeElement = items[activeIndex].nativeElement;
      this.indicatorLeft = activeElement.offsetLeft;
      this.indicatorWidth = activeElement.offsetWidth;
    }
  }

  getActiveIndex(): number {
    if (this.activeCategoryId === null) {
      return this.showAllOption ? 0 : -1;
    }

    const index = this.categories.findIndex(cat => cat.id === this.activeCategoryId);
    // Add 1 to index only if showAllOption is true (to account for "All" being first)
    return this.showAllOption ? index + 1 : index;
  }

  toggleSearch(): void {
    this.isSearchOpen = !this.isSearchOpen;
    this.searchToggle.emit();
  }

  toggleFilterMode(): void {
    this.filterModeToggle.emit();
  }

  selectCategory(categoryId: number | null): void {
    this.categorySelected.emit(categoryId);
  }

  isActive(categoryId: number | null): boolean {
    return this.activeCategoryId === categoryId;
  }

  trackByCategory(_index: number, category: Category): number {
    return category.id;
  }
}
