# Code Audit Report - Amanu/Elsuq E-commerce Application

## Overview
This document outlines all code improvements needed to achieve DRY principles, consistency, and best practices with Angular 18+ and PrimeNG.

## 1. Common Code Duplications

### 1.1 Date Formatting
**Issue**: Date formatting logic is duplicated across multiple components
**Found in**: 
- `admin-dashboard.component.ts`
- `admin-orders.component.ts`
- `account.component.ts`
- Multiple other components

**Current code pattern**:
```typescript
formatDate(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}
```

**Solution**: Create a shared utility service or pipe

### 1.2 User Role Checking
**Issue**: Role checking logic duplicated across components
**Found in**:
- `header.component.ts`
- `bottom-navigation.component.ts`
- `mobile-admin-menu.component.ts`
- Route guards

**Current patterns**:
```typescript
isAdmin(): boolean {
  const user = this.authService.currentUserValue;
  return user?.role === UserRole.ADMIN;
}

isAdminOrStaff(): boolean {
  const user = this.authService.currentUserValue;
  return user ? (user.role === UserRole.ADMIN || user.role === UserRole.STAFF) : false;
}
```

**Solution**: Centralize in AuthService or create a RoleService

### 1.3 Translation Loading for Products/Categories
**Issue**: Similar pattern for loading translated names
**Found in**:
- Multiple admin components
- Product display components

**Current pattern**:
```typescript
getProductName(product: any): string {
  const currentLang = this.translateService.currentLang;
  if (product.name_translations && product.name_translations[currentLang]) {
    return product.name_translations[currentLang];
  }
  return product.name || '';
}
```

**Solution**: Create a TranslationHelper service

### 1.4 Unit Display Logic
**Issue**: Unit display logic duplicated across components
**Found in**: 
- Product components
- Cart components
- Order components

**Current code pattern**:
```typescript
getUnitDisplay(unit: string): string {
  switch (unit) {
    case 'kg':
      return 'Kg';
    case 'gram':
      return 'g';
    case 'piece':
      return 'Piece';
    case 'bunch':
      return 'Bunch';
    case 'dozen':
      return 'Dozen';
    case 'pound':
      return 'lb';
    default:
      return unit;
  }
}
```

**Problems**:
- Duplicated in multiple places
- Hard to add new units
- No centralized configuration
- Not translation-friendly

**Solution**: 
1. Create a UnitsService with configurable units
2. Support for translations
3. Easy to extend with new units
4. Consistent unit handling across the app

### 1.5 Form Validation Error Display
**Issue**: Repeated error checking logic
**Found in**: All form components

**Current pattern**:
```typescript
getFieldError(form: FormGroup, fieldName: string, errorType: string): boolean {
  const field = form.get(fieldName);
  return !!(field?.hasError(errorType) && field?.touched);
}
```

**Solution**: Create a shared FormValidationService or directive

### 1.6 Currency Display
**Issue**: Prices displayed in dollars ($) across all components
**Found in**: 
- All product components
- Cart components
- Order components
- Admin components

**Current patterns**:
```typescript
// Hardcoded dollar sign
<span>${{product.price}}</span>
<span>${{(item.product_price * item.quantity).toFixed(2)}}</span>
```

**Problems**:
- Hardcoded USD currency
- No support for Algerian Dinar (DZD)
- Inconsistent formatting
- No reactive updates with signals

**Solution**: 
1. Create CurrencyService with signals
2. Support Algerian Dinar formatting (e.g., "1,500 DA" or "1 500 DZD")
3. Configurable currency settings
4. Consistent formatting across the app

### 1.7 Helper Functions in Components
**Issue**: Utility functions duplicated across components instead of being in services
**Found in**: Multiple components

**Examples**:
```typescript
// Functions that should be in services:
- formatPrice()
- calculateTotal()
- validateEmail()
- truncateText()
- sortProducts()
- filterByCategory()
```

**Solution**: 
- Move ALL utility functions to appropriate services
- Components should only contain view-specific logic
- Any function used in 2+ places must be in a service

### 1.8 Loading States and Error Handling
**Issue**: Inconsistent loading/error handling patterns
**Found in**: Most components with API calls

**Solution**: Create interceptors and standardized loading/error components

## 2. Component Structure Inconsistencies

### 2.1 Import Organization
**Issue**: Inconsistent import ordering and grouping
**Solution**: Establish import order convention:
1. Angular core imports
2. Third-party imports (RxJS, PrimeNG)
3. Services
4. Models/Interfaces
5. Components

### 2.2 Dependency Injection Pattern
**Issue**: Mixed use of constructor injection vs inject() function
**Found in**: All components and services

