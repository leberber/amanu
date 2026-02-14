# Promotions Feature Implementation

This document outlines the implementation plan for adding promotions/discounts to the Amanu e-commerce platform.

---

## Overview

The promotions system allows administrators to create discounts that can be applied to products, categories, brands, or entire orders. Customers can apply promo codes at checkout to receive discounts.

---

## Feature Requirements

### Promotion Types

| Type | Field | Description |
|------|-------|-------------|
| Percentage | `discount_type: 'percentage'` | Reduces price by X% (e.g., 20% off) |
| Fixed Amount | `discount_type: 'fixed_amount'` | Reduces price by fixed value (e.g., $5 off) |

### Promotion Scopes

| Scope | Description | Use Case |
|-------|-------------|----------|
| `global` | Applies to entire order | Site-wide sales, holiday discounts |
| `category` | Applies to products in a category | "10% off all Fruits" |
| `brand` | Applies to products from a brand | "15% off El Mordjene products" |
| `product` | Applies to a specific product | "20% off Apples" |

### Promotion Conditions

- **Minimum order amount**: Promotion only applies if order total >= X
- **Maximum discount**: Cap the discount amount (useful for percentage discounts)
- **Usage limit**: Maximum number of times promotion can be used
- **Date range**: Start and end dates for promotion validity
- **Promo code**: Optional code customers must enter

---

## Database Schema

### New Table: `promotions`

```sql
CREATE TABLE promotions (
    id SERIAL PRIMARY KEY,

    -- Basic Info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    code VARCHAR(50) UNIQUE,  -- Optional promo code

    -- Translations (JSON)
    name_translations JSONB DEFAULT '{}',
    description_translations JSONB DEFAULT '{}',

    -- Discount Configuration
    discount_type VARCHAR(20) NOT NULL,  -- 'percentage' or 'fixed_amount'
    discount_value DECIMAL(10, 2) NOT NULL,  -- Amount or percentage

    -- Scope
    scope VARCHAR(20) NOT NULL DEFAULT 'global',  -- 'global', 'category', 'brand', 'product'
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,

    -- Conditions
    min_order_amount DECIMAL(10, 2) DEFAULT 0,
    max_discount DECIMAL(10, 2),  -- NULL means no cap
    usage_limit INTEGER,  -- NULL means unlimited
    usage_count INTEGER DEFAULT 0,

    -- Validity
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,

    -- Audit
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_promotions_code ON promotions(code);
CREATE INDEX idx_promotions_active ON promotions(is_active, start_date, end_date);
CREATE INDEX idx_promotions_scope ON promotions(scope, category_id, brand_id, product_id);
```

### Modified Table: `orders`

```sql
ALTER TABLE orders ADD COLUMN promotion_id INTEGER REFERENCES promotions(id);
ALTER TABLE orders ADD COLUMN discount_amount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN subtotal DECIMAL(10, 2);  -- Before discount
-- total_amount will now be: subtotal - discount_amount
```

### New Table: `promotion_usages` (for tracking)

```sql
CREATE TABLE promotion_usages (
    id SERIAL PRIMARY KEY,
    promotion_id INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    discount_applied DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(promotion_id, order_id)
);

CREATE INDEX idx_promotion_usages_promotion ON promotion_usages(promotion_id);
CREATE INDEX idx_promotion_usages_user ON promotion_usages(user_id);
```

---

## Implementation Phases

### Phase 1: Backend Foundation

**Files to create:**
- `backend/app/models/promotion.py` - SQLModel models
- `backend/app/api/api_v1/endpoints/promotions.py` - API endpoints
- `backend/migrations/add_promotions.sql` - Database migration

**Files to modify:**
- `backend/app/api/api_v1/api.py` - Add promotions router
- `backend/app/models/__init__.py` - Export promotion models

