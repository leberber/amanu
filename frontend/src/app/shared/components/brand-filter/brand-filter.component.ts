import { Component, Input, Output, EventEmitter, OnInit, AfterViewInit, OnChanges, SimpleChanges, ViewChildren, QueryList, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Brand } from '../../../models/brand.model';
import { BrandService } from '../../../core/services/brand.service';

@Component({
  selector: 'app-brand-filter',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './brand-filter.component.html',
  styleUrls: ['./brand-filter.component.scss']
})
export class BrandFilterComponent implements OnInit, AfterViewInit, OnChanges {
  private brandService = inject(BrandService);

  @Input() activeBrandId: number | null = null;
  @Input() showAllOption: boolean = true;
  @Input() allLabel: string = 'products.filters.all_brands';
  @Input() showToggle: boolean = false;
  @Input() filterMode: 'categories' | 'brands' = 'brands';

  @ViewChildren('brandItem') brandItems!: QueryList<ElementRef>;

  @Output() brandSelected = new EventEmitter<number | null>();
  @Output() filterModeToggle = new EventEmitter<void>();

  brands: Brand[] = [];
  loading = false;

  // Indicator position
  indicatorLeft = 0;
  indicatorWidth = 0;

  ngOnInit(): void {
    this.loadBrands();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.updateIndicator(), 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activeBrandId']) {
      setTimeout(() => this.updateIndicator(), 0);
    }
  }

  loadBrands(): void {
    this.loading = true;
    this.brandService.getBrands(true).subscribe({
      next: (brands) => {
        this.brands = brands;
        this.loading = false;
        setTimeout(() => this.updateIndicator(), 0);
      },
      error: (error) => {
        console.error('Error loading brands:', error);
        this.loading = false;
      }
    });
  }

  updateIndicator(): void {
    const items = this.brandItems?.toArray() || [];
    const activeIndex = this.getActiveIndex();

    if (activeIndex >= 0 && activeIndex < items.length) {
      const activeElement = items[activeIndex].nativeElement;
      this.indicatorLeft = activeElement.offsetLeft;
      this.indicatorWidth = activeElement.offsetWidth;
    }
  }

  getActiveIndex(): number {
    if (this.activeBrandId === null) {
      return this.showAllOption ? 0 : -1;
    }

    const index = this.brands.findIndex(b => b.id === this.activeBrandId);
    return this.showAllOption ? index + 1 : index;
  }

  selectBrand(brandId: number | null): void {
    this.brandSelected.emit(brandId);
  }

  toggleFilterMode(): void {
    this.filterModeToggle.emit();
  }

  isActive(brandId: number | null): boolean {
    return this.activeBrandId === brandId;
  }

  trackByBrand(_index: number, brand: Brand): number {
    return brand.id;
  }
}
