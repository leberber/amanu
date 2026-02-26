import { Pipe, PipeTransform, inject } from '@angular/core';
import { DateService } from '../../core/services/date.service';


@Pipe({
  name: 'appDate',
  standalone: true
})
export class DateFormatPipe implements PipeTransform {
  private dateService = inject(DateService);

  transform(value: string | Date, format: 'full' | 'dateOnly' | 'timeOnly' | 'relative' = 'full'): string {
    if (!value) return '';

    switch (format) {
      case 'dateOnly':
        return this.dateService.formatDateOnly(value);
      case 'timeOnly':
        return this.dateService.formatTimeOnly(value);
      case 'relative':
        return this.dateService.getRelativeTime(value);
      case 'full':
      default:
        return this.dateService.formatDate(value);
    }
  }
}
