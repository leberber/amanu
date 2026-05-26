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
- **UI Library**: PrimeNG components + utilities
- **Styling**: PrimeNG first, custom SCSS for brand styling only
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
- **Domain**: agroclik.com with Route 53
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

### Styling Architecture: PrimeNG First

This project uses a **PrimeNG-first** approach for styling:

| Priority | System | Use For | Examples |
|----------|--------|---------|----------|
| **1st** | PrimeNG Components | Complex UI | `p-button`, `p-table`, `p-card`, `p-dialog`, `p-tag` |
| **2nd** | PrimeNG Utilities | Layout, spacing | `flex`, `gap-3`, `p-4`, `align-items-center` |
| **3rd** | Custom SCSS | Brand styling only | Gradients, custom effects, PrimeNG overrides |

**DO NOT create new custom SCSS classes.** Use PrimeNG components + utilities first.

For detailed migration patterns, see: `frontend/docs/CSS_MIGRATION_PLAN.md`

### 1. Use PrimeNG Components for Complex UI

```html
<!-- Buttons -->
<p-button label="Save" />
<p-button label="Cancel" severity="secondary" />
<p-button label="Delete" severity="danger" />
<p-button label="Add" icon="pi pi-plus" severity="success" />

<!-- Badges/Tags -->
<p-tag value="Active" severity="success" />
<p-tag value="Pending" severity="warning" [rounded]="true" />

<!-- Tables -->
<p-table [value]="items" styleClass="p-datatable-sm" [paginator]="true" [rows]="10">
  <ng-template pTemplate="header">...</ng-template>
  <ng-template pTemplate="body" let-item>...</ng-template>
</p-table>

<!-- Dialogs -->
<p-dialog header="Confirm" [(visible)]="showDialog">...</p-dialog>

<!-- Inputs -->
<input pInputText type="text" class="w-full" />
<p-dropdown [options]="items" [(ngModel)]="selected" />
```

### 2. Use PrimeNG Utilities for Layout

```html
<!-- Flexbox -->
<div class="flex align-items-center justify-content-between gap-3">
<div class="flex flex-column gap-2">
<div class="flex-1">  <!-- flex-grow -->

<!-- Grid -->
<div class="grid">
  <div class="col-12 md:col-6 lg:col-4">...</div>
</div>

<!-- Spacing -->
<div class="p-3 m-2 mb-4 gap-3">

<!-- Colors & Surfaces -->
<div class="surface-card border-round shadow-2">
<span class="text-primary font-semibold">
<span class="text-secondary text-sm">

<!-- Borders & Shadows -->
<div class="border-1 border-round-lg shadow-1">
```

### 3. PrimeNG Utilities Quick Reference

**Spacing:**
| Class | Value |
|-------|-------|
| `p-1`, `m-1`, `gap-1` | 0.25rem |
| `p-2`, `m-2`, `gap-2` | 0.5rem |
| `p-3`, `m-3`, `gap-3` | 1rem |
| `p-4`, `m-4`, `gap-4` | 1.5rem |
| `p-5`, `m-5`, `gap-5` | 2rem |
| `px-3`, `py-2` | Horizontal/vertical |
| `mt-3`, `mb-2` | Single side |

**Surfaces & Colors:**
| Class | Use for |
|-------|---------|
| `surface-ground` | Page background |
| `surface-card` | Card background |
| `surface-border` | Border color |
| `text-primary` | Primary color text |
| `text-secondary` | Secondary text |
| `bg-primary` | Primary background |

**Typography:**
| Class | Use for |
|-------|---------|
| `text-sm` | Small text |
| `text-lg` | Large text |
| `text-xl` | Extra large |
| `font-semibold` | 600 weight |
| `font-bold` | 700 weight |

**Layout:**
| Class | Use for |
|-------|---------|
| `flex` | Flexbox container |
| `flex-column` | Column direction |
| `align-items-center` | Vertical center |
| `justify-content-between` | Space between |
| `gap-3` | Gap between items |
| `flex-1` | Flex grow |

### 4. Custom SCSS (Only When Needed)

Custom SCSS should ONLY contain:
- **CSS Variables** (`_variables.scss`) - Design tokens
- **PrimeNG Overrides** (`_primeng-overrides.scss`) - Theme customizations
- **Gradients** (`_gradients.scss`) - PrimeNG doesn't have gradient utilities
- **Custom animations** - Brand-specific effects

```scss
// ALLOWED - Gradient (PrimeNG doesn't have)
.card__icon--primary {
  background: var(--primary-gradient);
}

// ALLOWED - PrimeNG override
.p-button {
  border-radius: var(--radius-lg);
}

// ALLOWED - CSS variable
:root {
  --primary-gradient: linear-gradient(135deg, #3b82f6, #1d4ed8);
}

// NOT ALLOWED - Layout class (use PrimeNG utilities)
.my-flex-container {
  display: flex;
  gap: 1rem;
}
```

### 5. Existing Custom Classes (Legacy)

Some existing components use custom SCSS classes. When modifying these:
- **Keep working classes** - Don't break existing UI
- **Don't add new custom classes** - Use PrimeNG instead
- **Gradually migrate** - Replace with PrimeNG when touching that code

Common existing classes:
- `.card`, `.card__header`, `.card__body` - Card structure
- `.card__icon--primary/success/etc` - Icon gradient backgrounds
- `.nav-link`, `.nav-link--mobile` - Navigation items
- `.settings-item` - Settings row items

### 8. Page Animations (Required)

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

### 9. Skeleton Loading (Required)

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

### 10. TypeScript Requirements

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

### 11. HTML Template Requirements

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
  @case ('pending') { <p-tag value="Pending" severity="warning" /> }
  @case ('completed') { <p-tag value="Done" severity="success" /> }
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

### 12. Complete Component Checklist

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
- [ ] Uses PrimeNG components + utilities (not new custom classes)

**Styling:**
- [ ] Uses PrimeNG components for complex UI (buttons, tables, dialogs, tags)
- [ ] Uses PrimeNG utilities for layout, spacing (`flex`, `gap-3`, `p-4`)
- [ ] No new custom SCSS classes created
- [ ] Custom SCSS only for gradients/effects PrimeNG can't handle

**UX:**
- [ ] Has page entry animation
- [ ] Shows skeleton while loading (not spinner)
- [ ] Smooth transitions between states