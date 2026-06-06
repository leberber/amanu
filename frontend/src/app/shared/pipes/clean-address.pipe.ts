import { Pipe, PipeTransform } from '@angular/core';

// Strips Google Plus Codes (e.g. "G4M3+6M") from address strings.
// Plus Code format: 4–8 uppercase alphanumeric chars + plus sign + 2–3 uppercase alphanumeric chars
const PLUS_CODE_RE = /\b[A-Z0-9]{4,8}\+[A-Z0-9]{2,3}\b\s*/g;

@Pipe({
  name: 'cleanAddress',
  standalone: true
})
export class CleanAddressPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    return value.replace(PLUS_CODE_RE, '').replace(/^[\s,]+/, '').replace(/,?\s*Alg[eé]rie\s*$/i, '').trim();
  }
}
