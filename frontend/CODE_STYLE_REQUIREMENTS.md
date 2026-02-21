# Code Style Requirements

## Overview
This document defines the coding standards and requirements for maintaining clean, DRY, and maintainable code in the Angular frontend.

---

## 0. App Layout Architecture

### 0.1 Native App Feel
The app should feel like a native mobile/desktop application, not a traditional website.

### 0.2 Layout Structure

**Mobile Layout:**
```
┌─────────────────────────┐
│   Page Top Bar          │  ← Back arrow, page title (per-page)
│   (within page)         │
├─────────────────────────┤
│                         │
│                         │
│   Page Content          │  ← Scrollable content area
│   (100vh - bottom nav)  │
│                         │
│                         │
├─────────────────────────┤
│   Bottom Navigation     │  ← Fixed bottom nav
└─────────────────────────┘
```

**Desktop Layout:**
```
┌──────────┬──────────────────────────┐
│          │   Page Top Bar           │  ← Back arrow, page title (per-page)
│          ├──────────────────────────┤
│  Sidebar │                          │
│   Nav    │   Page Content           │  ← Scrollable content area
│          │   (100vh)                │
│          │                          │
│          │                          │
└──────────┴──────────────────────────┘
```

### 0.3 Key Layout Rules

1. **No Global Header** - Remove the traditional header component
2. **Sidebar on Desktop** - Side navigation for desktop screens
3. **Bottom Nav on Mobile** - Keep existing bottom navigation
4. **Fixed Viewport Height** - All pages use `100vh` minus navigation height
5. **Per-Page Top Bar** - Each page/screen has its own top bar area for:
   - Back arrow (when applicable)
   - Page title
   - Page-specific actions

### 0.4 Content Area Sizing

```scss
// Mobile - subtract bottom nav height
.page-container {
  height: calc(100vh - var(--bottom-nav-height));
  overflow-y: auto;
}

// Desktop - full height (sidebar is beside, not above)
@media (min-width: 768px) {
  .page-container {
    height: 100vh;
  }
}
```

### 0.5 Page Top Bar Component
Each page should include a top bar section:

```html
<!-- Per-page top bar -->
<div class="page-top-bar">
  @if (showBackButton) {
    <app-back-button />
  }
  <h1 class="page-title">{{ pageTitle }}</h1>
  <div class="page-actions">
    <!-- Page-specific actions -->
  </div>
</div>

<div class="page-content">
  <!-- Scrollable content -->
</div>
```

### 0.6 Scroll Behavior
- **Page container**: Fixed height, no body scroll
- **Page content**: Internal scrolling within fixed container
- **No scroll conflicts**: Each page manages its own scroll
- **Native feel**: Smooth, contained scrolling like native apps

### 0.7 CSS Variables for Layout

```scss
:root {
  --bottom-nav-height: 64px;
  --sidebar-width: 250px;
  --page-top-bar-height: 56px;
}
```

### 0.8 Page Transitions
Native-feel animations between pages:

```typescript
// Route animations
const slideInAnimation = trigger('routeAnimations', [
  transition('* <=> *', [
    style({ opacity: 0, transform: 'translateX(20px)' }),
    animate('200ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
  ])
]);
```

- **Forward navigation**: Slide in from right
- **Back navigation**: Slide in from left
- **Modal pages**: Slide up from bottom
- **Keep animations subtle**: 150-250ms duration

### 0.9 Pull-to-Refresh
For list pages (products, orders, etc.):

```html
<div class="pull-to-refresh-container" (touchstart)="onTouchStart($event)" (touchmove)="onTouchMove($event)">
  @if (isPulling()) {
    <div class="refresh-indicator">
      <i class="pi pi-spin pi-spinner"></i>
    </div>
  }
  <!-- List content -->
</div>
```

- Enable on: Product list, Order list, Cart, Home
- Visual indicator when pulling
- Haptic feedback on mobile (if available)

### 0.10 Swipe Gestures
Mobile swipe-to-go-back:

```typescript
// Swipe from left edge to go back
@HostListener('touchstart', ['$event'])
@HostListener('touchmove', ['$event'])
@HostListener('touchend', ['$event'])
handleSwipe(event: TouchEvent) {
  // Detect left-edge swipe and navigate back
}
```

