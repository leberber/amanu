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

### Styling Architecture: PrimeNG + Tailwind

This project uses **two complementary styling systems**:

| System | Purpose | Examples |
|--------|---------|----------|
| **PrimeNG** | Complex UI components | `p-button`, `p-table`, `p-dialog`, `p-dropdown`, `p-tag` |
| **Tailwind** | Layout, spacing, colors, typography | `flex`, `gap-4`, `p-6`, `text-xl`, `bg-white`, `rounded-xl` |

**DO NOT create custom SCSS component classes.** Use PrimeNG components + Tailwind utilities instead.

For detailed migration patterns and examples, see: `frontend/docs/CSS_MIGRATION_PLAN.md`

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

### 2. Use Tailwind for Layout and Styling

```html
<!-- Layout -->
<div class="flex items-center justify-between gap-4">
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

<!-- Spacing -->
<div class="p-6 m-4 gap-4">

<!-- Colors -->
<div class="bg-white text-gray-900 border-gray-200">
<div class="bg-blue-500 text-white">

<!-- Typography -->
<h1 class="text-2xl font-bold">
<p class="text-sm text-gray-500">

<!-- Borders & Shadows -->
<div class="rounded-xl border border-gray-200 shadow-md">

<!-- Transitions -->
<div class="transition-all hover:-translate-y-1 hover:shadow-lg">
```

### 3. Card Patterns (PrimeNG + Tailwind)

**Simple Card (Tailwind only):**
```html
<div class="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
  <div class="flex items-center gap-4 p-6 border-b border-gray-200">
    <div class="w-11 h-11 rounded-lg bg-blue-500/10 flex items-center justify-center">
      <i class="pi pi-shopping-cart text-blue-500 text-xl"></i>
    </div>
    <h3 class="text-xl font-semibold">Order Summary</h3>
  </div>
  <div class="p-6">
    Content here
  </div>
</div>
```

**With PrimeNG p-card:**
```html
<p-card styleClass="shadow-md">
  <ng-template pTemplate="header">
    <div class="flex items-center gap-4 p-6 border-b border-gray-200">
      <div class="w-11 h-11 rounded-lg bg-blue-500/10 flex items-center justify-center">
        <i class="pi pi-shopping-cart text-blue-500 text-xl"></i>
      </div>
      <h3 class="text-xl font-semibold m-0">Order Summary</h3>
    </div>
  </ng-template>
  <div class="p-6">Content here</div>
</p-card>
```

### 4. Stat Card Pattern

```html
<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 cursor-pointer
              hover:-translate-y-0.5 hover:shadow-md transition-all">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
        <i class="pi pi-users text-white text-sm"></i>
      </div>
      <span class="text-xl font-bold">{{ totalUsers }}</span>
    </div>
    <span class="text-xs text-gray-500 font-semibold mt-2 block">Total Users</span>
  </div>
</div>
```

### 5. Form Pattern

```html
<div class="flex flex-col gap-2">
  <label class="text-sm font-medium text-gray-700">Email</label>
  <input pInputText type="email" class="w-full" />
  <small class="text-red-500">Invalid email</small>
</div>
```

### 6. Custom SCSS Rules

Custom SCSS files should ONLY contain:
- **CSS Variables** (`_variables.scss`) - Design tokens
- **PrimeNG Overrides** (`_primeng-overrides.scss`) - Theme customizations
- **Base styles** (`_base.scss`) - html, body, scrollbars, fonts

```scss
// ALLOWED - PrimeNG override
.p-button {
  border-radius: var(--radius-lg);
}

// ALLOWED - CSS variable definition
:root {
  --primary-color: #2563eb;
}

// NOT ALLOWED - Custom component class (use Tailwind instead)
.my-card {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
}
```

### 7. Tailwind Quick Reference

**Spacing:**
| Class | Value |
|-------|-------|
| `gap-1`, `p-1` | 0.25rem (4px) |
| `gap-2`, `p-2` | 0.5rem (8px) |
| `gap-4`, `p-4` | 1rem (16px) |
| `gap-6`, `p-6` | 1.5rem (24px) |

**Colors:**
| Class | Use for |
|-------|---------|
| `bg-white` | Card backgrounds |
| `bg-gray-50` | Subtle backgrounds |
| `text-gray-500` | Secondary text |
| `text-gray-900` | Primary text |
| `border-gray-200` | Borders |
| `bg-blue-500` | Primary actions |
| `bg-green-500` | Success |
| `bg-red-500` | Danger |

**Typography:**
| Class | Use for |
|-------|---------|
| `text-xs` | Badges, labels |
| `text-sm` | Secondary text |
| `text-base` | Body text |
| `text-xl` | Card titles |
| `text-2xl` | Section headers |
| `font-semibold` | 600 weight |
| `font-bold` | 700 weight |

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
- [ ] Uses PrimeNG components + Tailwind utilities (not custom classes)

**Styling:**
- [ ] Uses PrimeNG components for complex UI (buttons, tables, dialogs)
- [ ] Uses Tailwind utilities for layout, spacing, colors
- [ ] No custom SCSS component classes
- [ ] Component SCSS only for unique layout needs (rare)

**UX:**
- [ ] Has page entry animation
- [ ] Shows skeleton while loading (not spinner)
- [ ] Smooth transitions between states