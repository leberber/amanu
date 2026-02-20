# Code Style Requirements

## Overview
This document defines the coding standards and requirements for maintaining clean, DRY, and maintainable code in the Angular frontend.

---

## 1. TypeScript Requirements

### 1.1 No Hardcoded Values
- **Routes**: Use `ROUTES` constant from `core/constants/routes.constants.ts`
- **Storage Keys**: Use `STORAGE_KEYS` from `core/constants/app.constants.ts`
- **User Roles**: Use `USER_ROLES` from `core/constants/app.constants.ts`
- **Validation Rules**: Use `VALIDATION` from `core/constants/app.constants.ts`
- **Animation Timings**: Use `ANIMATION` or `UI_DELAY` from `core/constants/app.constants.ts`

```typescript
// BAD
router.navigate(['/login']);
localStorage.getItem('auth_token');

// GOOD
router.navigate([ROUTES.LOGIN]);
localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
```

### 1.2 Dependency Injection
- Always use `inject()` function, NOT constructor injection

```typescript
// BAD
constructor(private authService: AuthService) {}

// GOOD
private authService = inject(AuthService);
```

### 1.3 Subscription Management
- Use `takeUntilDestroyed()` for all subscriptions
- Import `DestroyRef` from `@angular/core`

```typescript
// BAD
private subscription: Subscription;
ngOnDestroy() { this.subscription.unsubscribe(); }

// GOOD
private destroyRef = inject(DestroyRef);
this.service.data$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
```

### 1.4 No Wrapper Methods
- Don't create wrapper methods that just call a service
- Use services directly or pipes in templates

```typescript
// BAD - Redundant wrapper
formatDate(date: string): string {
  return this.dateService.formatDate(date);
}

// GOOD - Use pipe in template
{{ date | dateFormat }}

// GOOD - Call service directly in template
{{ dateService.formatDate(date) }}
```

### 1.5 No Unused Imports
- Remove all unused imports
- Group imports in order:
  1. Angular core
  2. Third-party (RxJS, PrimeNG, ngx-translate)
  3. Services
  4. Models/Interfaces
  5. Components

### 1.6 No Console Statements
- Remove all `console.log` statements
- Replace `console.error` with proper error handling via `ToastMessageService`

### 1.7 Type Safety
- No `any` types - create proper interfaces
- Use strict null checks

---

## 2. Modern Angular Features (Angular 17+)

### 2.1 Signals
Use Angular Signals for reactive state management instead of plain properties.

```typescript
// BAD - Plain properties
loading = false;
products: Product[] = [];

// GOOD - Signals
loading = signal(false);
products = signal<Product[]>([]);

// Reading signals in TypeScript
if (this.loading()) { }
const items = this.products();

// Updating signals
this.loading.set(true);
this.products.set(newProducts);
this.products.update(current => [...current, newProduct]);
```

### 2.2 Computed Signals
Use `computed()` for derived state instead of getters or manual calculations.

```typescript
// BAD - Manual getter
get totalPrice(): number {
  return this.items.reduce((sum, item) => sum + item.price, 0);
}

// GOOD - Computed signal
items = signal<CartItem[]>([]);
totalPrice = computed(() =>
  this.items().reduce((sum, item) => sum + item.price, 0)
);

// In template
{{ totalPrice() }}
```

### 2.3 Effect for Side Effects
Use `effect()` for side effects that react to signal changes.

```typescript
// GOOD - Effect for side effects
constructor() {
  effect(() => {
    // Runs whenever language() changes
    const lang = this.translationService.language();
    this.loadTranslatedData(lang);
  });
}
```

### 2.4 New Control Flow Syntax
Use new `@if`, `@for`, `@switch` instead of `*ngIf`, `*ngFor`, `ngSwitch`.

