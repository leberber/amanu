import { Directive, ElementRef, HostListener, forwardRef } from '@angular/core';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';

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

  @HostListener('input', ['$event.target.value'])
  onInput(value: string): void {
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

    // Block if already at max length (10 digits)
    const currentValue = this.el.nativeElement.value.replace(/\s/g, '');
    if (currentValue.length >= 10 && !['Backspace', 'Delete'].includes(event.key)) {
      event.preventDefault();
    }
  }

  private formatPhone(value: string): string {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');

    // Limit to 10 digits
    const limited = digits.slice(0, 10);

    // Format as 0xxx xx xx xx
    if (limited.length <= 4) {
      return limited;
    } else if (limited.length <= 6) {
      return `${limited.slice(0, 4)} ${limited.slice(4)}`;
    } else if (limited.length <= 8) {
      return `${limited.slice(0, 4)} ${limited.slice(4, 6)} ${limited.slice(6)}`;
    } else {
      return `${limited.slice(0, 4)} ${limited.slice(4, 6)} ${limited.slice(6, 8)} ${limited.slice(8)}`;
    }
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
