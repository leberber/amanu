# CSS Migration Plan: PrimeNG First

## Overview

This document outlines the migration from our current bloated CSS architecture to a streamlined **PrimeNG-first** approach.

### Current State (Problems)
- **~5000+ lines of custom SCSS** with many unused classes
- **Duplicate patterns**: Same styles defined multiple times
- **Inconsistent naming**: Mix of BEM, utility classes, and random names
- **Large CSS bundle**: ~530KB with unused styles shipped to users

### Target State (Goals)
- **PrimeNG components + utilities first**: Use what PrimeNG provides
- **Minimal custom SCSS**: Only for styling PrimeNG can't handle
- **No unused classes**: Delete all dead code
- **Standardized naming**: Consistent conventions
- **Smaller bundle**: Remove unused styles

---

## Architecture Decision

### Priority Order (What to Use)

| Priority | System | Use For | Examples |
|----------|--------|---------|----------|
| **1st** | PrimeNG Components | Complex UI | `p-button`, `p-table`, `p-card`, `p-dialog`, `p-tag` |
| **2nd** | PrimeNG Utilities | Layout, spacing | `flex`, `gap-3`, `p-4`, `align-items-center` |
| **3rd** | Custom SCSS | Brand styling only | Gradients, custom effects, specific overrides |

### What Gets Removed

| Type | Action |
|------|--------|
| Unused classes | Delete entirely |
| Classes with PrimeNG equivalent | Replace with PrimeNG |
| Duplicate patterns | Consolidate with mixins |
| Layout classes | Replace with PrimeNG utilities |

---

## PrimeNG Utilities Reference

PrimeNG includes utility classes similar to Tailwind. Use these instead of custom SCSS.

### Flexbox
```html
<div class="flex align-items-center justify-content-between gap-3">
<div class="flex flex-column gap-2">
<div class="flex-1">  <!-- flex-grow -->
```

### Grid
```html
<div class="grid">
  <div class="col-12 md:col-6 lg:col-4">...</div>
</div>
```

### Spacing
| Class | Value |
|-------|-------|
| `p-1`, `m-1` | 0.25rem |
| `p-2`, `m-2` | 0.5rem |
| `p-3`, `m-3` | 1rem |
| `p-4`, `m-4` | 1.5rem |
| `p-5`, `m-5` | 2rem |
| `gap-1` to `gap-5` | Same scale |
| `px-3`, `py-2` | Horizontal/vertical |
| `mt-3`, `mb-2` | Single side |

### Colors & Surfaces
```html
<div class="surface-ground">   <!-- Page background -->
<div class="surface-card">     <!-- Card background -->
<div class="surface-border">   <!-- Border color -->
<span class="text-primary">    <!-- Primary color text -->
<span class="text-secondary">  <!-- Secondary text -->
<div class="bg-primary">       <!-- Primary background -->
```

### Borders & Shadows
```html
<div class="border-1 border-round">
<div class="border-round-lg">
<div class="shadow-1">  <!-- Light shadow -->
<div class="shadow-2">  <!-- Medium shadow -->
<div class="shadow-3">  <!-- Heavy shadow -->
```

### Text
```html
<span class="font-bold">
<span class="font-semibold">
<span class="text-sm">
<span class="text-lg">
<span class="text-xl">
```

---

## Migration Process

### Phase 1: Cleanup Unused Classes

For each SCSS file:
1. Search codebase for each class
2. Count usage (0 = remove, 1-2 = review, 3+ = keep)
3. Delete unused classes
4. Consolidate duplicates with mixins

### Phase 2: Replace with PrimeNG

For remaining custom classes, check if PrimeNG provides equivalent:

| Custom Class | PrimeNG Replacement |
|--------------|---------------------|
| `.btn-primary` | `<p-button>` |
| `.btn-secondary` | `<p-button severity="secondary">` |
| `.btn-danger` | `<p-button severity="danger">` |
| `.badge`, `.status-badge` | `<p-tag>` |
| `.card` | `<p-card>` or PrimeNG utilities |
| `.form-input` | `pInputText` directive |
| `.dropdown` | `<p-dropdown>` |
| `.modal` | `<p-dialog>` |
| `.table` | `<p-table>` |
| `.tabs` | `<p-tabView>` |
| `.tooltip` | `pTooltip` directive |
| Custom flex layout | `flex`, `gap-3`, `align-items-center` |
| Custom spacing | `p-3`, `m-2`, `mb-4` |