```html
<!-- BAD - Old syntax -->
<div *ngIf="loading">Loading...</div>
<div *ngIf="!loading && data">{{ data }}</div>
<div *ngFor="let item of items; trackBy: trackById">{{ item.name }}</div>

<!-- GOOD - New control flow -->
@if (loading()) {
  <div>Loading...</div>
} @else if (data()) {
  <div>{{ data() }}</div>
}

@for (item of items(); track item.id) {
  <div>{{ item.name }}</div>
} @empty {
  <div>No items found</div>
}

@switch (status()) {
  @case ('pending') { <span>Pending</span> }
  @case ('completed') { <span>Done</span> }
  @default { <span>Unknown</span> }
}
```

### 2.5 Signal Inputs (Angular 17.1+)
Use signal-based inputs for component inputs.

```typescript
// BAD - Decorator inputs
@Input() productId!: number;
@Input() showDetails = false;

// GOOD - Signal inputs
productId = input.required<number>();
showDetails = input(false);  // with default value
optionalValue = input<string>();  // optional

// Reading in component
const id = this.productId();
```

### 2.6 Model Inputs (Two-way binding with signals)
Use `model()` for two-way binding with signals.

```typescript
// BAD - Manual two-way binding
@Input() value!: string;
@Output() valueChange = new EventEmitter<string>();

// GOOD - Model input
value = model<string>('');
value = model.required<string>();

// In parent template
<app-input [(value)]="myValue" />
```

### 2.7 Output Function
Use `output()` function instead of `@Output()` decorator.

```typescript
// BAD - Decorator output
@Output() save = new EventEmitter<Product>();

// GOOD - Output function
save = output<Product>();

// Emitting
this.save.emit(product);
```

### 2.8 Standalone Components
All components should be standalone (no NgModules).

```typescript
@Component({
  selector: 'app-example',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule],
  template: `...`
})
export class ExampleComponent { }
```

### 2.9 When to Use Signals vs Observables

| Use Signals | Use Observables |
|-------------|-----------------|
| Component local state | HTTP requests |
| UI state (loading, visible) | WebSocket streams |
| Form values | Complex async operations |
| Derived/computed values | Multiple subscribers |
| Parent-child communication | Service-to-component streams |

```typescript
// Signals - Local state
loading = signal(false);
selectedItem = signal<Item | null>(null);
isValid = computed(() => this.form().valid);

// Observables - Async operations
products$ = this.productService.getProducts();
user$ = this.authService.currentUser$;
```

### 2.10 Converting Observables to Signals
Use `toSignal()` to convert observables to signals.

```typescript
import { toSignal } from '@angular/core/rxjs-interop';

// Convert observable to signal
private userService = inject(UserService);
currentUser = toSignal(this.userService.currentUser$);

// With initial value
products = toSignal(this.productService.products$, { initialValue: [] });
```

---

## 3. PrimeNG Best Practices (v17+)

### 3.1 Use New Component Names
PrimeNG v17+ renamed some components.

```typescript
// BAD - Old names
import { DropdownModule } from 'primeng/dropdown';

// GOOD - New names
import { SelectModule } from 'primeng/select';
```

### 3.2 PrimeNG Component Mapping
| Old Name | New Name |
|----------|----------|
| p-dropdown | p-select |
| p-multiSelect | p-multiselect |
| p-inputSwitch | p-toggleswitch |
| p-calendar | p-datepicker |
| p-chips | p-inputchips |
| p-listbox | p-listbox (same) |

### 3.3 Use PrimeNG Severity Types
Use proper severity types for consistent styling.

```typescript
// Type-safe severity
type Severity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

// In component
getSeverity(status: string): Severity {
  return this.statusSeverityService.getOrderStatusSeverity(status);
}
```

### 3.4 PrimeNG Table Best Practices
```html
<!-- Use lazy loading for large datasets -->
<p-table
  [value]="products()"
  [lazy]="true"
  [paginator]="true"
  [rows]="10"
  [totalRecords]="totalRecords()"
  (onLazyLoad)="loadProducts($event)">

  <!-- Use ng-template with new syntax -->
  <ng-template pTemplate="header">
    <tr>
      <th pSortableColumn="name">Name <p-sortIcon field="name" /></th>
    </tr>
  </ng-template>

  <ng-template pTemplate="body" let-product>
    <tr>
      <td>{{ product.name }}</td>
    </tr>
  </ng-template>

  <ng-template pTemplate="emptymessage">
    <tr>
      <td colspan="100%">
        <app-empty-state message="No products found" />
      </td>
    </tr>
  </ng-template>
</p-table>
```

