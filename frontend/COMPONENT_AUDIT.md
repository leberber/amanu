# Component Audit Checklist

## Overview
Systematic review of all components (HTML, TS, SCSS) following CODE_STYLE_REQUIREMENTS.md.

**Total Components: 49**

---

## Review Legend
- [ ] Not reviewed
- [~] In progress
- [x] Reviewed & Fixed
- [!] Has issues (see notes)

## Review Checklist Quick Reference
For each component check:
- **TS**: inject(), signals, no hardcoded values, no console.log
- **HTML**: @if/@for, pipes, no inline styles
- **SCSS**: minimal CSS, CSS variables, utility classes
- **Modern**: signal(), computed(), input(), output(), @if/@for

---

## 1. App Root (1 component)

| Component | TS | HTML | SCSS | Signals | @if/@for | Status | Notes |
|-----------|:--:|:----:|:----:|:-------:|:--------:|:------:|-------|
| app.component | [x] | [x] | [x] | [x] | [x] | Done | Signals, ROUTES, new layout |

---

## 2. Layout Components (0 components - DELETED)

| Component | TS | HTML | SCSS | Signals | @if/@for | Status | Notes |
|-----------|:--:|:----:|:----:|:-------:|:--------:|:------:|-------|
| ~~layout/header~~ | - | - | - | - | - | DELETED | Unused - new layout uses sidebar/bottom-nav |
| ~~layout/footer~~ | - | - | - | - | - | DELETED | Unused - not part of new layout |

---

## 3. Shared Components (12 components)

| Component | TS | HTML | SCSS | Signals | @if/@for | Status | Notes |
|-----------|:--:|:----:|:----:|:-------:|:--------:|:------:|-------|
| shared/components/back-button | [x] | [x] | [x] | [x] | [x] | Done | input(), @if, CSS vars |
| shared/components/brand-filter | [x] | [x] | [x] | [x] | [x] | Done | input(), output(), viewChildren(), @if/@for, effect() |
| shared/components/category-bar | [x] | [x] | [x] | [x] | [x] | Done | input(), output(), viewChildren(), @if/@for, effect() |
| shared/components/empty-state | [x] | [x] | [x] | [x] | [x] | Done | input(), output(), @if, CSS vars |
| shared/components/error-state | [x] | [x] | [x] | [x] | [x] | Done | input(), output(), @if, i18n |
| shared/components/form-field | [x] | [x] | [x] | [x] | [x] | Done | input(), computed(), @if/@for, i18n |
| shared/components/horizontal-filter | [x] | [x] | [x] | [x] | [x] | Done | input(), output(), viewChildren(), computed(), @if/@for |
| shared/components/image-lightbox | [x] | [x] | [x] | [x] | [x] | Done | input(), output(), @if |
| shared/components/loading-state | [x] | [x] | [x] | [x] | [x] | Done | input(), @if/@for, skeleton default |
| shared/components/map-picker | [x] | [x] | [x] | [x] | [x] | Done | input(), output(), signal(), @if, inline template |
| shared/components/product-quantity-selector | [x] | [x] | [x] | [x] | [x] | Done | input(), output(), @if/@for, inline template |
| shared/components/user-form | [x] | [x] | [x] | [x] | [x] | Done | input(), output(), signal(), @if |

---

## 4. Base Components (1 component)

| Component | TS | HTML | SCSS | Signals | @if/@for | Status | Notes |
|-----------|:--:|:----:|:----:|:-------:|:--------:|:------:|-------|
| shared/base/base-admin-list.component | [ ] | N/A | N/A | [ ] | N/A | Pending | Abstract class |

---

## 5. UI Components (4 components)

| Component | TS | HTML | SCSS | Signals | @if/@for | Status | Notes |
|-----------|:--:|:----:|:----:|:-------:|:--------:|:------:|-------|
| components/bottom-navigation | [x] | [x] | [x] | [x] | [x] | Done | computed(), takeUntilDestroyed |
| components/language-selector | [x] | [x] | [x] | [x] | [x] | Done | signal(), computed(), takeUntilDestroyed |
| components/sidebar | [x] | [x] | [x] | [x] | [x] | Done | NEW - Unified responsive sidebar |
| ~~components/mobile-admin-menu~~ | - | - | - | - | - | DELETED | Merged into sidebar |
| ~~components/mobile-user-menu~~ | - | - | - | - | - | DELETED | Merged into sidebar |

---

## 6. Auth Pages (4 components)

| Component | TS | HTML | SCSS | Signals | @if/@for | Status | Notes |
|-----------|:--:|:----:|:----:|:-------:|:--------:|:------:|-------|
| pages/login | [ ] | [ ] | [ ] | [ ] | [ ] | Pending | |
| pages/register | [ ] | [ ] | [ ] | [ ] | [ ] | Pending | |
| pages/forgot-password | [ ] | [ ] | [ ] | [ ] | [ ] | Pending | |
| pages/reset-password | [ ] | [ ] | [ ] | [ ] | [ ] | Pending | |

---

## 7. User Pages (4 components)

| Component | TS | HTML | SCSS | Signals | @if/@for | Status | Notes |
|-----------|:--:|:----:|:----:|:-------:|:--------:|:------:|-------|
| pages/home | [ ] | [ ] | [ ] | [ ] | [ ] | Pending | |
| pages/account | [ ] | [ ] | [ ] | [ ] | [ ] | Pending | |
| pages/cart | [ ] | [ ] | [ ] | [ ] | [ ] | Pending | |
| pages/checkout | [ ] | [ ] | [ ] | [ ] | [ ] | Pending | |