- Swipe from left edge (first 20px) to go back
- Visual feedback during swipe
- Cancel if swipe distance < 100px

### 0.11 Skeleton Loaders (IMPORTANT)

**ALWAYS use skeleton loaders instead of spinners.** Skeletons provide better UX by showing the layout structure while loading.

#### Why Skeletons > Spinners
- Shows expected content structure
- Reduces perceived loading time
- Prevents layout shift when content loads
- More native app feel

#### Base Skeleton CSS

```scss
// Global skeleton styles
.skeleton {
  background: linear-gradient(
    90deg,
    var(--surface-ground) 25%,
    var(--surface-hover) 50%,
    var(--surface-ground) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 4px;
}

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

// Skeleton shapes
.skeleton-text {
  height: 1rem;
  width: 100%;

  &.short { width: 60%; }
  &.shorter { width: 40%; }
  &.tiny { width: 20%; }
}

.skeleton-title {
  height: 1.5rem;
  width: 70%;
}

.skeleton-image {
  aspect-ratio: 1;
  width: 100%;
}

.skeleton-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}

.skeleton-button {
  height: 40px;
  width: 120px;
  border-radius: 6px;
}

.skeleton-badge {
  height: 24px;
  width: 60px;
  border-radius: 12px;
}
```

#### Product Card Skeleton

```html
<!-- product-card-skeleton.component.html -->
<div class="product-card-skeleton">
  <div class="skeleton skeleton-image"></div>
  <div class="skeleton-content">
    <div class="skeleton skeleton-text short"></div>
    <div class="skeleton skeleton-title"></div>
    <div class="skeleton skeleton-text shorter"></div>
    <div class="skeleton-row">
      <div class="skeleton skeleton-text tiny"></div>
      <div class="skeleton skeleton-button"></div>
    </div>
  </div>
</div>
```

```scss
.product-card-skeleton {
  background: var(--surface-card);
  border-radius: 8px;
  overflow: hidden;

  .skeleton-content {
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .skeleton-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: var(--space-2);
  }
}
```

#### Product List Skeleton

```html
<!-- Use in product-list.component.html -->
@if (loading()) {
  <div class="product-grid">
    @for (i of [1,2,3,4,5,6]; track i) {
      <app-product-card-skeleton />
    }
  </div>
} @else {
  <div class="product-grid">
    @for (product of products(); track product.id) {
      <app-product-card [product]="product" />
    } @empty {
      <app-empty-state />
    }
  </div>
}
```

#### Order Card Skeleton

```html
<div class="order-card-skeleton">
  <div class="order-header">
    <div class="skeleton skeleton-text shorter"></div>
    <div class="skeleton skeleton-badge"></div>
  </div>
  <div class="order-items">
    @for (i of [1,2]; track i) {
      <div class="order-item">
        <div class="skeleton skeleton-avatar"></div>
        <div class="order-item-details">
          <div class="skeleton skeleton-text short"></div>
          <div class="skeleton skeleton-text tiny"></div>
        </div>
      </div>
    }
  </div>
  <div class="order-footer">
    <div class="skeleton skeleton-text shorter"></div>
    <div class="skeleton skeleton-text tiny"></div>
  </div>
</div>
```

#### Table Skeleton

```html
<p-table [value]="[1,2,3,4,5]">
  <ng-template pTemplate="header">
    <tr>
      <th>Name</th>
      <th>Category</th>
      <th>Price</th>
      <th>Status</th>
      <th>Actions</th>
    </tr>
  </ng-template>
  <ng-template pTemplate="body">
    <tr>
      <td><div class="skeleton skeleton-text"></div></td>
      <td><div class="skeleton skeleton-text short"></div></td>
      <td><div class="skeleton skeleton-text tiny"></div></td>
      <td><div class="skeleton skeleton-badge"></div></td>
      <td><div class="skeleton skeleton-button"></div></td>
    </tr>
  </ng-template>
</p-table>
```

#### Profile/Account Skeleton

