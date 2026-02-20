import { Component, OnInit, AfterViewInit, effect, inject, input, output, signal, viewChildren, ElementRef } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Brand } from '../../../models/brand.model';
import { BrandService } from '../../../core/services/brand.service';

@Component({
  selector: 'app-brand-filter',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './brand-filter.component.html',
  styleUrls: ['./brand-filter.component.scss']
})
export class BrandFilterComponent implements OnInit, AfterViewInit {
  private brandService = inject(BrandService);

  // Inputs
  activeBrandId = input<number | null>(null);
  showAllOption = input(true);
  allLabel = input('products.filters.all_brands');
  showToggle = input(false);
  filterMode = input<'categories' | 'brands'>('brands');
  showSearchIcon = input(false);

  // ViewChildren using signal-based query
  brandItems = viewChildren<ElementRef>('brandItem');

  // Outputs
  brandSelected = output<number | null>();
  filterModeToggle = output<void>();
  searchToggle = output<void>();

  // State signals
  brands = signal<Brand[]>([]);
  loading = signal(false);
  isSearchOpen = signal(false);

  // Indicator position signals
  indicatorLeft = signal(0);
  indicatorWidth = signal(0);

  constructor() {
    // React to activeBrandId changes
    effect(() => {
      this.activeBrandId();
      setTimeout(() => this.updateIndicator(), 0);
    });
  }

  ngOnInit(): void {
    this.loadBrands();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.updateIndicator(), 0);
  }

  loadBrands(): void {
    this.loading.set(true);
    this.brandService.getBrands(true).subscribe({
      next: (brands) => {
        this.brands.set(brands);
        this.loading.set(false);
        setTimeout(() => this.updateIndicator(), 0);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  updateIndicator(): void {
    const items = this.brandItems();
    const activeIndex = this.getActiveIndex();

    if (activeIndex >= 0 && activeIndex < items.length) {
      const activeElement = items[activeIndex].nativeElement;
      this.indicatorLeft.set(activeElement.offsetLeft);
      this.indicatorWidth.set(activeElement.offsetWidth);
    }
  }

  getActiveIndex(): number {
    if (this.activeBrandId() === null) {
      return this.showAllOption() ? 0 : -1;
    }

    const index = this.brands().findIndex(b => b.id === this.activeBrandId());
    return this.showAllOption() ? index + 1 : index;
  }

  selectBrand(brandId: number | null): void {
    this.brandSelected.emit(brandId);
  }

  toggleFilterMode(): void {
    this.filterModeToggle.emit();
  }

  toggleSearch(): void {
    this.isSearchOpen.update(v => !v);
    this.searchToggle.emit();
  }

  isActive(brandId: number | null): boolean {
    return this.activeBrandId() === brandId;
  }
}