**Current patterns**:
```typescript
// Old pattern - constructor injection
constructor(
  private authService: AuthService,
  private router: Router
) {}

// New pattern - inject() function
private authService = inject(AuthService);
private router = inject(Router);
```

**Solution**: 
- Use inject() function consistently across all components/services
- Remove constructor injection except when needed for initialization logic
- Follow Angular 18+ best practices

### 2.3 Component Decorator Properties
**Issue**: Inconsistent use of `styleUrl` vs `styleUrls`, standalone components setup
**Solution**: Standardize to Angular 18+ conventions

### 2.4 Signal vs Observable Usage
**Issue**: Mixed usage of signals and observables
**Found in**: Various components
**Solution**: Establish clear guidelines for when to use each

## 3. Service Layer Improvements

### 3.1 API Call Patterns
**Issue**: Inconsistent error handling and response typing
**Solution**: Create a base API service with standardized methods

### 3.2 State Management
**Issue**: Mixed approaches to state management (services, signals, subjects)
**Solution**: Implement consistent state management pattern

## 4. Shared Components Needed

### 4.1 Loading Component
- Standardized loading spinner/skeleton

### 4.2 Error Display Component
- Consistent error message display

### 4.3 Empty State Component
- Reusable component for "no data" scenarios

### 4.4 Confirmation Dialog Component
- Standardized confirmation dialogs

### 4.5 Data Table Component
- Wrapper around p-table with common configurations

### 4.6 Centralized Notification System
**Issue**: Inconsistent notification styles and behaviors across the app
**Found in**: 
- Toast messages with different styles
- Error messages displayed differently in forms vs API responses
- Success messages with varying durations and positions
- Warning/info messages with no standard format

**Current problems**:
```typescript
// Different notification approaches found:
// 1. Direct MessageService usage with different configs
this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Product added' });
this.messageService.add({ severity: 'error', summary: 'Error', detail: error.message, life: 5000 });

// 2. Custom error divs in templates
<div class="error-message">{{ errorMessage }}</div>

// 3. PrimeNG Message component with different styles
<p-message severity="error" text="Invalid input"></p-message>

// 4. Alert-style messages
<div class="alert alert-danger">{{ error }}</div>
```

**Solution**: Create centralized notification service and components

```typescript
// notification.service.ts
export interface NotificationConfig {
  position?: 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center';
  duration?: number;
  closable?: boolean;
  style?: 'toast' | 'inline' | 'banner';
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private messageService = inject(MessageService);
  
  // Standardized notification methods
  success(message: string, title = 'Success', config?: NotificationConfig) {
    this.show('success', message, title, config);
  }
  
  error(message: string, title = 'Error', config?: NotificationConfig) {
    this.show('error', message, title, { duration: 5000, ...config });
  }
  
  warning(message: string, title = 'Warning', config?: NotificationConfig) {
    this.show('warn', message, title, config);
  }
  
  info(message: string, title = 'Information', config?: NotificationConfig) {
    this.show('info', message, title, config);
  }
  
  // Handle API errors with consistent format
  handleApiError(error: any) {
    const message = this.extractErrorMessage(error);
    this.error(message, 'Operation Failed');
  }
  
  private extractErrorMessage(error: any): string {
    if (error.error?.detail) return error.error.detail;
    if (error.error?.message) return error.error.message;
    if (error.message) return error.message;
    return 'An unexpected error occurred. Please try again.';
  }
}
```

**Standardized notification styles**:
```css
/* Global notification styles */
:root {
  /* Notification colors */
  --notify-success-bg: #10b981;
  --notify-success-text: #ffffff;
  --notify-error-bg: #ef4444;
  --notify-error-text: #ffffff;
  --notify-warning-bg: #f59e0b;
  --notify-warning-text: #ffffff;
  --notify-info-bg: #3b82f6;
  --notify-info-text: #ffffff;
  
  /* Notification sizing */
  --notify-padding: var(--space-3) var(--space-4);
  --notify-border-radius: 6px;
  --notify-min-width: 300px;
  --notify-max-width: 500px;
}

/* Toast notifications */
.notification-toast {
  padding: var(--notify-padding);
  border-radius: var(--notify-border-radius);
  min-width: var(--notify-min-width);
  max-width: var(--notify-max-width);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Inline notifications (forms, etc) */
.notification-inline {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--notify-border-radius);
  margin: var(--space-2) 0;
  border-left: 4px solid;
}

/* Banner notifications (page-level) */
.notification-banner {
  padding: var(--space-3) var(--space-4);
  width: 100%;
  text-align: center;
}

/* Severity-specific styles */
.notification-success {
  background-color: var(--notify-success-bg);
  color: var(--notify-success-text);
  border-color: var(--notify-success-bg);
}

.notification-error {
  background-color: var(--notify-error-bg);
  color: var(--notify-error-text);
  border-color: var(--notify-error-bg);
}

.notification-warning {
  background-color: var(--notify-warning-bg);
  color: var(--notify-warning-text);
  border-color: var(--notify-warning-bg);
}

.notification-info {
  background-color: var(--notify-info-bg);
  color: var(--notify-info-text);
  border-color: var(--notify-info-bg);
}

/* Form validation errors */
.field-error {
  color: var(--notify-error-bg);
  font-size: 0.875rem;
  margin-top: var(--space-1);
}

/* Empty states */
.empty-state {
  text-align: center;
  padding: var(--space-8) var(--space-4);
  color: var(--text-muted);
}

.empty-state-icon {
  font-size: 3rem;
  margin-bottom: var(--space-4);
  opacity: 0.5;
}

.empty-state-message {
  font-size: 1.125rem;
  margin-bottom: var(--space-2);
}

/* Loading states */
.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--surface-border);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
```

