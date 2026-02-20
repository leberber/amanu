import { Component, AfterViewInit, effect, input, output, signal, viewChildren, ElementRef } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Category } from '../../../models/product.model';

@Component({
  selector: 'app-category-bar',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './category-bar.component.html',
  styleUrls: ['./category-bar.component.scss']
})
export class CategoryBarComponent implements AfterViewInit {
  // Inputs
  categories = input<Category[]>([]);
  activeCategoryId = input<number | null>(null);
  showAllOption = input(true);
  allLabel = input('products.filters.all');
  compact = input(false);
  showSearchIcon = input(false);
  showFilterToggle = input(false);
  filterMode = input<'categories' | 'brands'>('categories');

  // ViewChildren using signal-based query
  categoryItems = viewChildren<ElementRef>('categoryItem');

  // State signals
  isSearchOpen = signal(false);
  indicatorLeft = signal(0);
  indicatorWidth = signal(0);

  // Outputs
  categorySelected = output<number | null>();
  searchToggle = output<void>();
  filterModeToggle = output<void>();

  constructor() {
    // React to activeCategoryId changes
    effect(() => {
      this.activeCategoryId();
      setTimeout(() => this.updateIndicator(), 0);
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.updateIndicator(), 0);
  }

  updateIndicator(): void {
    const items = this.categoryItems();
    const activeIndex = this.getActiveIndex();

    if (activeIndex >= 0 && activeIndex < items.length) {
      const activeElement = items[activeIndex].nativeElement;
      this.indicatorLeft.set(activeElement.offsetLeft);
      this.indicatorWidth.set(activeElement.offsetWidth);
    }
  }

  getActiveIndex(): number {
    if (this.activeCategoryId() === null) {
      return this.showAllOption() ? 0 : -1;
    }

    const index = this.categories().findIndex(cat => cat.id === this.activeCategoryId());
    return this.showAllOption() ? index + 1 : index;
  }

  toggleSearch(): void {
    this.isSearchOpen.update(v => !v);
    this.searchToggle.emit();
  }

  toggleFilterMode(): void {
    this.filterModeToggle.emit();
  }

  selectCategory(categoryId: number | null): void {
    this.categorySelected.emit(categoryId);
  }

  isActive(categoryId: number | null): boolean {
    return this.activeCategoryId() === categoryId;
  }
}