```html
<div class="profile-skeleton">
  <div class="profile-header">
    <div class="skeleton skeleton-avatar" style="width: 80px; height: 80px;"></div>
    <div class="profile-info">
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-text short"></div>
    </div>
  </div>
  <div class="profile-details">
    @for (i of [1,2,3,4]; track i) {
      <div class="detail-row">
        <div class="skeleton skeleton-text tiny"></div>
        <div class="skeleton skeleton-text short"></div>
      </div>
    }
  </div>
</div>
```

#### Cart Skeleton

```html
<div class="cart-skeleton">
  @for (i of [1,2,3]; track i) {
    <div class="cart-item-skeleton">
      <div class="skeleton skeleton-image" style="width: 80px; height: 80px;"></div>
      <div class="cart-item-details">
        <div class="skeleton skeleton-text short"></div>
        <div class="skeleton skeleton-text tiny"></div>
        <div class="skeleton-row">
          <div class="skeleton skeleton-button" style="width: 100px;"></div>
          <div class="skeleton skeleton-text tiny"></div>
        </div>
      </div>
    </div>
  }
  <div class="cart-summary-skeleton">
    <div class="skeleton skeleton-text short"></div>
    <div class="skeleton skeleton-title"></div>
    <div class="skeleton skeleton-button" style="width: 100%;"></div>
  </div>
</div>
```

#### Dashboard Stats Skeleton

```html
<div class="stats-grid">
  @for (i of [1,2,3,4]; track i) {
    <div class="stat-card-skeleton">
      <div class="skeleton skeleton-text tiny"></div>
      <div class="skeleton skeleton-title" style="width: 50%;"></div>
      <div class="skeleton skeleton-text shorter"></div>
    </div>
  }
</div>
```

#### Form Skeleton

```html
<div class="form-skeleton">
  @for (i of [1,2,3,4]; track i) {
    <div class="form-field-skeleton">
      <div class="skeleton skeleton-text tiny"></div>
      <div class="skeleton" style="height: 42px; width: 100%;"></div>
    </div>
  }
  <div class="skeleton skeleton-button" style="width: 100%; margin-top: var(--space-4);"></div>
</div>
```

#### Skeleton Components to Create

| Component | Used In |
|-----------|---------|
| `ProductCardSkeletonComponent` | Product list, Home, Search results |
| `OrderCardSkeletonComponent` | Order list, Order history |
| `CartItemSkeletonComponent` | Cart page |
| `TableRowSkeletonComponent` | Admin tables |
| `ProfileSkeletonComponent` | Account page |
| `StatCardSkeletonComponent` | Admin dashboard |
| `FormSkeletonComponent` | Edit pages |

#### Usage Pattern

```typescript
// In component
loading = signal(true);
products = signal<Product[]>([]);

loadProducts() {
  this.loading.set(true);
  this.productService.getProducts().subscribe({
    next: (data) => {
      this.products.set(data);
      this.loading.set(false);
    },
    error: () => {
      this.loading.set(false);
      // Show error state
    }
  });
}
```

```html
<!-- In template - ALWAYS show skeleton while loading -->
@if (loading()) {
  <app-product-list-skeleton />
} @else if (error()) {
  <app-error-state (retry)="loadProducts()" />
} @else if (products().length === 0) {
  <app-empty-state />
} @else {
  @for (product of products(); track product.id) {
    <app-product-card [product]="product" />
  }
}
```

#### Rules
1. **NEVER use spinners** for content that has a known structure
2. **Match the skeleton** to the actual content layout exactly
3. **Same count**: Show same number of skeleton items as will likely load
4. **Smooth transition**: No jarring jump when content loads
5. **Minimum display time**: Show skeleton for at least 300ms to avoid flicker

### 0.12 Image Handling

```html
<img
  [src]="product.image_url"
  [alt]="product.name"
  loading="lazy"
  (error)="onImageError($event)"
  class="product-image"
/>
```

#### Lazy Loading (REQUIRED)

**ALWAYS add `loading="lazy"` to images that are not immediately visible** (below the fold). This improves page load performance by deferring image loading until the user scrolls near them.

```html
<!-- BAD - loads all images immediately -->
<img [src]="item.image_url" [alt]="item.name">

<!-- GOOD - loads images only when needed -->
<img [src]="item.image_url" [alt]="item.name" loading="lazy">
```