**Usage patterns**:
```typescript
// Component usage
export class ProductComponent {
  private notify = inject(NotificationService);
  
  async saveProduct() {
    try {
      await this.productService.save(this.product);
      this.notify.success('Product saved successfully');
    } catch (error) {
      this.notify.handleApiError(error);
    }
  }
  
  deleteProduct() {
    // Consistent confirmation dialog
    this.confirmService.confirm({
      message: 'Are you sure you want to delete this product?',
      header: 'Delete Confirmation',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.performDelete()
    });
  }
}

// Form validation errors
<div class="form-group">
  <input [(ngModel)]="email" #emailInput="ngModel" required email>
  <div *ngIf="emailInput.invalid && emailInput.touched" class="field-error">
    Please enter a valid email address
  </div>
</div>

// Empty states
<div *ngIf="products.length === 0" class="empty-state">
  <i class="pi pi-inbox empty-state-icon"></i>
  <p class="empty-state-message">No products found</p>
  <button class="p-button" (click)="addProduct()">Add First Product</button>
</div>

// Loading states
<div *ngIf="loading" class="loading-container">
  <div class="loading-spinner"></div>
</div>
```

**Configuration**:
```typescript
// app.config.ts
export const NOTIFICATION_CONFIG = {
  defaultDuration: 3000,
  errorDuration: 5000,
  position: 'top-right',
  closable: true,
  preventDuplicates: true,
  maxStack: 5
};
```

## 5. Utility Functions/Services Needed

### 5.1 DateUtilityService
- formatDate()
- formatDateTime()
- parseDate()

### 5.2 TranslationHelperService
- getTranslatedField()
- getCurrentLanguage()
- getLocalizedValue()

### 5.3 FormValidationService
- Common validators
- Error message generation
- Field error checking

### 5.4 CurrencyService
- formatCurrency() - Format prices in Algerian Dinar (DZD)
- parseCurrency()
- Use signals for reactive currency formatting
- Support for currency symbol placement (before/after)
- Thousand separators for Algerian format

### 5.5 UnitsService
- getUnitDisplay()
- getUnitTranslationKey()
- getAllUnits()
- addNewUnit()
- Configurable units registry

### 5.6 NotificationService
- Wrapper around MessageService for consistent notifications

## 6. Type Safety Improvements

### 6.1 API Response Types
**Issue**: Many API responses typed as `any`
**Solution**: Create proper interfaces for all API responses

### 6.2 Event Handlers
**Issue**: Loose typing on event handlers
**Solution**: Properly type all event parameters

## 7. Signal Migration

### 7.1 State Management with Signals
**Issue**: Mixed use of observables and signals
**Current state**: Some components use signals, others use BehaviorSubjects
**Solution**: Migrate to signals for:
- Currency formatting state
- User preferences
- Cart state
- Loading states
- Form values where appropriate

### 7.2 Computed Signals
**Issue**: Manual calculations in templates
**Solution**: Use computed signals for derived values like:
- Formatted prices
- Cart totals
- Filtered lists

## 8. Performance Optimizations

### 8.1 Change Detection
**Issue**: Not utilizing OnPush strategy where applicable
**Solution**: Implement OnPush for presentational components

### 8.2 Lazy Loading
**Issue**: Some heavy components not lazy loaded
**Solution**: Implement proper lazy loading strategies

### 8.3 Subscription Management
**Issue**: Manual subscription management in many places
**Solution**: Use takeUntilDestroyed() or async pipe

## 9. Styling Improvements

### 9.1 CSS Duplication
**Issue**: Similar styles repeated across components
**Solution**: Create shared CSS classes and mixins

### 9.2 Responsive Design Patterns
**Issue**: Inconsistent breakpoint usage
**Solution**: Standardize responsive design approach

### 9.3 External CSS Usage
**Issue**: Components have external CSS files for minimal styling
**Found in**: Most components have .css files with just a few lines

