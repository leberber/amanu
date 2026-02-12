import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
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
export class BrandFilterComponent implements OnInit {
  private brandService = inject(BrandService);

  @Input() activeBrandId: number | null = null;
  @Input() showAllOption = true;
  @Input() allLabel = 'filters.all_brands';

  @Output() brandSelected = new EventEmitter<number | null>();

  brands: Brand[] = [];
  loading = false;

  ngOnInit(): void {
    this.loadBrands();
  }

  loadBrands(): void {
    this.loading = true;
    this.brandService.getBrands(true).subscribe({
      next: (brands) => {
        this.brands = brands;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading brands:', error);
        this.loading = false;
      }
    });
  }

  selectBrand(brandId: number | null): void {
    this.brandSelected.emit(brandId);
  }

  isActive(brandId: number | null): boolean {
    return this.activeBrandId === brandId;
  }

  trackByBrand(_index: number, brand: Brand): number {
    return brand.id;
  }
}
