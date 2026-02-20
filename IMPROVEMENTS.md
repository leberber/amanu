# Code Improvements Checklist

Track progress on DRY violations and code quality fixes.

---

## Critical Priority

- [x] **1. Create Abstract Base List Component** ✅
  - Created `BaseAdminListComponent` in `shared/base/base-admin-list.component.ts`
  - All 6 admin list components now extend this base class
  - Consolidated: `loading`, `searchQuery`, `first`, `rows`, `onPageChange()`, `onSearchInput()`, `formatDate()`

- [ ] **2. Extract Inline Editing Logic**
  - Role/Status/Price/Stock editing repeated with identical patterns
  - Files: `admin-users.ts`, `admin-orders.ts`, `admin-products.ts`

- [x] **3. Use ToastMessageService Consistently** ✅
  - All 24 components now use `ToastMessageService` instead of direct `MessageService.add()` calls
  - Services that wrap MessageService (toast-message, notification, admin-form) kept as-is

- [ ] **4. Extract Form Validation Utilities**
  - Repeated FormBuilder patterns and validation error handling
  - Files: `login.component.ts`, `register.component.ts`, `checkout.component.ts`

---

## High Priority

- [ ] **5. Extract SCSS Animations & Variables**
  - `@keyframes float`, `@keyframes pulse`, gradients repeated in each admin SCSS file
  - Create `_admin-shared.scss`

- [x] **6. Create Price/Currency Formatting Pipe** ✅
  - Created `CurrencyPipe` (`appCurrency`) in `shared/pipes/currency.pipe.ts`
  - Replaced `formatPrice()` wrapper in 11 components with pipe usage

- [ ] **7. Extract Cart Translation Loading**
  - `loadTranslatedNames()` duplicated in cart and checkout
  - Create `CartTranslationService`

- [ ] **8. Centralize Confirmation Dialogs**
  - Same delete confirmation config in all 6 admin list components
  - Create `ConfirmDialogService`

---

## Medium Priority

- [ ] **9. Create Unit Display Pipe**
  - `getUnitDisplay()` wrapper in 8+ components

- [ ] **10. Create Date Format Pipe**
  - `formatDate()` wrapper in 8+ components

- [ ] **11. Extract Search Debounce Pattern**
  - Identical `onSearchInput()` in 6 admin components

- [ ] **12. Centralize Error Handling**
  - Same try-catch pattern with messageService in multiple files

- [ ] **13. Use StatusSeverityService Consistently**
  - `getStatusSeverity()`, `getStatusIcon()` duplicated despite service existing

- [ ] **14. Centralize Hardcoded Values**
  - Shipping cost, min search chars, page sizes, timeout delays

- [ ] **15. Extract Product Quantity Default Logic**
  - Same quantity_config check in product-list and cart

---

## Low Priority

- [ ] **16. Create AdminSharedModule**
  - Common PrimeNG imports repeated in every admin component

- [ ] **17. Standardize Translation Keys**
  - Inconsistent error message key patterns

- [ ] **18. Clean Up Unused Imports**
  - Some files import both TranslationService and TranslateService

- [ ] **19. Extract Navigation Helpers**
  - `navigateToEdit()` pattern repeated

- [ ] **20. Language Change Subscription Helper**
  - Same `onLangChange.subscribe()` in 12+ components

---

## Progress

| Priority | Total | Done | Remaining |
|----------|-------|------|-----------|
| Critical | 4 | 2 | 2 |
| High | 4 | 1 | 3 |
| Medium | 7 | 0 | 7 |
| Low | 5 | 0 | 5 |
| **Total** | **20** | **3** | **17** |

---

*Last updated: 2026-02-20*