### Phase 3: Standardize Remaining Custom SCSS

For styles PrimeNG can't handle, use consistent naming:

**Naming Convention:**
```scss
// Component-specific: .component-name__element--modifier
.stat-card__icon--primary { }

// Utility: .u-utility-name
.u-gradient-primary { }

// State: .is-state or .has-state
.is-active { }
.has-error { }
```

**Keep Custom SCSS For:**
- Gradient backgrounds (PrimeNG doesn't have)
- Custom animations/transitions
- Brand-specific effects
- Complex hover states
- PrimeNG component overrides

---

## File-by-File Migration

### _cards.scss

**Current Analysis:**
| Class | Usage | Action |
|-------|-------|--------|
| `.card` | 17 | Keep - base styles |
| `.card--interactive` | 0 | ❌ Remove |
| `.card--no-hover` | 15 | Keep |
| `.card--flat` | 0 | ❌ Remove |
| `.card--full-width` | 0 | ❌ Remove |
| `.card--overflow` | 0 | ❌ Remove |
| `.card__header` | 6 | Keep |
| `.card__header--compact` | 0 | ❌ Remove |
| `.card__header--no-border` | 0 | ❌ Remove |
| `.card__body` | 6 | Keep |
| `.card__body--compact` | 0 | ❌ Remove |
| `.card__body--spacious` | 0 | ❌ Remove |
| `.card__body--flush` | 0 | ❌ Remove |
| `.card__footer` | 0 | ❌ Remove |
| `.card__icon` | 24 | Keep |
| `.card__icon--sm/md/lg` | 0 | ❌ Remove |
| `.card__icon--primary` | 4 | Keep |
| `.card__icon--success` | 4 | Keep |
| `.card__icon--info` | 0 | ❌ Remove |
| `.card__icon--teal` | 0 | ❌ Remove |
| `.card__icon--*-subtle` | 0 | ❌ Remove all |
| `.card__image` | 3 | Keep |
| `.card__image--cover/padded` | 0 | ❌ Remove |
| `.card--stat` | 0 | ❌ Remove |
| `.card--compact` | 12 | Keep |
| `.card__value` | 14 | Keep |
| `.card__label` | 13 | Keep |
| `.card__decoration` | 2 | Review |
| `.card-grid` | 0 | ❌ Remove |
| `.card-grid--*` | 0 | ❌ Remove all |
| `.settings-item` | 9 | Keep |

**After Cleanup:** ~150 lines removed

---

## Custom SCSS Structure (After Migration)

```
frontend/src/styles/
├── styles.scss              # Main entry - imports only
├── _variables.scss          # CSS custom properties (colors, spacing, etc.)
├── _base.scss               # html, body, scrollbars, fonts
├── _primeng-overrides.scss  # PrimeNG theme customizations
├── _gradients.scss          # Gradient backgrounds (PrimeNG doesn't have)
├── _animations.scss         # Custom keyframes and transitions
└── _utilities.scss          # Rare custom utilities
```

**Files to DELETE after migration:**
- Individual component files that are now empty
- Duplicate/unused pattern files

---

## Migration Checklist

### Per Component:
- [ ] List all custom classes used
- [ ] Check PrimeNG for equivalents
- [ ] Replace with PrimeNG components/utilities
- [ ] Move remaining custom styles to appropriate file
- [ ] Delete unused classes from global SCSS
- [ ] Test visually
- [ ] Test responsive behavior

### Per SCSS File:
- [ ] Count usage of each class
- [ ] Delete unused (0 usage)
- [ ] Review low usage (1-2)
- [ ] Consolidate duplicates with mixins
- [ ] Standardize naming
- [ ] Remove empty files

---

## Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Custom SCSS lines | ~5000+ | ~500 |
| CSS bundle size | ~530KB | ~350KB |
| Unused classes | Many | Zero |
| Naming consistency | Mixed | Standardized |

---

## Resources

- [PrimeNG Components](https://primeng.org/)
- [PrimeNG Utilities](https://primeng.org/utilities)
- [PrimeFlex (for reference)](https://primeflex.org/)