**Problems**:
- Increases number of files to maintain
- Slows down build process
- Makes it harder to find styles
- Often contains only 1-3 CSS rules

**Solution**:
1. **Use external CSS ONLY when**:
   - Component has 10+ unique CSS rules
   - Complex animations or keyframes are needed
   - Third-party library overrides require isolation
   - Component-specific media queries exceed 5 rules

2. **For simple styles**:
   - Use inline styles with `[style]` binding
   - Use Tailwind classes
   - Use global utility classes

**Example refactoring**:
```typescript
// ❌ Bad - external CSS file for 2 rules
// component.css
.container { padding: 20px; }
.title { font-size: 24px; }

// ✅ Good - use Tailwind or global classes
template: `
  <div class="p-5">
    <h1 class="text-2xl">Title</h1>
  </div>
`
```

### 9.4 Global CSS Classes
**Issue**: No standardized global utility classes for common patterns
**Found in**: Repeated inline styles and component CSS

**Common patterns needing global classes**:
```css
/* Spacing patterns */
.content-spacing { padding: 1.5rem; }
.section-spacing { margin-bottom: 2rem; }
.card-spacing { padding: 1rem; }

/* Typography patterns */
.page-title { font-size: 2rem; font-weight: 600; margin-bottom: 1rem; }
.section-title { font-size: 1.5rem; font-weight: 500; margin-bottom: 0.75rem; }
.card-title { font-size: 1.25rem; font-weight: 500; }

/* Layout patterns */
.flex-center { display: flex; align-items: center; justify-content: center; }
.flex-between { display: flex; align-items: center; justify-content: space-between; }
.grid-responsive { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); }

/* Form patterns */
.form-group { margin-bottom: 1rem; }
.form-label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
.form-error { color: var(--error-color); font-size: 0.875rem; margin-top: 0.25rem; }

/* Card patterns */
.card-shadow { box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.card-hover { transition: transform 0.2s; }
.card-hover:hover { transform: translateY(-2px); }

/* Status patterns */
.status-active { color: var(--success-color); }
.status-inactive { color: var(--muted-color); }
.status-pending { color: var(--warning-color); }

/* Button patterns */
.btn-primary { /* primary button styles */ }
.btn-secondary { /* secondary button styles */ }
.btn-danger { /* danger button styles */ }

/* Table patterns */
.table-striped { /* striped table styles */ }
.table-hover { /* hoverable table rows */ }

/* Loading states */
.skeleton { background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); }
.pulse { animation: pulse 1.5s infinite; }
```

**Solution**:
1. Create `styles/utilities.css` with all common patterns
2. Import once in `styles.css`
3. Use these classes instead of component-specific styles
4. Document usage in style guide

### 9.5 Themeable Color System
**Issue**: Colors are hardcoded throughout the application with no central theme
**Found in**: Every component uses different color values

**Current problems**:
- Hardcoded hex colors: #007bff, #28a745, #dc3545, etc.
- No consistent color palette
- Cannot change theme easily
- No dark mode support
- Brand colors not defined

**Solution**: Implement CSS custom properties for theming

