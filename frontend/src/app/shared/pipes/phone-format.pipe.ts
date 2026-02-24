import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'appPhone',
  standalone: true
})
export class PhoneFormatPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    // Remove all non-digits
    const digits = value.replace(/\D/g, '');

    // Format as 0xxx xx xx xx
    if (digits.length <= 4) {
      return digits;
    } else if (digits.length <= 6) {
      return `${digits.slice(0, 4)} ${digits.slice(4)}`;
    } else if (digits.length <= 8) {
      return `${digits.slice(0, 4)} ${digits.slice(4, 6)} ${digits.slice(6)}`;
    } else {
      return `${digits.slice(0, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
    }
  }
}
