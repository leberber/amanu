# Components and Services Reference

This document provides a comprehensive list of all Angular components and services in the Elsuq frontend application.

---

## Components (62 total)

### Root Component

| Component | Path | Description |
|-----------|------|-------------|
| AppComponent | `app.component.ts` | Root application component with routing and navigation |

### Layout Components (6)

| Component | Path | Description |
|-----------|------|-------------|
| SidebarComponent | `components/sidebar/` | Main navigation sidebar for desktop |
| BottomNavigationComponent | `components/bottom-navigation/` | Mobile bottom navigation bar |
| MobileAdminMenuComponent | `components/mobile-admin-menu/` | Admin menu drawer for mobile |
| LanguageSelectorComponent | `components/language-selector/` | Language selection dropdown |
| OnboardingComponent | `components/onboarding/` | First-time user onboarding slides |
| InactiveUserMessageComponent | `components/inactive-user-message/` | Message shown for inactive users |

### Page Components (26)

#### Authentication & User Pages

| Component | Path | Description |
|-----------|------|-------------|
| LoginComponent | `pages/login/` | User login page |
| RegisterComponent | `pages/register/` | User registration page |
| ForgotPasswordComponent | `pages/forgot-password/` | Password recovery request |
| ResetPasswordComponent | `pages/reset-password/` | Password reset form |
| CompleteProfileComponent | `pages/complete-profile/` | Profile completion after registration |
| AccountComponent | `pages/account/` | User account management |
| SettingsComponent | `pages/settings/` | User settings page |
| NotificationsComponent | `pages/notifications/` | User notifications list |

#### Shopping Pages

| Component | Path | Description |
|-----------|------|-------------|
| HomeComponent | `pages/home/` | Home page with featured products |
| ProductListComponent | `pages/products/product-list/` | Product listing with filters |
| ProductDetailComponent | `pages/products/product-detail/` | Single product details |
| CartComponent | `pages/cart/` | Shopping cart |
| OrderSummaryComponent | `pages/order-summary/` | Order summary before checkout |
| CheckoutComponent | `pages/checkout/` | Checkout process |
| PromotionsComponent | `pages/promotions/` | Active promotions listing |

#### Order Pages

| Component | Path | Description |
|-----------|------|-------------|
| OrderListComponent | `pages/orders/order-list/` | User order history |
| OrderDetailComponent | `pages/orders/order-detail/` | Single order details |

#### Static Pages

| Component | Path | Description |
|-----------|------|-------------|
| AboutComponent | `pages/about/` | About us page |
| ContactComponent | `pages/contact/` | Contact information |
| PrivacyPolicyComponent | `pages/privacy-policy/` | Privacy policy |
| TermsComponent | `pages/terms/` | Terms of service |

### Admin Page Components (14)

| Component | Path | Description |
|-----------|------|-------------|
| AdminDashboardComponent | `pages/admin/admin-dashboard/` | Admin analytics dashboard |
| AdminOrdersComponent | `pages/admin/admin-orders/` | Order management list |
| AdminOrderDetailComponent | `pages/admin/admin-order-detail/` | Order detail with status management |
| AdminProductsComponent | `pages/admin/admin-products/` | Product management list |
| AdminAddProductComponent | `pages/admin/admin-add-product/` | Add/edit product form |
| AdminCategoriesComponent | `pages/admin/admin-categories/` | Category management |
| AdminAddCategoryComponent | `pages/admin/admin-add-category/` | Add/edit category form |
| AdminBrandsComponent | `pages/admin/admin-brands/` | Brand management |
| AdminAddBrandComponent | `pages/admin/admin-add-brand/` | Add/edit brand form |
| AdminPromotionsComponent | `pages/admin/admin-promotions/` | Promotion management |
| AdminAddPromotionComponent | `pages/admin/admin-add-promotion/` | Add/edit promotion form |
| AdminUsersComponent | `pages/admin/admin-users/` | User management |
| AdminEditUserComponent | `pages/admin/admin-edit-user/` | Edit user details |
| AdminNotificationsComponent | `pages/admin/admin-notifications/` | Send push notifications |

### Product Components (4)