**When to use `loading="lazy"`:**
| Use Case | Lazy Load? |
|----------|------------|
| Product list grid images | ✓ Yes |
| Order item images in lists | ✓ Yes |
| Cart item thumbnails | ✓ Yes |
| Images in scrollable containers | ✓ Yes |
| Hero/banner images (above fold) | ✗ No |
| Single product detail image | ✗ No (main content) |

**Benefits:**
- Faster initial page load
- Reduced bandwidth usage
- Better performance on mobile/slow connections

#### Error Handling (REQUIRED)

**ALWAYS add error fallback for images.** If an image URL fails to load, show a placeholder instead of a broken image icon.

```typescript
// In component
onImageError(event: Event): void {
  const img = event.target as HTMLImageElement;
  img.src = 'assets/images/product-placeholder.jpg';
}
```

```html
<!-- In template -->
<img
  [src]="product.image_url"
  [alt]="product.name"
  (error)="onImageError($event)">
```

#### Other Rules:
- **Placeholder**: Show placeholder color while loading (`background: var(--surface-ground)`)
- **Aspect ratio**: Maintain consistent aspect ratios to prevent layout shift
- **Alt text**: Always provide meaningful alt text for accessibility
- **WebP format**: Prefer WebP with fallback for better compression
- **Responsive**: Use appropriate sizes for viewport

```scss
.product-image {
  aspect-ratio: 1;
  object-fit: cover;
  background: var(--surface-ground); // Placeholder color while loading
}
```

### 0.13 Empty States
Consistent empty state pattern:

```html
<app-empty-state
  icon="pi pi-inbox"
  [title]="'No products found' | translate"
  [message]="'Try adjusting your filters' | translate"
  [actionLabel]="'Clear filters' | translate"
  (action)="clearFilters()"
/>
```

Required for:
- Product list (no results)
- Cart (empty)
- Orders (no orders)
- Search results (no matches)
- Favorites (none saved)

### 0.14 Error States
Consistent error handling pattern:

```html
<app-error-state
  [title]="'Failed to load products' | translate"
  [message]="'Check your connection and try again' | translate"
  [retryLabel]="'Retry' | translate"
  (retry)="loadProducts()"
/>
```

Error types:
- **Network error**: "No internet connection"
- **Server error**: "Something went wrong"
- **Not found**: "Page not found"
- **Permission denied**: "Access denied"

### 0.15 Offline Support (PWA)

```typescript
// Check online status
isOnline = signal(navigator.onLine);

constructor() {
  window.addEventListener('online', () => this.isOnline.set(true));
  window.addEventListener('offline', () => this.isOnline.set(false));
}
```

Offline features:
- Cache product catalog for offline browsing
- Queue cart actions when offline
- Show offline indicator banner
- Sync when back online

### 0.16 Safe Areas (iOS)

```scss
// Handle iPhone notch and home indicator
.page-container {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}

.bottom-navigation {
  padding-bottom: env(safe-area-inset-bottom);
}

.page-top-bar {
  padding-top: env(safe-area-inset-top);
}
```

### 0.17 RTL Support (Arabic)

```scss
// Use logical properties for RTL
.element {
  // BAD
  margin-left: 1rem;
  padding-right: 1rem;
  text-align: left;

  // GOOD
  margin-inline-start: 1rem;
  padding-inline-end: 1rem;
  text-align: start;
}

// RTL-aware flexbox
.flex-row {
  display: flex;
  flex-direction: row; // Automatically flips in RTL
}

// Icons that need flipping
[dir="rtl"] .icon-arrow-right {
  transform: scaleX(-1);
}
```

Rules:
- Use `start`/`end` instead of `left`/`right`
- Use logical properties (`margin-inline-start`, `padding-inline-end`)
- Flip directional icons (arrows, chevrons)
- Test all pages in Arabic

### 0.18 Keyboard Navigation & Accessibility

```html
<!-- Focusable elements -->
<button (click)="action()" (keydown.enter)="action()">
  <span class="sr-only">{{ accessibleLabel }}</span>
</button>

<!-- Focus trap in modals -->
<div cdkTrapFocus [cdkTrapFocusAutoCapture]="true">
  <!-- Modal content -->
</div>
```

