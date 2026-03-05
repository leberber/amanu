import { Component, AfterViewInit, effect, computed, input, output, signal, viewChildren, ElementRef } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { MultilinePipe } from '../../pipes/multiline.pipe';

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
  imports: [TranslateModule, MultilinePipe],
  templateUrl: './horizontal-filter.component.html',
  styleUrls: ['./horizontal-filter.component.scss']
})
export class HorizontalFilterComponent implements AfterViewInit {
  // Inputs
  items = input<FilterItem[]>([]);
  activeItemId = input<number | null>(null);
  filterType = input<FilterType>('categories');
  showAllOption = input(true);
  allLabelInput = input('', { alias: 'allLabel' });
  showSearchIcon = input(false);
  isSearchActive = input(false);
  showModeToggle = input(true);
  compact = input(false);

  // Outputs
  itemSelected = output<number | null>();
  searchToggle = output<void>();
  modeToggle = output<void>();

  // View queries
  filterItems = viewChildren<ElementRef>('filterItem');

  // State
  indicatorLeft = signal(0);
  indicatorWidth = signal(0);

  // Computed
  allLabel = computed(() => {
    const inputLabel = this.allLabelInput();
    if (inputLabel) return inputLabel;
    return this.filterType() === 'categories'
      ? 'products.filters.all_categories'
      : 'products.filters.all_brands';
  });

  toggleImage = computed(() =>
    this.filterType() === 'categories' ? '/brands-icon.png' : '/categories-icon.png'
  );

  iconClass = computed(() =>
    this.filterType() === 'categories' ? 'pi pi-th-large' : 'pi pi-building'
  );

  imageScale = computed(() =>
    this.filterType() === 'categories' ? '1.4' : '1.7'
  );

  constructor() {
    effect(() => {
      this.activeItemId();
      setTimeout(() => this.updateIndicator(), 0);
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.updateIndicator(), 0);
  }

  // Methods
  selectItem(itemId: number | null): void {
    this.itemSelected.emit(itemId);
  }

  toggleSearch(): void {
    this.searchToggle.emit();
  }

  toggleMode(): void {
    this.modeToggle.emit();
  }

  isActive(itemId: number | null): boolean {
    return this.activeItemId() === itemId;
  }

  getItemImage(item: FilterItem): string | undefined {
    return this.filterType() === 'categories' ? item.image_url : item.logo_url;
  }

  // Private
  private updateIndicator(): void {
    const items = this.filterItems();
    const activeIndex = this.getActiveIndex();

    if (activeIndex >= 0 && activeIndex < items.length) {
      const activeElement = items[activeIndex].nativeElement;
      this.indicatorLeft.set(activeElement.offsetLeft);
      this.indicatorWidth.set(activeElement.offsetWidth);
    }
  }

  private getActiveIndex(): number {
    if (this.activeItemId() === null) {
      return this.showAllOption() ? 0 : -1;
    }

    const index = this.items().findIndex(item => item.id === this.activeItemId());
    return this.showAllOption() ? index + 1 : index;
  }
}
