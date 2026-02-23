# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Amanu is a multi-language e-commerce platform for fresh produce (fruits and vegetables), branded as "Elsuq". It consists of a FastAPI backend and Angular frontend, deployed on AWS using Docker containers.

## Essential Commands

### Backend Development
```bash
cd backend
uvicorn main:app --reload  # Run the FastAPI server with hot reload
```

### Frontend Development
```bash
cd frontend
npm install    # Install dependencies
npm start      # Start development server on http://localhost:4200
npm run build  # Build for production
```

### Deployment
```bash
./deploy.sh    # Automated deployment to AWS EC2
```

The deployment script:
1. Builds Docker images for frontend and backend
2. Pushes to Docker Hub (yazidkheloufi/amanu-frontend and yazidkheloufi/amanu-backend)
3. SSHs to EC2 instance and updates containers
4. Handles SSL certificates via Let's Encrypt

## Architecture

### Backend (FastAPI)
- **Entry point**: `backend/main.py`
- **Database**: SQLModel ORM with PostgreSQL
- **Authentication**: JWT tokens with role-based access (Customer, Staff, Admin)
- **Key models**: User, Product, Order, Cart, Address
- **API Documentation**: Available at `/docs` when running

### Frontend (Angular)
- **Version**: Angular 20 with standalone components
- **UI Library**: PrimeNG components
- **Styling**: TailwindCSS
- **State Management**: Services with BehaviorSubjects
- **i18n**: @ngx-translate for English, French, and Arabic
- **PWA**: Progressive Web App with service worker

### Key Architectural Patterns

1. **Multi-language Support**: 
   - Products have translations stored in `product_translations` table
   - Frontend uses @ngx-translate with language files in `frontend/src/assets/i18n/`
   - Language preference stored in localStorage

2. **Authentication Flow**:
   - JWT tokens stored in localStorage
   - Auth interceptor adds token to requests
   - Role-based guards protect routes

3. **Shopping Cart**:
   - Server-side cart management for authenticated users
   - Frontend cart service syncs with backend

4. **Image Handling**:
   - Product images stored in `backend/product_images/`
   - Served as static files by FastAPI

## Infrastructure

- **AWS Resources**: EC2 instance, Elastic IP, Security Groups
- **Domain**: elsuq.com with Route 53
- **SSL**: Let's Encrypt certificates auto-renewed
- **Containers**: Docker Compose orchestrates services
- **Proxy**: Nginx handles SSL termination and routing

## Development Tips

1. **API Testing**: Use Swagger UI at `http://localhost:8000/docs`
2. **Frontend Proxy**: Configured to proxy `/api` to backend in development
3. **Environment Variables**: Backend uses `.env` file (not in repo)
4. **Database Migrations**: SQLModel handles schema updates automatically
5. **Date Format**: Always display dates in numeric format: DD/MM/YYYY HH:MM (e.g., 28/7/2025 14:23)

## Project Structure

```
amanu/
├── backend/           # FastAPI application
│   ├── main.py       # Application entry point
│   ├── models.py     # SQLModel database models
│   └── routers/      # API endpoints
├── frontend/         # Angular application
│   ├── src/app/     
│   │   ├── pages/   # Component pages
│   │   └── services/ # Angular services
│   └── src/assets/i18n/ # Translation files
├── infrastructure/   # AWS CDK infrastructure code
├── deploy.sh        # Deployment script
└── docker-compose.yml # Container orchestration
```

## Component Development Guidelines

**When creating or modifying Angular components, follow these rules strictly:**

### 1. Use Global SCSS Classes

Before writing any component-specific styles, check these global files in `frontend/src/styles/`:

| Need | Use Global File |
|------|-----------------|
| Buttons | `_buttons.scss` → `.btn`, `.btn--primary`, `.btn--icon` |
| Badges/Labels | `_badges.scss` → `.badge`, `.badge--success` |
| Cards | `_cards.scss` → `.card`, `.card__header`, `.card__body` |
| Forms/Inputs | `_inputs.scss` → `.form-field`, `.input-group` |
| Tables | `_table.scss` → `.admin-table`, `.table-actions` |
| Progress/Loading | `_progress.scss` → `.progress`, `.spinner`, `.pulse-loader` |
| Steppers/Wizards | `_steppers.scss` → `.stepper-horizontal`, `.step-nav` |
| Avatars | `_avatars.scss` → `.avatar`, `.avatar--lg`, `.avatar-group` |
| Chips/Tags | `_chips.scss` → `.chip`, `.chip-closable`, `.tag` |
| Stats/Metrics | `_stats.scss` → `.stat-card`, `.metric-card`, `.widget` |
| Info Boxes | `_info-boxes.scss` → `.info-box`, `.callout`, `.tip-box` |
| Pricing | `_pricing.scss` → `.price`, `.price-compare`, `.discount-badge` |
| Promotions | `_promotions.scss` → `.promo-badge`, `.promo-code`, `.sale-banner` |
| Switches | `_switches.scss` → `.switch`, `.switch-ios`, `.switch-card` |
| Segments | `_segments.scss` → `.segment-control`, `.segment-pills`, `.view-mode` |
| Toggles | `_toggles.scss` → `.toggle`, `.status-toggle`, `.radio-item` |
| Lists | `_lists.scss` → `.list-group`, `.list-item`, `.action-list` |
| Modals | `_modals.scss` → `.modal`, `.confirm-dialog` |
| Alerts | `_alerts.scss` → `.alert`, `.alert--success`, `.banner-alert` |
| Tabs | `_tabs.scss` → `.tabs`, `.tab-item` |
| Dropdowns | `_dropdowns.scss` → `.dropdown-menu`, `.dropdown-item` |
| Tooltips | `_tooltips.scss` → `.tooltip` |
| Dividers | `_dividers.scss` → `.divider`, `.divider-text` |
| Breadcrumbs | `_breadcrumbs.scss` → `.breadcrumb`, `.breadcrumb-back` |
| Pagination | `_pagination.scss` → `.pagination` |
| States | `_states.scss` → `.loading-state`, `.empty-state`, `.error-state` |
| Animations | `_animations.scss` → `@keyframes`, `.animate-fade-in` |