**Endpoints:**
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/promotions/` | List all promotions | Staff/Admin |
| GET | `/promotions/active` | List active promotions | Public |
| GET | `/promotions/{id}` | Get promotion details | Staff/Admin |
| GET | `/promotions/code/{code}` | Validate promo code | Public |
| POST | `/promotions/` | Create promotion | Staff/Admin |
| PUT | `/promotions/{id}` | Update promotion | Staff/Admin |
| DELETE | `/promotions/{id}` | Delete promotion | Admin |
| POST | `/promotions/calculate` | Calculate discount for cart | Public |

**Validation to test:**
- [ ] Create a percentage discount promotion
- [ ] Create a fixed amount promotion
- [ ] Create category-scoped promotion
- [ ] Validate promo code endpoint works
- [ ] Calculate discount returns correct amount

---

### Phase 2: Order Integration

**Files to modify:**
- `backend/app/models/order.py` - Add promotion fields
- `backend/app/api/api_v1/endpoints/orders.py` - Apply discount on order creation

**Logic:**
1. Order creation accepts optional `promotion_code`
2. Validate promotion is active and applicable
3. Calculate discount based on cart items and promotion scope
4. Store `subtotal`, `discount_amount`, `total_amount`, `promotion_id`
5. Increment `usage_count` on promotion
6. Create `promotion_usage` record

**Validation to test:**
- [ ] Create order without promotion (works as before)
- [ ] Create order with valid promo code
- [ ] Create order with expired promo code (rejected)
- [ ] Create order with usage-limited promo (rejected when limit reached)
- [ ] Discount calculated correctly for percentage
- [ ] Discount calculated correctly for fixed amount
- [ ] Max discount cap is applied

---

### Phase 3: Frontend - Promotion Service & Cart

**Files to create:**
- `frontend/src/app/services/promotion.service.ts`
- `frontend/src/app/models/promotion.model.ts`

**Files to modify:**
- `frontend/src/app/pages/cart/cart.component.ts` - Add promo code input
- `frontend/src/app/pages/cart/cart.component.html` - UI for promo code
- `frontend/src/app/services/cart.service.ts` - Store applied promotion
- `frontend/src/assets/i18n/*.json` - Add translations

**UI Changes:**
- Promo code input field with "Apply" button
- Show discount breakdown:
  - Subtotal: $XX.XX
  - Discount (CODE): -$X.XX
  - Total: $XX.XX
- Success/error messages for promo code validation

**Validation to test:**
- [ ] Enter valid promo code, see discount applied
- [ ] Enter invalid promo code, see error message
- [ ] Remove promo code, discount removed
- [ ] Discount persists when navigating to checkout

---

### Phase 4: Frontend - Checkout Integration

**Files to modify:**
- `frontend/src/app/pages/checkout/checkout.component.ts`
- `frontend/src/app/pages/checkout/checkout.component.html`
- `frontend/src/app/services/order.service.ts` - Pass promotion code

**Logic:**
1. Display applied promotion from cart
2. Show price breakdown (subtotal, discount, total)
3. Pass `promotion_code` to order creation API
4. Handle promotion validation errors

**Validation to test:**
- [ ] Checkout shows discount from cart
- [ ] Order created with promotion applied
- [ ] Order confirmation shows discount details

---

### Phase 5: Admin - Promotions Management

**Files to create:**
- `frontend/src/app/pages/admin/admin-promotions/admin-promotions.component.ts`
- `frontend/src/app/pages/admin/admin-promotions/admin-promotions.component.html`
- `frontend/src/app/pages/admin/admin-promotions/admin-promotions.component.scss`

**Files to modify:**
- `frontend/src/app/app.routes.ts` - Add admin promotions route
- `frontend/src/app/pages/admin/admin-layout/admin-layout.component.ts` - Add menu item
- `frontend/src/assets/i18n/*.json` - Add admin translations

**Features:**
- List promotions with status indicators
- Create new promotion form
- Edit existing promotion
- Delete promotion (with confirmation)
- Toggle active/inactive
- View usage statistics

**Validation to test:**
- [ ] List promotions displays correctly
- [ ] Create promotion with all fields
- [ ] Edit promotion updates correctly
- [ ] Delete promotion works
- [ ] Translations work in all languages

---

### Phase 6: Product Display (Sale Badges)

**Files to modify:**
- `frontend/src/app/pages/products/components/product-card/product-card.component.ts`
- `frontend/src/app/pages/products/components/product-card/product-card.component.html`
- `frontend/src/app/pages/products/product-detail/product-detail.component.ts`
- `frontend/src/app/pages/products/product-detail/product-detail.component.html`

**Features:**
- Show "SALE" badge on discounted products
- Display original price crossed out
- Show discounted price
- Indicate discount percentage

**Validation to test:**
- [ ] Products with active promotions show sale badge
- [ ] Original and discounted prices displayed correctly
- [ ] Product detail page shows promotion info

---

## API Request/Response Examples

### Create Promotion

**Request:**
```json
POST /api/v1/promotions/
{
  "name": "Summer Sale",
  "description": "20% off all products",
  "code": "SUMMER20",
  "discount_type": "percentage",
  "discount_value": 20,
  "scope": "global",
  "min_order_amount": 0,
  "max_discount": 50,
  "start_date": "2024-06-01T00:00:00",
  "end_date": "2024-08-31T23:59:59",
  "is_active": true,
  "name_translations": {
    "en": "Summer Sale",
    "fr": "Soldes d'été",
    "ar": "تخفيضات الصيف"
  },
  "description_translations": {
    "en": "20% off all products",
    "fr": "20% de réduction sur tous les produits",
    "ar": "خصم 20% على جميع المنتجات"
  }
}
```

**Response:**
```json
{
  "id": 1,
  "name": "Summer Sale",
  "code": "SUMMER20",
  "discount_type": "percentage",
  "discount_value": 20,
  "scope": "global",
  "is_active": true,
  "usage_count": 0,
  "created_at": "2024-05-15T10:30:00"
}
```

### Validate Promo Code

**Request:**
```json
GET /api/v1/promotions/code/SUMMER20
```

**Response (valid):**
```json
{
  "valid": true,
  "promotion": {
    "id": 1,
    "name": "Summer Sale",
    "discount_type": "percentage",
    "discount_value": 20,
    "scope": "global",
    "min_order_amount": 0,
    "max_discount": 50
  }
}
```

**Response (invalid):**
```json
{
  "valid": false,
  "error": "Promotion code has expired"
}
```

### Calculate Discount

**Request:**
```json
POST /api/v1/promotions/calculate
{
  "promotion_code": "SUMMER20",
  "cart_items": [
    {"product_id": 1, "quantity": 2, "unit_price": 10.00},
    {"product_id": 2, "quantity": 1, "unit_price": 25.00}
  ]
}
```

**Response:**
```json
{
  "subtotal": 45.00,
  "discount_amount": 9.00,
  "total": 36.00,
  "promotion": {
    "id": 1,
    "name": "Summer Sale",
    "code": "SUMMER20"
  }
}
```

---

## Translation Keys

Add to `frontend/src/assets/i18n/*.json`:

```json
{
  "promotions": {
    "title": "Promotions",
    "promo_code": "Promo Code",
    "apply": "Apply",
    "remove": "Remove",
    "discount": "Discount",
    "subtotal": "Subtotal",
    "total": "Total",
    "invalid_code": "Invalid promo code",
    "expired_code": "This promo code has expired",
    "code_applied": "Promo code applied!",
    "min_order_required": "Minimum order of {{amount}} required",
    "usage_limit_reached": "This promo code has reached its usage limit",
    "sale": "SALE",
    "off": "OFF"
  },
  "admin": {
    "promotions": {
      "title": "Promotions",
      "create": "Create Promotion",
      "edit": "Edit Promotion",
      "delete": "Delete Promotion",
      "name": "Name",
      "code": "Code",
      "discount_type": "Discount Type",
      "discount_value": "Discount Value",
      "scope": "Scope",
      "category": "Category",
      "brand": "Brand",
      "product": "Product",
      "min_order": "Minimum Order",
      "max_discount": "Maximum Discount",
      "usage_limit": "Usage Limit",
      "usage_count": "Times Used",
      "start_date": "Start Date",
      "end_date": "End Date",
      "status": "Status",
      "active": "Active",
      "inactive": "Inactive",
      "expired": "Expired",
      "scheduled": "Scheduled",
      "percentage": "Percentage",
      "fixed_amount": "Fixed Amount",
      "global": "All Products",
      "create_success": "Promotion created successfully",
      "update_success": "Promotion updated successfully",
      "delete_success": "Promotion deleted successfully",
      "confirm_delete": "Are you sure you want to delete this promotion?"
    }
  }
}
```

---

## Testing Checklist

### Backend Tests
- [ ] Promotion CRUD operations
- [ ] Promo code validation (valid, expired, inactive, usage limit)
- [ ] Discount calculation (percentage, fixed, with cap)
- [ ] Scope filtering (global, category, brand, product)
- [ ] Order creation with promotion
- [ ] Usage tracking increments

### Frontend Tests
- [ ] Promo code input and validation
- [ ] Discount display in cart
- [ ] Discount display in checkout
- [ ] Order confirmation shows discount
- [ ] Admin CRUD for promotions
- [ ] Translations in all languages
- [ ] Sale badges on products

### Edge Cases
- [ ] Promotion with 0 discount value
- [ ] Promotion with past end date
- [ ] Promotion with future start date
- [ ] Multiple products, some in scope, some not
- [ ] Discount greater than order total (should cap at order total)
- [ ] Empty cart with promo code

---

## File Structure After Implementation

```
backend/
├── app/
│   ├── models/
│   │   ├── promotion.py          # NEW
│   │   └── order.py              # MODIFIED
│   └── api/api_v1/
│       ├── endpoints/
│       │   ├── promotions.py     # NEW
│       │   └── orders.py         # MODIFIED
│       └── api.py                # MODIFIED
└── migrations/
    └── add_promotions.sql        # NEW

frontend/
├── src/app/
│   ├── models/
│   │   └── promotion.model.ts    # NEW
│   ├── services/
│   │   ├── promotion.service.ts  # NEW
│   │   ├── cart.service.ts       # MODIFIED
│   │   └── order.service.ts      # MODIFIED
│   └── pages/
│       ├── cart/
│       │   └── cart.component.*  # MODIFIED
│       ├── checkout/
│       │   └── checkout.component.* # MODIFIED
│       └── admin/
│           └── admin-promotions/ # NEW
└── src/assets/i18n/
    ├── en.json                   # MODIFIED
    ├── fr.json                   # MODIFIED
    └── ar.json                   # MODIFIED
```

---

## Notes

- All prices should use 2 decimal places
- Discount cannot exceed order subtotal
- Promotions with `usage_limit` should be atomic (prevent race conditions)
- Expired promotions should not be deletable if they have usage history
- Consider soft delete for promotions with usage history
