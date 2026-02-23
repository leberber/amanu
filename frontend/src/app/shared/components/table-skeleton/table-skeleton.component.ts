import { Component, input, ViewEncapsulation } from '@angular/core';

export interface SkeletonColumn {
  width: string;
  type: 'image' | 'text' | 'text-multi' | 'pill' | 'pill-sm' | 'price' | 'stock' | 'toggle' | 'actions';
  headerWidth?: string;
}

@Component({
  selector: 'app-table-skeleton',
  standalone: true,
  templateUrl: './table-skeleton.component.html',
  styleUrl: './table-skeleton.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class TableSkeletonComponent {
  rows = input(5);
  columns = input<SkeletonColumn[]>([]);
  showHeader = input(true);
  showFooter = input(true);
  actionCount = input(3);

  get rowsArray(): number[] {
    return Array.from({ length: this.rows() }, (_, i) => i);
  }

  get actionsArray(): number[] {
    return Array.from({ length: this.actionCount() }, (_, i) => i);
  }

  getHeaderWidth(col: SkeletonColumn): string | null {
    return col.headerWidth || null;
  }
}
