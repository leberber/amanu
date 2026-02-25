# Product List Component Refactoring Plan

## What You Asked

Refactor the `product-list` component following strict patterns from the admin components (like `admin/products/add`).

## Agreed Requirements

### 1. Structure & Layout
- **ONE responsive layout** - No duplicate desktop/mobile sections
- Use CSS media queries for responsive behavior instead of duplicating HTML

### 2. Styling Rules
- **Global SCSS only** - No component-specific SCSS (except `:host { display: block; }`)
- **NO `_components.scss` references** - It's deprecated
- Use these global SCSS files:
  - `_table.scss`
  - `_buttons.scss`
  - `_badges.scss`
  - `_cards.scss`
  - `_inputs.scss`
  - `_segments.scss`
  - `_skeleton.scss`
  - `_states.scss`
  - `_lists.scss`
  - `_pricing.scss`
  - `frontend/_layout.scss`

### 3. HTML Patterns
- Angular 20 control flow: `@if`, `@for` with `track`
- Skeleton loading states using global `.skeleton-*` classes
- Replace `<app-empty-state>` component with global `.empty-state` classes
- Use global BEM class naming

### 4. TypeScript Patterns
- Use signals and computed properties
- Extract constants (e.g., `ANIMATION_DELAY_MS`, `LOW_STOCK_THRESHOLD`)
- Mark services as `readonly`
- Use `takeUntilDestroyed()` for subscriptions
- Use `DestroyRef` for cleanup

### 5. Translation Keys
- Use existing translation keys where available
- Key patterns:
  - `products.product.select_quantity` (not `products.select_qty`)
  - `products.cart.in_cart` (not `products.in_cart`)
  - `products.stock.out_of_stock` (not `products.stock.out`)
  - `products.product.quantity_selector.pieces`

## Approach
Redo changes **section by section** for better control and review.