```css
/* Global theme colors */
:root {
  /* Primary colors - main brand colors */
  --primary-50: #f0f9ff;
  --primary-100: #e0f2fe;
  --primary-200: #bae6fd;
  --primary-300: #7dd3fc;
  --primary-400: #38bdf8;
  --primary-500: #0ea5e9;  /* Main primary */
  --primary-600: #0284c7;
  --primary-700: #0369a1;
  --primary-800: #075985;
  --primary-900: #0c4a6e;
  
  /* Secondary colors - complementary colors */
  --secondary-50: #faf5ff;
  --secondary-100: #f3e8ff;
  --secondary-200: #e9d5ff;
  --secondary-300: #d8b4fe;
  --secondary-400: #c084fc;
  --secondary-500: #a855f7;  /* Main secondary */
  --secondary-600: #9333ea;
  --secondary-700: #7c3aed;
  --secondary-800: #6b21a8;
  --secondary-900: #581c87;
  
  /* Tertiary colors - accent colors */
  --tertiary-50: #fff7ed;
  --tertiary-100: #ffedd5;
  --tertiary-200: #fed7aa;
  --tertiary-300: #fdba74;
  --tertiary-400: #fb923c;
  --tertiary-500: #f97316;  /* Main tertiary */
  --tertiary-600: #ea580c;
  --tertiary-700: #c2410c;
  --tertiary-800: #9a3412;
  --tertiary-900: #7c2d12;
  
  /* Semantic colors */
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #3b82f6;
  
  /* Neutral colors */
  --neutral-0: #ffffff;
  --neutral-50: #f9fafb;
  --neutral-100: #f3f4f6;
  --neutral-200: #e5e7eb;
  --neutral-300: #d1d5db;
  --neutral-400: #9ca3af;
  --neutral-500: #6b7280;
  --neutral-600: #4b5563;
  --neutral-700: #374151;
  --neutral-800: #1f2937;
  --neutral-900: #111827;
  --neutral-950: #030712;
  
  /* Applied theme colors */
  --color-primary: var(--primary-500);
  --color-primary-hover: var(--primary-600);
  --color-primary-active: var(--primary-700);
  --color-primary-light: var(--primary-100);
  --color-primary-lighter: var(--primary-50);
  
  --color-secondary: var(--secondary-500);
  --color-secondary-hover: var(--secondary-600);
  --color-secondary-active: var(--secondary-700);
  --color-secondary-light: var(--secondary-100);
  --color-secondary-lighter: var(--secondary-50);
  
  --color-tertiary: var(--tertiary-500);
  --color-tertiary-hover: var(--tertiary-600);
  --color-tertiary-active: var(--tertiary-700);
  --color-tertiary-light: var(--tertiary-100);
  --color-tertiary-lighter: var(--tertiary-50);
  
  /* Text colors */
  --text-primary: var(--neutral-900);
  --text-secondary: var(--neutral-700);
  --text-muted: var(--neutral-500);
  --text-disabled: var(--neutral-400);
  --text-inverse: var(--neutral-0);
  
  /* Background colors */
  --bg-primary: var(--neutral-0);
  --bg-secondary: var(--neutral-50);
  --bg-tertiary: var(--neutral-100);
  --bg-inverse: var(--neutral-900);
  
  /* Border colors */
  --border-primary: var(--neutral-200);
  --border-secondary: var(--neutral-300);
  --border-focus: var(--color-primary);
  
  /* Component-specific colors */
  --button-primary-bg: var(--color-primary);
  --button-primary-hover: var(--color-primary-hover);
  --button-primary-text: var(--text-inverse);
  
  --button-secondary-bg: var(--color-secondary);
  --button-secondary-hover: var(--color-secondary-hover);
  --button-secondary-text: var(--text-inverse);
  
  --card-bg: var(--bg-primary);
  --card-border: var(--border-primary);
  --card-shadow: rgba(0, 0, 0, 0.1);
  
  --input-bg: var(--bg-primary);
  --input-border: var(--border-primary);
  --input-focus-border: var(--border-focus);
  
  --link-color: var(--color-primary);
  --link-hover: var(--color-primary-hover);
}

/* Dark theme */
[data-theme="dark"] {
  /* Invert neutral colors for dark mode */
  --text-primary: var(--neutral-100);
  --text-secondary: var(--neutral-300);
  --text-muted: var(--neutral-400);
  
  --bg-primary: var(--neutral-900);
  --bg-secondary: var(--neutral-800);
  --bg-tertiary: var(--neutral-700);
  
  --border-primary: var(--neutral-700);
  --border-secondary: var(--neutral-600);
  
  --card-bg: var(--neutral-800);
  --card-shadow: rgba(0, 0, 0, 0.3);
  
  --input-bg: var(--neutral-800);
  --input-border: var(--neutral-600);
}

/* Custom theme example - can be changed easily */
[data-theme="brand"] {
  /* Override primary with brand colors */
  --primary-500: #2d7a2d;  /* Example: Green primary */
  --primary-600: #246124;
  --primary-700: #1c4a1c;
  
  --secondary-500: #ff6b6b;  /* Example: Red secondary */
  --secondary-600: #ff5252;
  --secondary-700: #ff3838;
}
```

**Usage in components**:
```css
/* Buttons */
.btn-primary {
  background-color: var(--button-primary-bg);
  color: var(--button-primary-text);
  border: 1px solid var(--button-primary-bg);
}

.btn-primary:hover {
  background-color: var(--button-primary-hover);
}

/* Cards */
.card {
  background-color: var(--card-bg);
  border: 1px solid var(--card-border);
  box-shadow: 0 2px 4px var(--card-shadow);
}

/* Forms */
.form-input {
  background-color: var(--input-bg);
  border: 1px solid var(--input-border);
  color: var(--text-primary);
}

.form-input:focus {
  border-color: var(--input-focus-border);
}

/* Text */
.text-primary { color: var(--text-primary); }
.text-secondary { color: var(--text-secondary); }
.text-muted { color: var(--text-muted); }

/* Backgrounds */
.bg-primary { background-color: var(--bg-primary); }
.bg-secondary { background-color: var(--bg-secondary); }
.bg-tertiary { background-color: var(--bg-tertiary); }
```

