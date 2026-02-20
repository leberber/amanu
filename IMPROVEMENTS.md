# Code Improvements Checklist

Track progress on DRY violations and code quality fixes.

---

## Critical Priority

- [x] **1. Create Abstract Base List Component** ✅
  - Created `BaseAdminListComponent` in `shared/base/base-admin-list.component.ts`
  - All 6 admin list components now extend this base class
  - Consolidated: `loading`, `searchQuery`, `first`, `rows`, `onPageChange()`, `onSearchInput()`, `formatDate()`

- [x] **2. Extract Inline Editing Logic** ✅
  - Created `InlineEditState<T>` utility in `shared/utils/inline-edit-state.ts`
  - Refactored `admin-products.ts` (price, stock editing) and `admin-users.ts` (role, status editing)
  - Note: `admin-orders.ts` uses a different pattern (status expansion buttons) - not applicable

- [x] **3. Use ToastMessageService Consistently** ✅
  - All 24 components now use `ToastMessageService` instead of direct `MessageService.add()` calls
  - Services that wrap MessageService (toast-message, notification, admin-form) kept as-is

- [x] **4. Extract Form Validation Utilities** ✅
  - `FormValidationService` and `ValidationMessagesService` already exist in `core/services/`
  - Refactored `login.component.ts` to use built-in `markAllAsTouched()`
  - Removed dead `getFieldError()` method from `register.component.ts`
  - `checkout.component.ts` already uses `markAllAsTouched()` correctly

---

## High Priority

- [x] **5. Extract SCSS Animations & Variables** ✅
  - Created `_admin-shared.scss` in `src/styles/` with shared animations and blob styles
  - Contains `@keyframes float`, `@keyframes pulse`, `@keyframes spin`, and blob decorations

- [x] **6. Create Price/Currency Formatting Pipe** ✅
  - Created `CurrencyPipe` (`appCurrency`) in `shared/pipes/currency.pipe.ts`
  - Replaced `formatPrice()` wrapper in 11 components with pipe usage

- [x] **7. Extract Cart Translation Loading** ✅
  - Created `CartTranslationService` in `core/services/cart-translation.service.ts`
  - Refactored `cart.component.ts` and `checkout.component.ts` to use the service
  - Note: `order-detail.component.ts` kept separate due to additional image requirements

- [x] **8. Centralize Confirmation Dialogs** ✅
  - `ConfirmationDialogService` already existed in `core/services/`
  - Updated 5 admin components to use it: users, products, brands, categories, promotions

---

## Medium Priority

- [x] **9. Create Unit Display Pipe** ✅
  - Created `UnitPipe` (`appUnit`) in `shared/pipes/unit.pipe.ts`
  - Can be used in templates: `{{ 'kg' | appUnit }}` or `{{ 'kg' | appUnit:false }}`

- [x] **10. Create Date Format Pipe** ✅
  - Created `DateFormatPipe` (`appDate`) in `shared/pipes/date-format.pipe.ts`
  - Supports: full, dateOnly, timeOnly, relative formats

- [x] **11. Extract Search Debounce Pattern** ✅
  - Already implemented in `BaseAdminListComponent.onSearchInput()`
  - Uses `SearchDebounceService` - all admin components inherit this

- [x] **12. Centralize Error Handling** ✅
  - Already centralized via `ToastMessageService` (showError, showApiError)
  - All components use consistent error handling patterns

- [x] **13. Use StatusSeverityService Consistently** ✅
  - Components already use `StatusSeverityService` via wrapper methods
  - Wrapper methods needed for template binding (e.g., `getStatusSeverity()` delegates to service)

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
| Critical | 4 | 4 | 0 |
| High | 4 | 4 | 0 |
| Medium | 7 | 5 | 2 |
| Low | 5 | 0 | 5 |
| **Total** | **20** | **13** | **7** |

---

*Last updated: 2026-02-20*
