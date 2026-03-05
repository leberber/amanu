import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'multiline',
  standalone: true
})
export class MultilinePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) {
      return '';
    }
    // Add line break after "&" for two-line display
    return value.replace(/\s*&\s*/g, ' &<br>');
  }
}