### 2. Use CSS Variables Only (No Hardcoded Values)

```scss
// WRONG - Hardcoded values
.my-component {
  color: #333;
  background: #2E6CB7;
  padding: 16px;
  border-radius: 12px;
}

// CORRECT - Use variables
.my-component {
  color: var(--text-color);
  background: var(--primary-color);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
}
```

**Available Variables:**

```scss
// Colors
--primary-color, --primary-gradient
--text-color, --text-color-secondary
--surface-card, --surface-ground, --surface-100, --surface-200

// Spacing (use for padding, margin, gap)
--space-1 (0.25rem), --space-2 (0.5rem), --space-3 (0.75rem)
--space-4 (1rem), --space-5 (1.25rem), --space-6 (1.5rem)

// Border Radius
--radius-sm (6px), --radius-md (8px), --radius-lg (12px), --radius-xl (16px)

// Typography
--font-size-xs, --font-size-sm, --font-size-base, --font-size-lg
--font-weight-medium (500), --font-weight-semibold (600), --font-weight-bold (700)

// Shadows
--shadow-sm, --shadow-md, --shadow-lg

// Transitions
--transition-fast, --transition-normal
```

### 3. Component SCSS Should Be Minimal

Component-specific styles should ONLY contain:
- **Layout/positioning** specific to this component
- **Unique structural rules** that don't exist globally
- **Component-specific overrides** (rare)

```scss
// GOOD - Minimal component styles
.order-summary {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: var(--space-4);

  &__sidebar {
    position: sticky;
    top: var(--space-4);
  }
}

// BAD - Recreating global styles
.order-summary {
  .card {
    background: white;           // Already in _cards.scss
    border-radius: 12px;         // Already in _cards.scss
    padding: 1.5rem;             // Already in _cards.scss
  }
}
```

### 4. HTML Should Use Global Classes

```html
<!-- WRONG - Custom classes for everything -->
<div class="order-card">
  <div class="order-header">
    <span class="order-status-badge">Pending</span>
  </div>
  <button class="order-action-btn">View</button>
</div>

<!-- CORRECT - Use global classes -->
<div class="card">
  <div class="card__header">
    <span class="badge badge--warning">Pending</span>
  </div>
  <button class="btn btn--primary btn--sm">View</button>
</div>
```

### 5. Common Patterns

**Stat/Metric Display:**
```html
<div class="stat-card">
  <div class="stat-card__icon stat-card__icon--primary">
    <i class="pi pi-shopping-cart"></i>
  </div>
  <div class="stat-card__content">
    <p class="stat-card__label">Total Orders</p>
    <h3 class="stat-card__value">1,234</h3>
  </div>
</div>
```

**Price Display:**
```html
<div class="price-compare">
  <span class="price-compare__current">$29.99</span>
  <span class="price-compare__original">$49.99</span>
  <span class="discount-badge">-40%</span>
</div>
```

**Segment Control:**
```html
<div class="segment-control">
  <button class="segment-control__item active">All</button>
  <button class="segment-control__item">Pending</button>
  <button class="segment-control__item">Completed</button>
</div>
```

**Switch/Toggle:**
```html
<label class="switch">
  <input type="checkbox" class="switch__input">
  <span class="switch__slider"></span>
  <span class="switch__label">Enable notifications</span>
</label>
```

**Info Box:**
```html
<div class="info-box info-box--warning">
  <div class="info-box__icon"><i class="pi pi-exclamation-triangle"></i></div>
  <div class="info-box__content">
    <p class="info-box__text">This action cannot be undone.</p>
  </div>
</div>
```

**Avatar Group:**
```html
<div class="avatar-group">
  <div class="avatar avatar--sm">JD</div>
  <div class="avatar avatar--sm">MK</div>
  <div class="avatar-group-counter">+3</div>
</div>
```

### 6. Page Animations (Required)

Every page/component must have entry animations for a native app feel:

```typescript
// In component
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  animations: [
    trigger('pageAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
```