**Theme Service**:
```typescript
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private currentTheme = signal<'light' | 'dark' | 'brand'>('light');
  
  setTheme(theme: 'light' | 'dark' | 'brand') {
    document.documentElement.setAttribute('data-theme', theme);
    this.currentTheme.set(theme);
    localStorage.setItem('theme', theme);
  }
  
  toggleTheme() {
    const current = this.currentTheme();
    const next = current === 'light' ? 'dark' : 'light';
    this.setTheme(next);
  }
  
  initTheme() {
    const saved = localStorage.getItem('theme') as any || 'light';
    this.setTheme(saved);
  }
  
  // Allow runtime color changes
  setCustomColors(colors: Partial<ThemeColors>) {
    Object.entries(colors).forEach(([key, value]) => {
      document.documentElement.style.setProperty(`--${key}`, value);
    });
  }
}
```

**Benefits**:
1. **Easy theme changes** - Change entire app colors by modifying CSS variables
2. **Dark mode support** - Switch themes with one attribute
3. **Brand customization** - Create custom themes for different deployments
4. **Consistent colors** - All components use the same color palette
5. **Runtime theming** - Change colors dynamically without rebuilding

**Implementation steps**:
1. Define all color variables in `:root`
2. Replace all hardcoded colors with CSS variables
3. Create theme service for theme management
4. Add theme toggle to UI
5. Store user preference in localStorage

### 9.6 Standardized Spacing System
**Issue**: Inconsistent padding and margins across components
**Found in**: Every component uses different spacing values

**Current problems**:
- Random padding values: 8px, 10px, 12px, 15px, 16px, 20px, 24px
- Inconsistent margins: 5px, 10px, 15px, 1rem, 1.5rem, 2rem
- No spacing scale or system
- Difficult to maintain visual consistency

**Solution**: Implement 8-point spacing system

```css
/* Base spacing unit: 8px */
:root {
  --space-0: 0;
  --space-1: 0.25rem;  /* 4px */
  --space-2: 0.5rem;   /* 8px - base unit */
  --space-3: 0.75rem;  /* 12px */
  --space-4: 1rem;     /* 16px */
  --space-5: 1.25rem;  /* 20px */
  --space-6: 1.5rem;   /* 24px */
  --space-8: 2rem;     /* 32px */
  --space-10: 2.5rem;  /* 40px */
  --space-12: 3rem;    /* 48px */
  --space-16: 4rem;    /* 64px */
}

/* Standardized component spacing */
.page-container {
  padding: var(--space-6);  /* 24px */
}

.section {
  margin-bottom: var(--space-8);  /* 32px */
}

.card {
  padding: var(--space-4);  /* 16px */
  margin-bottom: var(--space-4);
}

.form-field {
  margin-bottom: var(--space-4);  /* 16px */
}

.button-group {
  gap: var(--space-2);  /* 8px */
}

/* Mobile responsive spacing */
@media (max-width: 768px) {
  .page-container {
    padding: var(--space-4);  /* 16px on mobile */
  }
  
  .section {
    margin-bottom: var(--space-6);  /* 24px on mobile */
  }
}
```

**Component-specific standards**:
```css
/* Page level */
.page { padding: var(--space-6); }
.page-header { margin-bottom: var(--space-6); }
.page-content { margin-bottom: var(--space-8); }

/* Cards */
.card { padding: var(--space-4); margin-bottom: var(--space-4); }
.card-header { padding: var(--space-4); }
.card-body { padding: var(--space-4); }
.card-footer { padding: var(--space-3) var(--space-4); }

/* Lists */
.list-item { padding: var(--space-3) var(--space-4); }
.list-item + .list-item { margin-top: var(--space-2); }

/* Forms */
.form-group { margin-bottom: var(--space-4); }
.form-label { margin-bottom: var(--space-2); }
.form-help { margin-top: var(--space-1); }
.form-error { margin-top: var(--space-1); }

/* Buttons */
.btn { padding: var(--space-2) var(--space-4); }
.btn-sm { padding: var(--space-1) var(--space-3); }
.btn-lg { padding: var(--space-3) var(--space-6); }

/* Modals/Dialogs */
.modal-header { padding: var(--space-4); }
.modal-body { padding: var(--space-4); }
.modal-footer { padding: var(--space-3) var(--space-4); }

/* Tables */
.table th,
.table td { padding: var(--space-3) var(--space-4); }

/* Navigation */
.nav-item { padding: var(--space-2) var(--space-4); }
.nav-item + .nav-item { margin-left: var(--space-2); }
```

**Implementation rules**:
1. **NEVER use arbitrary spacing values** - only use the defined scale
2. **Use the smallest spacing that works** - don't over-space
3. **Be consistent within component types** - all cards should have same padding
4. **Test on mobile** - ensure spacing works on small screens
5. **Use CSS variables** - makes it easy to adjust globally