### 3.5 PrimeNG Form Components with Signals
```typescript
// Form with signals
selectedCategory = signal<Category | null>(null);
searchTerm = signal('');

// In template
<p-select
  [options]="categories()"
  [(ngModel)]="selectedCategory"
  optionLabel="name"
  placeholder="Select category" />

<input
  pInputText
  [ngModel]="searchTerm()"
  (ngModelChange)="searchTerm.set($event)" />
```

### 3.6 PrimeNG Toast with Service
```typescript
// Use ToastMessageService (already exists)
private toast = inject(ToastMessageService);

// Success
this.toast.showSuccess('product.saved');

// Error with API handling
this.toast.showApiError(error, 'product.save_failed');
```

### 3.7 PrimeNG Confirmation Dialog
```typescript
private confirmationService = inject(ConfirmationService);

confirmDelete(item: Product) {
  this.confirmationService.confirm({
    message: 'Are you sure you want to delete this product?',
    header: 'Confirm Delete',
    icon: 'pi pi-exclamation-triangle',
    acceptButtonStyleClass: 'p-button-danger',
    accept: () => this.deleteProduct(item.id)
  });
}
```

---

## 4. CSS/SCSS Requirements

### 2.1 Minimize Component CSS
- **Prefer global utility classes** over component-specific CSS
- External CSS files only when:
  - Component has 10+ unique CSS rules
  - Complex animations needed
  - Third-party library overrides

### 2.2 Use Tailwind Classes
- Use Tailwind for spacing, typography, colors
- Common patterns:
  - `p-4` instead of `padding: 1rem`
  - `mb-4` instead of `margin-bottom: 1rem`
  - `flex items-center` instead of `display: flex; align-items: center`

### 2.3 Use CSS Variables
- Use theme CSS variables for colors
- Never hardcode hex colors in components

```scss
// BAD
color: #0F3C82;
background: #ffffff;

// GOOD
color: var(--primary-color);
background: var(--surface-ground);
```

### 2.4 Global Utility Classes
Use these global classes (defined in `styles/utilities.css`):

```scss
// Layout
.flex-center      // display: flex; align-items: center; justify-content: center
.flex-between     // display: flex; justify-content: space-between
.grid-responsive  // responsive grid layout

// Spacing (using Tailwind scale)
.p-page          // page padding
.mb-section      // section margin bottom

// Typography
.text-page-title
.text-section-title
.text-muted

// States
.loading-spinner
.empty-state
```

### 2.5 No Inline Styles in TypeScript
- Avoid `element.style.property = value`
- Use CSS classes and toggle with `[class]` binding

```typescript
// BAD
element.style.backgroundColor = '#fff';

// GOOD
[class.active]="isActive"
```

---

## 3. HTML Template Requirements

### 3.1 Use Pipes
- `| dateFormat` for dates
- `| currency` for prices
- `| unit` for units
- `| translate` for i18n

### 3.2 Use Async Pipe
- Prefer async pipe over manual subscriptions in templates

```html
<!-- BAD -->
<div>{{ data }}</div>

<!-- GOOD -->
<div>{{ data$ | async }}</div>
```

### 3.3 Track By Functions
- Always use `trackBy` with `*ngFor`

```html
<div *ngFor="let item of items; trackBy: trackById">
```

---

## 4. DRY Principles

### 4.1 Service Functions
- Any function used in 2+ places MUST be in a service
- Components should only contain view-specific logic

### 4.2 Shared Components
Use existing shared components:
- `<app-loading-state>` for loading spinners
- `<app-empty-state>` for empty lists
- `<app-error-state>` for error displays
- `<app-back-button>` for navigation

