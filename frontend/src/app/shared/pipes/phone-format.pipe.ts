import { Pipe, PipeTransform } from '@angular/core';
import { formatPhoneNumber } from '../../core/utils/format.util';

@Pipe({
  name: 'appPhone',
  standalone: true
})
export class PhoneFormatPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return formatPhoneNumber(value);
  }
}
