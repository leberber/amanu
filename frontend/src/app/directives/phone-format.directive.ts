import { Directive, ElementRef, HostListener, forwardRef } from '@angular/core';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { VALIDATION } from '../core/constants/validation.constants';
import { formatPhoneNumber } from '../core/utils/format.util';

@Directive({
  selector: '[appPhoneFormat]',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PhoneFormatDirective),
      multi: true
    }
  ]
})
export class PhoneFormatDirective implements ControlValueAccessor {
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private el: ElementRef<HTMLInputElement>) {}

  @HostListener('input', ['$event'])
  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const formatted = this.formatPhone(value);
    this.el.nativeElement.value = formatted;
    // Store raw digits for form value
    this.onChange(formatted.replace(/\s/g, ''));
  }

  @HostListener('blur')
  onBlur(): void {
    this.onTouched();
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    // Allow: backspace, delete, tab, escape, enter, arrows
    const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (allowedKeys.includes(event.key)) {
      return;
    }

    // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
    if (event.ctrlKey || event.metaKey) {
      return;
    }

    // Block non-numeric characters
    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
    }

    // Block if already at max length
    const currentValue = this.el.nativeElement.value.replace(/\s/g, '');
    if (currentValue.length >= VALIDATION.MIN_PHONE_LENGTH && !['Backspace', 'Delete'].includes(event.key)) {
      event.preventDefault();
    }
  }

  private formatPhone(value: string): string {
    return formatPhoneNumber(value, VALIDATION.MIN_PHONE_LENGTH);
  }

  // ControlValueAccessor implementation
  writeValue(value: string): void {
    if (value) {
      this.el.nativeElement.value = this.formatPhone(value);
    } else {
      this.el.nativeElement.value = '';
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.el.nativeElement.disabled = isDisabled;
  }
}