Rules:
- All interactive elements must be keyboard accessible
- Visible focus indicators
- Skip links for main content
- ARIA labels on icon-only buttons
- Focus trap in modals/dialogs
- Announce dynamic content changes

### 0.19 Lazy Loading Routes

```typescript
// app.routes.ts
export const routes: Routes = [
  {
    path: 'admin',
    loadChildren: () => import('./pages/admin/admin.routes').then(m => m.ADMIN_ROUTES)
  },
  {
    path: 'products',
    loadComponent: () => import('./pages/products/product-list/product-list.component')
      .then(m => m.ProductListComponent)
  }
];
```

Rules:
- Lazy load all admin pages
- Lazy load feature modules
- Preload strategy for likely next pages
- Keep initial bundle small

### 0.20 Image Optimization

```html
<!-- Responsive images -->
<img
  srcset="image-400.webp 400w, image-800.webp 800w, image-1200.webp 1200w"
  sizes="(max-width: 600px) 400px, (max-width: 1200px) 800px, 1200px"
  src="image-800.webp"
  alt="Product"
  loading="lazy"
/>
```

Rules:
- Use WebP format with JPEG fallback
- Multiple sizes for responsive
- Lazy load below-fold images
- Compress images (max 100KB for thumbnails)
- Use CDN for images in production

### 0.21 Form Layout Standards

```html
<form class="form-container">
  <div class="form-section">
    <h3 class="form-section-title">Personal Information</h3>

    <div class="form-field">
      <label for="name" class="form-label">Name</label>
      <input id="name" pInputText [(ngModel)]="name" />
      @if (nameInvalid()) {
        <small class="form-error">Name is required</small>
      }
    </div>
  </div>

  <div class="form-actions">
    <button pButton type="button" label="Cancel" class="p-button-text"></button>
    <button pButton type="submit" label="Save"></button>
  </div>
</form>
```

```scss
.form-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-label {
  font-weight: 500;
  color: var(--text-secondary);
}

.form-error {
  color: var(--color-error);
  font-size: 0.875rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-primary);
}
```

### 0.22 Validation Timing

```typescript
// Show errors on blur, not on every keystroke
<input
  pInputText
  [(ngModel)]="email"
  (blur)="validateEmail()"
  [class.ng-invalid]="emailTouched() && emailInvalid()"
/>
```

Rules:
- **On blur**: Show error after user leaves field
- **On submit**: Validate all and show all errors
- **On fix**: Clear error as soon as valid
- **Required fields**: Mark with asterisk (*)
- **Real-time**: Only for password strength indicator

### 0.23 Cart Badge

```html
<!-- Always visible in bottom nav / sidebar -->
<div class="cart-icon-wrapper">
  <i class="pi pi-shopping-cart"></i>
  @if (cartCount() > 0) {
    <span class="cart-badge">{{ cartCount() }}</span>
  }
</div>
```

```scss
.cart-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  background: var(--color-error);
  color: white;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

Rules:
- Always visible in navigation (bottom nav + sidebar)
- Show count badge when items > 0
- Animate badge on add to cart
- Update in real-time

### 0.24 Search Behavior

```html
<!-- Global search in top bar -->
<div class="search-container">
  <i class="pi pi-search search-icon"></i>
  <input
    pInputText
    [(ngModel)]="searchTerm"
    (ngModelChange)="onSearch($event)"
    [placeholder]="'Search products...' | translate"
    class="search-input"
  />
  @if (searchTerm()) {
    <button class="search-clear" (click)="clearSearch()">
      <i class="pi pi-times"></i>
    </button>
  }
</div>
```

Search behavior:
- **Global search**: Available in sidebar/bottom nav area
- **Debounced**: 300ms debounce on input
- **Instant clear**: X button to clear
- **Recent searches**: Show last 5 searches
- **Search suggestions**: Show as user types
- **Results page**: Navigate to /products?search=term

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

**Image Handling:**
- [ ] Images in lists/grids use `loading="lazy"`
- [ ] Images have `(error)` handler for fallback
- [ ] Images have meaningful `[alt]` text

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