```html
<!-- In template - wrap main content -->
<div @pageAnimation class="page-content">
  <!-- Content here -->
</div>
```

**Animation Guidelines:**
- **Page enter**: Fade in + slight slide up (200ms)
- **List items**: Stagger animation for multiple items
- **Modals**: Slide up from bottom (250ms)
- **Keep subtle**: 150-250ms duration max

### 7. Skeleton Loading (Required)

**ALWAYS use skeleton loaders instead of spinners.** Every page that loads data must show skeletons.

```html
<!-- REQUIRED pattern for all data-loading components -->
@if (loading()) {
  <!-- Show skeleton matching the actual content layout -->
  <div class="product-grid">
    @for (i of [1,2,3,4,5,6]; track i) {
      <div class="card">
        <div class="skeleton skeleton-image"></div>
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text short"></div>
      </div>
    }
  </div>
} @else if (error()) {
  <app-error-state (retry)="loadData()" />
} @else if (items().length === 0) {
  <app-empty-state />
} @else {
  @for (item of items(); track item.id) {
    <app-item-card [item]="item" />
  }
}
```

**Skeleton Classes (from `_skeleton.scss`):**
```html
<div class="skeleton skeleton-text"></div>        <!-- Text line -->
<div class="skeleton skeleton-text short"></div>  <!-- 60% width -->
<div class="skeleton skeleton-title"></div>       <!-- Heading -->
<div class="skeleton skeleton-image"></div>       <!-- Square image -->
<div class="skeleton skeleton-avatar"></div>      <!-- Circle avatar -->
<div class="skeleton skeleton-button"></div>      <!-- Button shape -->
<div class="skeleton skeleton-badge"></div>       <!-- Badge shape -->
```

**Rules:**
- NEVER use spinners for content with known structure
- Match skeleton layout to actual content exactly
- Show same number of skeleton items as expected
- Minimum 300ms display to avoid flicker

### 8. TypeScript Requirements

```typescript
// Use inject() not constructor injection
private authService = inject(AuthService);
private destroyRef = inject(DestroyRef);

// Use signals for state
loading = signal(false);
items = signal<Item[]>([]);
selectedItem = signal<Item | null>(null);

// Use computed for derived values
totalPrice = computed(() =>
  this.items().reduce((sum, item) => sum + item.price, 0)
);

// Use input() instead of @Input()
productId = input.required<number>();
showDetails = input(false);

// Use output() instead of @Output()
save = output<Product>();

// Use takeUntilDestroyed for subscriptions
this.service.data$.pipe(
  takeUntilDestroyed(this.destroyRef)
).subscribe();

// Use constants, not hardcoded values
router.navigate([ROUTES.LOGIN]);  // Not '/login'
localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);  // Not 'auth_token'
```

**TypeScript Rules:**
- No `any` types - create proper interfaces
- No `console.log` - use ToastMessageService for errors
- No wrapper methods that just call services
- Remove unused imports
- All components must be standalone

### 9. HTML Template Requirements

```html
<!-- Use new control flow syntax -->
@if (loading()) {
  <app-skeleton />
} @else {
  <div>Content</div>
}

@for (item of items(); track item.id) {
  <app-item [item]="item" />
} @empty {
  <app-empty-state />
}

@switch (status()) {
  @case ('pending') { <span class="badge badge--warning">Pending</span> }
  @case ('completed') { <span class="badge badge--success">Done</span> }
}

<!-- Use pipes for formatting -->
{{ date | dateFormat }}
{{ price | currency }}
{{ 'key' | translate }}

<!-- Images MUST have lazy loading and error handling -->
<img
  [src]="product.image_url"
  [alt]="product.name"
  loading="lazy"
  (error)="onImageError($event)"
/>
```

**Image Handling:**
```typescript
onImageError(event: Event): void {
  const img = event.target as HTMLImageElement;
  img.src = 'assets/images/placeholder.jpg';
}
```

### 10. Complete Component Checklist

**TypeScript (.ts):**
- [ ] Uses `signal()` for component state
- [ ] Uses `computed()` for derived values
- [ ] Uses `input()` / `output()` instead of decorators
- [ ] Uses `inject()` not constructor injection
- [ ] Uses `takeUntilDestroyed()` for subscriptions
- [ ] Uses constants (ROUTES, STORAGE_KEYS)
- [ ] No `any` types, no `console.log`
- [ ] Component is standalone

**HTML (.html):**
- [ ] Uses `@if`, `@for`, `@switch` (not *ngIf, *ngFor)
- [ ] Uses `@empty` block for empty lists
- [ ] Has skeleton loading state
- [ ] Has error state with retry
- [ ] Has empty state
- [ ] Uses pipes (dateFormat, currency, translate)
- [ ] Images have `loading="lazy"` and `(error)` handler
- [ ] Uses global BEM classes from SCSS files

**SCSS (.scss):**
- [ ] No hardcoded colors/spacing/radius
- [ ] Uses CSS variables only
- [ ] Only contains layout/positioning
- [ ] Uses global component classes

**UX:**
- [ ] Has page entry animation
- [ ] Shows skeleton while loading (not spinner)
- [ ] Smooth transitions between states