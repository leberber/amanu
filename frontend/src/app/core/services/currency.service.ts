import { Injectable, signal, computed, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export interface CurrencyConfig {
  code: string;
  symbol: string;
  symbolPosition: 'before' | 'after';
  thousandSeparator: string;
  decimalSeparator: string;
  decimalPlaces: number;
  format: string; // e.g., "{value} {symbol}" or "{symbol}{value}"
  symbolAr?: string; // Arabic symbol override
}

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {
  private translateService = inject(TranslateService);
  
  // Available currencies
  private readonly currencies: Record<string, CurrencyConfig> = {
    DZD: {
      code: 'DZD',
      symbol: 'DA',
      symbolAr: 'د.ج',
      symbolPosition: 'after',
      thousandSeparator: ' ',
      decimalSeparator: ',',
      decimalPlaces: 2,
      format: '{value} {symbol}'
    },
    USD: {
      code: 'USD',
      symbol: '$',
      symbolPosition: 'before',
      thousandSeparator: ',',
      decimalSeparator: '.',
      decimalPlaces: 2,
      format: '{symbol}{value}'
    },
    EUR: {
      code: 'EUR',
      symbol: '€',
      symbolPosition: 'after',
      thousandSeparator: ' ',
      decimalSeparator: ',',
      decimalPlaces: 2,
      format: '{value} {symbol}'
    }
  };

  // Current currency signal
  private currentCurrencyCode = signal<string>('DZD');
  
  // Computed signal for current currency config
  public currentCurrency = computed(() => {
    return this.currencies[this.currentCurrencyCode()] || this.currencies['DZD'];
  });

  constructor() {
    this.loadSavedCurrency();
  }

  /**
   * Load saved currency from localStorage
   */
  private loadSavedCurrency(): void {
    try {
      const savedCurrency = localStorage.getItem('selected-currency');
      if (savedCurrency && this.currencies[savedCurrency]) {
        this.currentCurrencyCode.set(savedCurrency);
      }
    } catch (error) {
      console.warn('Could not load saved currency:', error);
    }
  }

  /**
   * Save currency to localStorage
   */
  private saveCurrency(currencyCode: string): void {
    try {
      localStorage.setItem('selected-currency', currencyCode);
    } catch (error) {
      console.warn('Could not save currency:', error);
    }
  }

  /**
   * Set current currency
   * @param currencyCode - Currency code (e.g., 'DZD', 'USD', 'EUR')
   */
  setCurrency(currencyCode: string): void {
    if (this.currencies[currencyCode]) {
      this.currentCurrencyCode.set(currencyCode);
      this.saveCurrency(currencyCode);
    } else {
      console.warn(`Currency ${currencyCode} is not supported`);
    }
  }

  /**
   * Get current currency code
   */
  getCurrentCurrencyCode(): string {
    return this.currentCurrencyCode();
  }

  /**
   * Format currency value
   * @param value - Numeric value
   * @param options - Optional formatting options
   * @returns Formatted currency string
   */
  formatCurrency(
    value: number,
    options?: {
      currency?: string;
      showDecimals?: boolean;
      minDecimals?: number;
      maxDecimals?: number;
    }
  ): string {
    if (value === null || value === undefined || isNaN(value)) {
      return '';
    }

    const currencyCode = options?.currency || this.currentCurrencyCode();
    const currency = this.currencies[currencyCode] || this.currentCurrency();
    
    // Determine decimal places
    let decimals = currency.decimalPlaces;
    if (options?.showDecimals === false) {
      decimals = 0;
    } else if (options?.minDecimals !== undefined || options?.maxDecimals !== undefined) {
      const minDecimals = options.minDecimals ?? 0;
      const maxDecimals = options.maxDecimals ?? currency.decimalPlaces;
      
      // Calculate needed decimals
      const valueStr = value.toFixed(maxDecimals);
      const decimalPart = valueStr.split('.')[1] || '';
      let neededDecimals = decimalPart.length;
      
      // Trim trailing zeros
      while (neededDecimals > minDecimals && decimalPart[neededDecimals - 1] === '0') {
        neededDecimals--;
      }
      
      decimals = Math.max(minDecimals, Math.min(neededDecimals, maxDecimals));
    }

    // Format the number
    const formattedValue = this.formatNumber(value, {
      decimals,
      thousandSeparator: currency.thousandSeparator,
      decimalSeparator: currency.decimalSeparator
    });

    // Apply currency format with language-specific symbol
    const currentLang = this.translateService.currentLang || 'en';
    const symbol = (currentLang === 'ar' && currency.symbolAr) ? currency.symbolAr : currency.symbol;
    
    return currency.format
      .replace('{value}', formattedValue)
      .replace('{symbol}', symbol)
      .trim();
  }

  /**
   * Format number with separators
   * @param value - Numeric value
   * @param options - Formatting options
   * @returns Formatted number string
   */
  private formatNumber(
    value: number,
    options: {
      decimals: number;
      thousandSeparator: string;
      decimalSeparator: string;
    }
  ): string {
    // Round to specified decimals
    const rounded = Math.round(value * Math.pow(10, options.decimals)) / Math.pow(10, options.decimals);
    
    // Split into integer and decimal parts
    const [integerPart, decimalPart = ''] = rounded.toFixed(options.decimals).split('.');
    
    // Add thousand separators
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, options.thousandSeparator);
    
    // Combine parts
    if (options.decimals > 0 && decimalPart) {
      return `${formattedInteger}${options.decimalSeparator}${decimalPart}`;
    }
    
    return formattedInteger;
  }

  /**
   * Parse currency string to number
   * @param value - Currency string
   * @param currency - Currency code (optional, uses current if not provided)
   * @returns Numeric value
   */
  parseCurrency(value: string, currency?: string): number {
    if (!value) return 0;
    
    const currencyConfig = currency ? this.currencies[currency] : this.currentCurrency();
    if (!currencyConfig) return 0;
    
    // Remove currency symbol and spaces
    let cleanValue = value
      .replace(new RegExp(currencyConfig.symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '')
      .trim();
    
    // Replace separators
    cleanValue = cleanValue
      .replace(new RegExp(currencyConfig.thousandSeparator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '')
      .replace(currencyConfig.decimalSeparator, '.');
    
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Get currency symbol
   * @param currency - Currency code (optional, uses current if not provided)
   * @returns Currency symbol
   */
  getCurrencySymbol(currency?: string): string {
    const currencyConfig = currency ? this.currencies[currency] : this.currentCurrency();
    if (!currencyConfig) return '';
    
    const currentLang = this.translateService.currentLang || 'en';
    return (currentLang === 'ar' && currencyConfig.symbolAr) ? currencyConfig.symbolAr : currencyConfig.symbol;
  }

  /**
   * Get all available currencies
   * @returns Array of currency codes
   */
  getAvailableCurrencies(): string[] {
    return Object.keys(this.currencies);
  }

  /**
   * Add a new currency configuration
   * @param config - Currency configuration
   */
  addCurrency(config: CurrencyConfig): void {
    this.currencies[config.code] = config;
  }
}