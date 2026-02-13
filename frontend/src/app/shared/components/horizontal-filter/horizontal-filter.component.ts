import { Component, Input, Output, EventEmitter, OnInit, AfterViewInit, OnChanges, SimpleChanges, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

export interface FilterItem {
  id: number;
  name: string;
  image_url?: string;
  logo_url?: string;
  product_count?: number;
}

export type FilterType = 'categories' | 'brands';

@Component({
  selector: 'app-horizontal-filter',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './horizontal-filter.component.html',
  styleUrls: ['./horizontal-filter.component.scss']
})
export class HorizontalFilterComponent implements OnInit, AfterViewInit, OnChanges {
  @Input() items: FilterItem[] = [];
  @Input() activeItemId: number | null = null;
  @Input() filterType: FilterType = 'categories';
  @Input() showAllOption: boolean = true;
  @Input() allLabel: string = '';
  @Input() showSearchIcon = false;
  @Input() showModeToggle = true; // Show toggle to switch between categories/brands
  @Input() compact = false;

  @ViewChildren('filterItem') filterItems!: QueryList<ElementRef>;

  @Output() itemSelected = new EventEmitter<number | null>();
  @Output() searchToggle = new EventEmitter<void>();
  @Output() modeToggle = new EventEmitter<void>();

  // Indicator position
  indicatorLeft = 0;
  indicatorWidth = 0;

  // Search state
  isSearchOpen = false;

  ngOnInit(): void {
    // Set default all label based on filter type
    if (!this.allLabel) {
      this.allLabel = this.filterType === 'categories'
        ? 'products.filters.all_categories'
        : 'products.filters.all_brands';
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.updateIndicator(), 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activeItemId']) {
      setTimeout(() => this.updateIndicator(), 0);
    }
  }

  updateIndicator(): void {
    const items = this.filterItems?.toArray() || [];
    const activeIndex = this.getActiveIndex();

    if (activeIndex >= 0 && activeIndex < items.length) {
      const activeElement = items[activeIndex].nativeElement;
      this.indicatorLeft = activeElement.offsetLeft;
      this.indicatorWidth = activeElement.offsetWidth;
    }
  }

  getActiveIndex(): number {
    if (this.activeItemId === null) {
      return this.showAllOption ? 0 : -1;
    }

    const index = this.items.findIndex(item => item.id === this.activeItemId);
    // Note: mode toggle is not included in filterItems ViewChildren, so no offset needed
    return this.showAllOption ? index + 1 : index;
  }

  selectItem(itemId: number | null): void {
    this.itemSelected.emit(itemId);
  }

  toggleSearch(): void {
    this.isSearchOpen = !this.isSearchOpen;
    this.searchToggle.emit();
  }

  toggleMode(): void {
    this.modeToggle.emit();
  }

  getToggleIcon(): string {
    return this.filterType === 'categories' ? 'pi pi-building' : 'pi pi-th-large';
  }

  getToggleLabel(): string {
    return this.filterType === 'categories'
      ? 'products.filters.show_brands'
      : 'products.filters.show_categories';
  }

  isActive(itemId: number | null): boolean {
    return this.activeItemId === itemId;
  }

  getItemImage(item: FilterItem): string | undefined {
    return this.filterType === 'categories' ? item.image_url : item.logo_url;
  }

  getIconClass(): string {
    return this.filterType === 'categories' ? 'pi pi-th-large' : 'pi pi-building';
  }

  getScale(): string {
    return this.filterType === 'categories' ? '1.4' : '1.7';
  }

  showItemName(): boolean {
    // Show names for both categories and brands
    return true;
  }

  trackByItem(_index: number, item: FilterItem): number {
    return item.id;
  }
}