### 4.3 No Duplicate Logic
- Stock checks: Use `StockStatusService`
- Status severities: Use `StatusSeverityService`
- Date formatting: Use `DateService` or `dateFormat` pipe
- Unit display: Use `UnitsService` or `unit` pipe

---

## 5. File Organization

### 5.1 Component File Structure
```
component-name/
├── component-name.component.ts
├── component-name.component.html
├── component-name.component.scss  (only if needed)
└── component-name.component.spec.ts (optional)
```

### 5.2 Service Location
- Core services: `core/services/`
- Feature services: `services/`
- Guards: `shared/` or `core/services/`

---

## 8. Checklist Per Component

When reviewing each component, check:

### TypeScript (.ts)
- [ ] No hardcoded routes (use ROUTES constant)
- [ ] No hardcoded storage keys (use STORAGE_KEYS)
- [ ] Uses `inject()` not constructor injection
- [ ] Uses `takeUntilDestroyed()` for subscriptions
- [ ] No wrapper methods that just call services
- [ ] No unused imports
- [ ] No console.log statements
- [ ] No `any` types
- [ ] No duplicate logic (uses services)

**Modern Angular:**
- [ ] Uses `signal()` for component state
- [ ] Uses `computed()` for derived values
- [ ] Uses `input()` / `input.required()` instead of `@Input()`
- [ ] Uses `output()` instead of `@Output()`
- [ ] Uses `model()` for two-way binding where needed
- [ ] Uses `toSignal()` for converting observables
- [ ] Component is standalone

### HTML (.html)
- [ ] Uses pipes for formatting (date, currency, unit)
- [ ] Uses shared components (loading, empty, error states)
- [ ] No inline styles
- [ ] Uses Tailwind/utility classes

**Modern Angular Control Flow:**
- [ ] Uses `@if` instead of `*ngIf`
- [ ] Uses `@for` with `track` instead of `*ngFor` with `trackBy`
- [ ] Uses `@switch` instead of `ngSwitch`
- [ ] Uses `@empty` block for empty lists

### SCSS (.scss)
- [ ] Minimal custom CSS (prefer utility classes)
- [ ] Uses CSS variables for colors
- [ ] No hardcoded colors
- [ ] No duplicate styles (check global styles first)
- [ ] Consider if file can be removed entirely

---

## 7. Constants Reference

### Available Constants
```typescript
// routes.constants.ts
ROUTES.LOGIN, ROUTES.HOME, ROUTES.CART, ROUTES.ADMIN.DASHBOARD, etc.
RouteHelpers.productDetail(id), RouteHelpers.orderDetail(id), etc.

// app.constants.ts
STORAGE_KEYS.AUTH_TOKEN, STORAGE_KEYS.CART, STORAGE_KEYS.LANGUAGE
USER_ROLES.ADMIN, USER_ROLES.STAFF, USER_ROLES.CUSTOMER
VALIDATION.MIN_NAME_LENGTH, VALIDATION.MIN_PASSWORD_LENGTH
ANIMATION.FAST, ANIMATION.NORMAL, ANIMATION.SLOW
UI_DELAY.TOAST_BEFORE_REDIRECT, UI_DELAY.DEBOUNCE_TIME
ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED, etc.
```

### Available Services
```typescript
// Core Services
DateService          // formatDate(), formatDateTime()
UnitsService         // getUnitDisplay(), getUnitTranslated()
StatusSeverityService // getOrderStatusSeverity()
StockStatusService   // isOutOfStock(), isLowStock()
ToastMessageService  // showSuccess(), showError(), showApiError()
CurrencyService      // formatPrice()
```

### Available Pipes
```typescript
dateFormat    // {{ date | dateFormat }}
currency      // {{ price | currency }}
unit          // {{ unit | unit }}
```

---

## 8. Review Process

1. Open component folder
2. Review `.ts` file against TypeScript checklist
3. Review `.html` file against HTML checklist
4. Review `.scss` file against SCSS checklist
5. Mark component as reviewed in COMPONENT_AUDIT.md
6. Note any issues found
7. Make fixes
8. Mark as completed
