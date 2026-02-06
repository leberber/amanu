import { Component, Input, Output, EventEmitter } from '@angular/core';
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
export class CategoryBarComponent {
  @Input() categories: Category[] = [];
  @Input() activeCategoryId: number | null = null;
  @Input() showAllOption = true;
  @Input() allLabel = 'products.filters.all';

  @Output() categorySelected = new EventEmitter<number | null>();

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