---

## 8. Product Pages (5 components)

| Component | TS | HTML | SCSS | Signals | @if/@for | Status | Notes |
|-----------|:--:|:----:|:----:|:-------:|:--------:|:------:|-------|
| pages/products/product-list | [ ] | [ ] | [ ] | [ ] | [ ] | Pending | |
| pages/products/product-detail | [ ] | [ ] | [ ] | [ ] | [ ] | Pending | |
| pages/products/components/product-card | [ ] | [ ] | [ ] | [ ] | [ ] | Pending | |
| pages/products/components/product-filters | [ ] | [ ] | [ ] | [ ] | [ ] | Pending | |
| pages/products/components/product-toolbar | [ ] | [ ] | [ ] | [ ] | [ ] | Pending | |

---

## 9. Order Pages (2 components)

| Component | TS | HTML | SCSS | Signals | @if/@for | Status | Notes |
|-----------|:--:|:----:|:----:|:-------:|:--------:|:------:|-------|
| pages/orders/order-list | [ ] | [ ] | [ ] | [ ] | [ ] | Pending | |
| pages/orders/order-detail | [ ] | [ ] | [ ] | [ ] | [ ] | Pending | |

---

## 10. Admin Pages (13 components)

| Component | TS | HTML | SCSS | Signals | @if/@for | Status | Notes |
|-----------|:--:|:----:|:----:|:-------:|:--------:|:------:|-------|
| pages/admin/admin-dashboard | [ ] | [ ] | [ ] | [ ] | [ ] | Pending | |
| pages/admin/admin-products | [ ] | [ ] | [ ] | [ ] | [ ] | Pending | |
| pages/admin/admin-add-product | [ ] | [ ] | [ ] | [ ] | [ ] | Pending | |
| pages/admin/admin-categories | [ ] | [ ] | [ ] | [ ] | [ ] | Pending | |
| pages/admin/admin-add-category | [ ] | [ ] | [ ] | [ ] | [ ] | Pending | |
| pages/admin/admin-brands | [ ] | [ ] | [ ] | [ ] | [ ] | Pending | |
| pages/admin/admin-add-brand | [ ] | [ ] | [ ] | [ ] | [ ] | Pending | |
| pages/admin/admin-promotions | [ ] | [ ] | [ ] | [ ] | [ ] | Pending | |
| pages/admin/admin-add-promotion | [ ] | [ ] | [ ] | [ ] | [ ] | Pending | |
| pages/admin/admin-orders | [ ] | [ ] | [ ] | [ ] | [ ] | Pending | |
| pages/admin/admin-users | [ ] | [ ] | [ ] | [ ] | [ ] | Pending | |
| pages/admin/admin-edit-user | [ ] | [ ] | [ ] | [ ] | [ ] | Pending | |
| pages/admin/admin-notifications | [ ] | [ ] | [ ] | [ ] | [ ] | Pending | |

---

## 11. Other Pages (1 component)

| Component | TS | HTML | SCSS | Signals | @if/@for | Status | Notes |
|-----------|:--:|:----:|:----:|:-------:|:--------:|:------:|-------|
| pages/privacy-policy | [ ] | [ ] | [ ] | [ ] | [ ] | Pending | |

---

## Progress Summary

| Category | Total | Reviewed | Remaining |
|----------|:-----:|:--------:|:---------:|
| App Root | 1 | 1 | 0 |
| Layout | 0 | 0 | 0 |
| Shared | 12 | 12 | 0 |
| Base | 1 | 0 | 1 |
| UI | 3 | 3 | 0 |
| Auth Pages | 4 | 0 | 4 |
| User Pages | 4 | 0 | 4 |
| Product Pages | 5 | 0 | 5 |
| Order Pages | 2 | 0 | 2 |
| Admin Pages | 13 | 0 | 13 |
| Other Pages | 1 | 0 | 1 |
| **TOTAL** | **46** | **18** | **28** |

---

## Issues Found Log

### Common Issues
_(Will be populated as reviews progress)_

| Issue Type | Count | Components Affected |
|------------|:-----:|---------------------|
| Hardcoded routes | 0 | |
| Console statements | 0 | |
| Wrapper methods | 0 | |
| Hardcoded colors | 0 | |
| Unnecessary CSS | 0 | |
| Missing trackBy/@for track | 0 | |
| Unused imports | 0 | |
| Uses *ngIf (should use @if) | 0 | |
| Uses *ngFor (should use @for) | 0 | |
| Uses plain properties (should use signals) | 0 | |
| Uses @Input/@Output (should use input()/output()) | 0 | |
| Uses constructor DI (should use inject()) | 0 | |

---

## Session Log

| Date | Components Reviewed | Issues Fixed |
|------|:-------------------:|:------------:|
| 2026-02-20 | brand-filter, category-bar, horizontal-filter, image-lightbox, map-picker, product-quantity-selector, user-form | Converted to signals, @if/@for, removed console statements |

---

## Next Component to Review

**Next:** Base components, then Auth pages

**Recommended order:**
1. ~~Shared components~~ (COMPLETED)
2. Base components (1 remaining)
3. Auth pages (4 remaining)
4. User pages (4 remaining)
5. Product pages (5 remaining)
6. Order pages (2 remaining)
7. Admin pages (13 remaining)
8. Other pages (1 remaining)