| Component | Path | Description |
|-----------|------|-------------|
| ProductCardComponent | `pages/products/components/product-card/` | Product card for grid view |
| ProductListItemComponent | `pages/products/components/product-list-item/` | Product row for list view |
| ProductFiltersComponent | `pages/products/components/product-filters/` | Category/brand filter panel |

### Shared Components (16)

#### Layout & Navigation

| Component | Path | Description |
|-----------|------|-------------|
| PageLayoutComponent | `shared/components/page-layout/` | Standard page layout wrapper |
| BackButtonComponent | `shared/components/back-button/` | Navigation back button |
| StickyFooterComponent | `shared/components/sticky-footer/` | Sticky action footer |
| HorizontalFilterComponent | `shared/components/horizontal-filter/` | Horizontal scrollable filter chips |
| AgroclikPageContainerComponent | `shared/components/agroclik-page-container/` | Page container wrapper |

#### State Components

| Component | Path | Description |
|-----------|------|-------------|
| EmptyStateComponent | `shared/components/empty-state/` | Empty data state display |
| ErrorStateComponent | `shared/components/error-state/` | Error state with retry |
| LoadingStateComponent | `shared/components/loading-state/` | Loading spinner/skeleton |
| TableSkeletonComponent | `shared/components/table-skeleton/` | Table loading skeleton |

#### Form Components

| Component | Path | Description |
|-----------|------|-------------|
| FormFieldComponent | `shared/components/form-field/` | Form field wrapper with validation |
| UserFormComponent | `shared/components/user-form/` | Reusable user form |
| SearchInputComponent | `shared/components/search-input/` | Search input with service integration |
| TableSearchComponent | `shared/components/table-search/` | Table search input |
| GoogleSignInButtonComponent | `shared/components/google-signin-button/` | Google OAuth sign-in button |

#### Media Components

| Component | Path | Description |
|-----------|------|-------------|
| ImageLightboxComponent | `shared/components/image-lightbox/` | Full-screen image viewer |
| MapPickerComponent | `shared/components/map-picker/` | Location picker with Leaflet map |

### Base Components (1)

| Component | Path | Description |
|-----------|------|-------------|
| BaseAdminListComponent | `shared/base/base-admin-list.component.ts` | Abstract base for admin list pages |

---

## Services (43 total)

### Core Services (24)

Located in `core/services/`

#### Authentication & Authorization

| Service | Description |
|---------|-------------|
| AuthGuardService | Route guards for authentication |

#### Data Formatting

| Service | Description |
|---------|-------------|
| CurrencyService | Currency formatting and conversion |
| DateService | Date formatting utilities |
| UnitsService | Unit translation and formatting |
| PackagingTypeService | Packaging type translations |

#### UI Services

| Service | Description |
|---------|-------------|
| ToastMessageService | Toast notification management |
| ConfirmationDialogService | Confirmation dialog management |
| LightboxService | Image lightbox management |
| OverlayService | Overlay/backdrop management |
| FlyToCartService | Add-to-cart animation |
| LoadingStateService | Loading state management |

#### Form Services

| Service | Description |
|---------|-------------|
| ValidationMessagesService | Form validation message helpers |
| FormBuilderService | Form creation utilities |
| AdminFormService | Admin form helpers |

#### Navigation & Layout

| Service | Description |
|---------|-------------|
| NavigationService | Navigation with animation direction |
| BreakpointService | Responsive breakpoint detection |

#### Table Services

| Service | Description |
|---------|-------------|
| TableColumnsService | Table column visibility management |
| PaginationService | Pagination state management |
| SearchDebounceService | Debounced search input |

#### Translation Services

| Service | Description |
|---------|-------------|
| TranslationHelperService | Translation utilities |
| CartTranslationService | Cart-specific translations |
| OrderTranslationService | Order-specific translations |

#### Status Services

| Service | Description |
|---------|-------------|
| StatusSeverityService | Status badge severity mapping |
| StockStatusService | Stock level status helpers |
| OrderTimelineService | Order timeline generation |

#### Storage

| Service | Description |
|---------|-------------|
| StorageService | LocalStorage abstraction |
| UserPreferencesService | User preference management |