**Migration approach**:
1. Define spacing variables in global CSS
2. Create spacing utility classes if using Tailwind
3. Update components one by one
4. Remove all arbitrary padding/margin values
5. Document the spacing system

## 10. Configuration & Constants

### 10.1 Magic Numbers/Strings
**Issue**: Hardcoded values throughout the app
**Solution**: Create configuration files and enums

### 10.2 Currency Configuration
**Issue**: No centralized currency configuration
**Examples**:
- Currency symbol ($) hardcoded everywhere
- No support for Algerian currency format
- Decimal places not configurable

**Solution**: Create currency configuration:
```typescript
export const CURRENCY_CONFIG = {
  code: 'DZD',
  symbol: 'DA',
  symbolPosition: 'after', // 'before' or 'after'
  thousandSeparator: ' ',  // Space for Algerian format
  decimalSeparator: ',',   // Comma for decimals
  decimalPlaces: 2,
  format: '{value} {symbol}' // e.g., "1 500,00 DA"
};
```

### 10.3 Route Constants
**Issue**: Route strings duplicated
**Solution**: Create a routes constant file

## 11. Testing Infrastructure

### 11.1 Missing Test Utilities
**Issue**: No shared testing utilities
**Solution**: Create testing helpers and mocks

## 12. Maintainability Guidelines

### 12.1 Self-Documenting Code
**Issue**: Code requires extensive comments to understand
**Solution**: Write code that explains itself

```typescript
// ❌ Bad - needs comments to understand
function calc(p: number, d: number, t: number): number {
  // p is price, d is discount, t is tax
  return p * (1 - d) * (1 + t);
}

// ✅ Good - self-explanatory
function calculateFinalPrice(
  basePrice: number, 
  discountPercentage: number, 
  taxPercentage: number
): number {
  const discountedPrice = basePrice * (1 - discountPercentage);
  const finalPrice = discountedPrice * (1 + taxPercentage);
  return finalPrice;
}
```

### 12.2 Consistent Naming Conventions
**Issue**: Mixed naming patterns make code hard to follow
**Solution**: Strict naming rules

```typescript
// Services: [Feature]Service
authService, cartService, productService

// Components: [Feature][Type]Component
ProductListComponent, CartSummaryComponent

// Models/Interfaces: I[Name] for interfaces, [Name] for types
interface IProduct { }
type OrderStatus = 'pending' | 'completed';

// Methods: verb + noun
getProducts(), updateCart(), deleteOrder()

// Booleans: is/has/can prefix
isLoading, hasError, canEdit

// Events: on + action
onProductClick, onFormSubmit
```

### 12.3 Predictable File Structure
**Issue**: Files scattered without clear organization
**Solution**: Consistent folder structure

```
src/app/
├── core/               # Singleton services, guards, interceptors
│   ├── services/      
│   ├── guards/        
│   └── interceptors/  
├── shared/            # Reusable components, pipes, directives
│   ├── components/    
│   ├── pipes/        
│   └── utils/        
├── features/          # Feature modules
│   ├── products/     
│   ├── cart/         
│   └── admin/        
└── models/           # All interfaces and types
```

### 12.4 Error Messages That Help
**Issue**: Generic error messages that don't help debugging
**Solution**: Descriptive errors with context

```typescript
// ❌ Bad
throw new Error('Invalid data');

// ✅ Good
throw new Error(`Product ID ${productId} not found in cart for user ${userId}`);
```

### 12.5 Consistent Data Flow
**Issue**: Data flows in unpredictable ways
**Solution**: One-way data flow pattern

```typescript
// Data flows: Service → Component → Template
// Updates flow: Template → Component → Service

// ✅ Good - predictable flow
class ProductComponent {
  products = this.productService.products; // Read from service
  
  updateProduct(id: number, data: Product) {
    this.productService.update(id, data); // Update through service
  }
}
```

### 12.6 Configuration Over Code
**Issue**: Hardcoded values throughout the codebase
**Solution**: Centralized configuration

```typescript
// config/app.config.ts
export const APP_CONFIG = {
  api: {
    timeout: 30000,
    retryAttempts: 3,
    baseUrl: environment.apiUrl
  },
  pagination: {
    defaultPageSize: 20,
    pageSizeOptions: [10, 20, 50]
  },
  validation: {
    minPasswordLength: 8,
    maxFileSize: 5 * 1024 * 1024 // 5MB
  }
};

// Usage
const pageSize = APP_CONFIG.pagination.defaultPageSize;
```

### 12.7 Fail-Safe Defaults
**Issue**: Code breaks when optional data is missing
**Solution**: Always provide safe defaults

```typescript
// ❌ Bad - will break if translations missing
getProductName(product: Product): string {
  return product.translations[this.currentLang];
}

// ✅ Good - safe fallbacks
getProductName(product: Product): string {
  return product.translations?.[this.currentLang] 
    || product.translations?.['en'] 
    || product.name 
    || 'Unnamed Product';
}
```

### 12.8 Avoid Magic Strings/Numbers
**Issue**: Unexplained values scattered in code
**Solution**: Named constants with clear purpose

```typescript
// ❌ Bad
if (user.role === 2) { }
setTimeout(() => {}, 3000);

// ✅ Good
enum UserRole {
  CUSTOMER = 1,
  ADMIN = 2,
  STAFF = 3
}

const TOAST_DURATION_MS = 3000;

if (user.role === UserRole.ADMIN) { }
setTimeout(() => {}, TOAST_DURATION_MS);
```

### 12.9 Modular Code
**Issue**: Large files with multiple responsibilities
**Solution**: Small, focused modules

```typescript
// ❌ Bad - 500+ line component doing everything

// ✅ Good - split into logical pieces
ProductListComponent (handles display)
ProductService (handles data)
ProductFilterPipe (handles filtering)
ProductValidator (handles validation)
```

### 12.10 Easy Testing
**Issue**: Code is hard to test due to tight coupling
**Solution**: Design for testability

```typescript
// ❌ Bad - hard to test
class ProductComponent {
  constructor() {
    this.http.get('/api/products').subscribe(data => {
      this.products = data;
      localStorage.setItem('products', JSON.stringify(data));
    });
  }
}

// ✅ Good - easy to test
class ProductComponent {
  private productService = inject(ProductService);
  products = this.productService.getProducts();
}
```

## Priority Order for Implementation

1. **High Priority** (Core functionality, high impact):
   - CurrencyService with Algerian Dinar support (using signals)
   - DateUtilityService
   - TranslationHelperService
   - UnitsService (for extensible unit management)
   - FormValidationService
   - API Response Types
   - Role checking centralization

2. **Medium Priority** (Improves maintainability):
   - Shared components (Loading, Error, Empty states)
   - Consistent error handling
   - Import organization
   - CSS improvements

3. **Low Priority** (Nice to have):
   - Performance optimizations
   - Additional utility services
   - Testing infrastructure

## Code Principles to Follow

1. **Dependency Injection**: Always use `inject()` function, not constructor injection
   ```typescript
   // ✅ Good
   private authService = inject(AuthService);
   
   // ❌ Bad
   constructor(private authService: AuthService) {}
   ```

2. **Service Functions**: Any function used more than once MUST be in a service
   ```typescript
   // ✅ Good - in DateService
   formatDate(date: string): string { ... }
   
   // ❌ Bad - duplicated in components
   formatDate(date: string): string { ... }
   ```

3. **Component Responsibility**: Components should ONLY handle:
   - Template logic
   - User interactions
   - Calling services
   - NO business logic or data transformation

4. **Signals Over Observables**: Prefer signals for state management
5. **Type Everything**: No `any` types allowed
6. **DRY Principle**: Zero tolerance for code duplication

7. **CSS Best Practices**:
   - **NO external CSS files** unless absolutely necessary (10+ unique rules)
   - Use global utility classes for common patterns
   - Use Tailwind classes as primary styling method
   - Create global classes for repeated patterns
   - External CSS only for complex animations or third-party overrides
   
   ```typescript
   // ✅ Good - no external CSS
   @Component({
     template: `<div class="card-shadow content-spacing">...</div>`
   })
   
   // ❌ Bad - external CSS for simple styles
   @Component({
     styleUrl: './component.css' // Contains only 2-3 rules
   })
   ```

8. **Keep Code Simple**:
   - **Avoid over-engineering** - use the simplest solution that works
   - **No unnecessary abstractions** - don't create layers just for potential future use
   - **Clear over clever** - readable code is better than "smart" code
   - **One function, one purpose** - each function should do one thing well
   - **Avoid deep nesting** - max 3 levels of nesting
   - **Short functions** - if it's more than 20 lines, consider breaking it down
   
   ```typescript
   // ✅ Good - simple and clear
   getProductPrice(product: Product): number {
     return product.price * (1 - product.discount);
   }
   
   // ❌ Bad - over-engineered
   class PriceCalculatorFactory {
     createCalculator(): IPriceCalculator {
       return new DiscountedPriceCalculator(
         new BasePriceStrategy(),
         new PercentageDiscountStrategy()
       );
     }
   }
   ```

## Estimated Impact

- **Code Reduction**: ~30-40% less code duplication
- **Maintainability**: Significantly improved
- **Type Safety**: Near 100% type coverage
- **Performance**: 10-20% improvement in bundle size and runtime

## Next Steps

1. Review and approve this audit
2. Create shared services and utilities
3. Refactor components to use shared code
4. Update documentation
5. Add linting rules to maintain standards