#### Data

| Service | Description |
|---------|-------------|
| BrandService | Brand data fetching (cached) |

### Feature Services (19)

Located in `services/`

#### API & Authentication

| Service | Description |
|---------|-------------|
| ApiService | HTTP client wrapper with interceptors |
| AuthService | Authentication state and operations |

#### Data Services

| Service | Description |
|---------|-------------|
| ProductService | Product CRUD operations |
| CartService | Shopping cart management |
| OrderService | Order operations |
| UserService | User profile operations |
| PromotionService | Promotion operations |
| AdminService | Admin-specific operations |
| NotificationService | Admin notification sending |
| UserNotificationService | User notification management |

#### UI Services

| Service | Description |
|---------|-------------|
| SearchService | Global search state |
| SidebarService | Sidebar state management |
| ViewportService | Viewport detection |
| TranslationService | Language switching |
| PushService | Push notification setup |

---

## Directory Structure

```
src/app/
├── components/              # Layout components
│   ├── bottom-navigation/
│   ├── inactive-user-message/
│   ├── language-selector/
│   ├── mobile-admin-menu/
│   ├── onboarding/
│   └── sidebar/
├── core/
│   ├── constants/          # Application constants
│   ├── guards/             # Route guards
│   ├── interceptors/       # HTTP interceptors
│   ├── services/           # Core services
│   └── utils/              # Utility functions
├── models/                  # TypeScript interfaces
├── pages/
│   ├── about/
│   ├── account/
│   ├── admin/              # Admin pages
│   │   ├── admin-add-brand/
│   │   ├── admin-add-category/
│   │   ├── admin-add-product/
│   │   ├── admin-add-promotion/
│   │   ├── admin-brands/
│   │   ├── admin-categories/
│   │   ├── admin-dashboard/
│   │   ├── admin-edit-user/
│   │   ├── admin-notifications/
│   │   ├── admin-order-detail/
│   │   ├── admin-orders/
│   │   ├── admin-products/
│   │   ├── admin-promotions/
│   │   └── admin-users/
│   ├── cart/
│   ├── checkout/
│   ├── complete-profile/
│   ├── contact/
│   ├── forgot-password/
│   ├── home/
│   ├── login/
│   ├── notifications/
│   ├── order-summary/
│   ├── orders/
│   │   ├── order-detail/
│   │   └── order-list/
│   ├── privacy-policy/
│   ├── products/
│   │   ├── components/
│   │   │   ├── product-card/
│   │   │   ├── product-filters/
│   │   │   └── product-list-item/
│   │   ├── product-detail/
│   │   └── product-list/
│   ├── promotions/
│   ├── register/
│   ├── reset-password/
│   ├── settings/
│   └── terms/
├── services/               # Feature services
└── shared/
    ├── base/               # Base components
    ├── components/         # Shared components
    │   ├── agroclik-page-container/
    │   ├── back-button/
    │   ├── empty-state/
    │   ├── error-state/
    │   ├── form-field/
    │   ├── google-signin-button/
    │   ├── horizontal-filter/
    │   ├── image-lightbox/
    │   ├── loading-state/
    │   ├── map-picker/
    │   ├── page-layout/
    │   ├── search-input/
    │   ├── sticky-footer/
    │   ├── table-search/
    │   ├── table-skeleton/
    │   └── user-form/
    ├── pipes/              # Custom pipes
    └── utils/              # Shared utilities
```

---

## Component Patterns

All components follow these patterns:

- **Standalone**: All components use `standalone: true`
- **Signals**: State management uses Angular signals (`signal()`, `computed()`)
- **Inputs/Outputs**: Use `input()` and `output()` functions
- **Dependency Injection**: Use `inject()` function
- **Subscriptions**: Use `takeUntilDestroyed()` for cleanup
- **Constants**: Import from `core/constants/`

---

## Service Patterns

- **Singleton**: All services are `providedIn: 'root'`
- **Signals**: Services expose signals for reactive state
- **HTTP**: ApiService handles all HTTP requests
- **Caching**: BrandService and similar use signal-based caching

---

*Last updated: March 2026*
