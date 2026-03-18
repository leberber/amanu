# Sales Report Cross-Filtering Implementation Guide

This document describes how to implement interactive cross-filtering for the sales report dashboard. When clicking on a category, brand, or product, all charts will filter to show only data related to that selection.

## Overview

- Click on a **category** pie chart segment → filters all charts to that category
- Click on a **brand** pie chart segment → filters all charts to that brand
- Click on a **product** bar → filters all charts to that product
- A filter chip appears showing the active filter with a clear button

---

## 1. Backend Changes

### File: `backend/app/api/api_v1/endpoints/admin.py`

Add filter parameters to the `get_sales_report` function:

```python
@router.get("/sales-report", response_model=SalesReport)
def get_sales_report(
    period: str = Query(..., enum=["daily", "weekly", "monthly", "yearly"]),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    category_limit: Optional[int] = Query(default=10, ge=1, le=100),
    product_limit: Optional[int] = Query(default=10, ge=1, le=50),
    category_id: Optional[int] = Query(default=None, description="Filter by category"),  # NEW
    brand_id: Optional[int] = Query(default=None, description="Filter by brand"),        # NEW
    product_id: Optional[int] = Query(default=None, description="Filter by product"),    # NEW
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
```

After the `base_filter` definition, add:

```python
# Build product filter conditions for cross-filtering
product_filters = []
if category_id:
    product_filters.append(Product.category_id == category_id)
if brand_id:
    product_filters.append(Product.brand_id == brand_id)
if product_id:
    product_filters.append(Product.id == product_id)

has_product_filter = bool(product_filters)
```

### Update Time Series Queries (daily, weekly, monthly, yearly)

For each period type, add a conditional query that joins with OrderItem and Product when filtering:

```python
if period == "daily":
    if has_product_filter:
        query = (
            select(
                cast(Order.created_at, Date).label("day"),
                func.sum(OrderItem.unit_price * OrderItem.quantity).label("sales")
            )
            .select_from(Order)
            .join(OrderItem, OrderItem.order_id == Order.id)
            .join(Product, Product.id == OrderItem.product_id)
            .where(*base_filter, *product_filters)
            .group_by(cast(Order.created_at, Date))
            .order_by(cast(Order.created_at, Date))
        )
    else:
        # Original query without filter
        query = select(...)
```

Repeat similar pattern for weekly, monthly, yearly.

### Update Category Query

Apply brand and product filters (not category filter):

```python
category_extra_filters = []
if brand_id:
    category_extra_filters.append(Product.brand_id == brand_id)
if product_id:
    category_extra_filters.append(Product.id == product_id)

category_sales_query = (
    ...
    .where(*base_filter, *category_extra_filters)
    ...
)
```

### Update Brand Query

Apply category and product filters (not brand filter):

```python
brand_extra_filters = []
if category_id:
    brand_extra_filters.append(Product.category_id == category_id)
if product_id:
    brand_extra_filters.append(Product.id == product_id)

brand_query = (
    ...
    .where(*base_filter, *brand_extra_filters)
    ...
)
```

### Update Products Query

Apply category and brand filters (not product filter):

```python
products_extra_filters = []
if category_id:
    products_extra_filters.append(Product.category_id == category_id)
if brand_id:
    products_extra_filters.append(Product.brand_id == brand_id)

top_products_query = (
    ...
    .where(*base_filter, *products_extra_filters)
    ...
)
```

---

## 2. Frontend Service Changes

### File: `frontend/src/app/services/admin.service.ts`

Update `getSalesReport` to accept filter parameters:

```typescript
getSalesReport(
  period: 'daily' | 'weekly' | 'monthly' | 'yearly',
  startDate?: string,
  endDate?: string,
  categoryLimit?: number,
  productLimit?: number,
  categoryId?: number,    // NEW
  brandId?: number,       // NEW
  productId?: number      // NEW
): Observable<SalesReport> {
  let params: any = { period };

  // ... existing params ...

  // Cross-filter parameters
  if (categoryId) {
    params.category_id = categoryId;
  }
  if (brandId) {
    params.brand_id = brandId;
  }
  if (productId) {
    params.product_id = productId;
  }

  return this.apiService.get<SalesReport>('/admin/sales-report', { params });
}
```

---

## 3. Chart Component Changes

### File: `frontend/src/app/shared/components/charts/doughnut-chart.component.ts`

Add output event and click handler:

```typescript
import { Component, input, output, computed, inject, DestroyRef, OnInit } from '@angular/core';

export interface DoughnutChartItem {
  id?: number;  // ADD THIS
  label: string;
  value: number;
}

export interface DoughnutChartClickEvent {
  index: number;
  item: DoughnutChartItem;
}

@Component({...})
export class DoughnutChartComponent {
  // ... existing inputs ...

  // Add output
  itemClick = output<DoughnutChartClickEvent>();

  // In chartOptions computed, add onHover for cursor:
  chartOptions = computed(() => {
    return {
      // ... existing options ...
      onHover: (event: { native: MouseEvent }, elements: unknown[]) => {
        const canvas = event.native?.target as HTMLCanvasElement;
        if (canvas) {
          canvas.style.cursor = elements.length > 0 ? 'pointer' : 'default';
        }
      },
      // ... rest of options ...
    };
  });

  // Add click handler
  onChartClick(event: { element: { index: number } }) {
    if (event?.element) {
      const index = event.element.index;
      const items = this.data();
      if (index >= 0 && index < items.length) {
        this.itemClick.emit({ index, item: items[index] });
      }
    }
  }
}
```

Update template:
```html
<p-chart type="doughnut" [data]="chartData()" [options]="chartOptions()" (onDataSelect)="onChartClick($event)"></p-chart>
```

### File: `frontend/src/app/shared/components/charts/bar-chart.component.ts`

Same pattern - add `id` to interface, add `itemClick` output, add `onChartClick` handler.

### File: `frontend/src/app/shared/components/charts/index.ts`

Export new types:
```typescript
export type { DoughnutChartItem, ChartColorScheme, DoughnutChartClickEvent } from './doughnut-chart.component';
export type { BarChartDataPoint, BarChartColor, BarChartClickEvent } from './bar-chart.component';
```

---

## 4. Main Component Changes

### File: `admin-sales-report.component.ts`

Add imports:
```typescript
import {
  // ... existing ...
  DoughnutChartClickEvent,
  BarChartClickEvent
} from '../../../shared/components/charts';
```

Add filter state signals:
```typescript
// Cross-filter signals
filterCategoryId = signal<number | null>(null);
filterCategoryName = signal<string>('');
filterBrandId = signal<number | null>(null);
filterBrandName = signal<string>('');
filterProductId = signal<number | null>(null);
filterProductName = signal<string>('');

// Computed
hasActiveFilter = computed(() => {
  return this.filterCategoryId() !== null ||
         this.filterBrandId() !== null ||
         this.filterProductId() !== null;
});
```

Update `prepareChartData` to include IDs:
```typescript
// Categories
report.sales_by_category.map(item => ({
  id: item.category_id,  // ADD THIS
  label: this.translationHelper.getCategoryName(item),
  value: item.total_sales
}))

// Brands
report.sales_by_brand.map(item => ({
  id: item.brand_id,  // ADD THIS
  label: this.translationHelper.getBrandName(item),
  value: item.total_sales
}))

// Products
report.top_products.map(item => ({
  id: item.product_id,  // ADD THIS
  label: this.translationHelper.getProductName(item),
  value: item.total_sales
}))
```

Update `loadReport` to pass filters:
```typescript
this.adminService.getSalesReport(
  this.selectedPeriod(),
  undefined,
  undefined,
  this.selectedCategoryLimit(),
  this.selectedProductLimit(),
  this.filterCategoryId() ?? undefined,
  this.filterBrandId() ?? undefined,
  this.filterProductId() ?? undefined
)
```

Add click handlers:
```typescript
onCategoryClick(event: DoughnutChartClickEvent) {
  if (event.item.id) {
    this.filterCategoryId.set(event.item.id);
    this.filterCategoryName.set(event.item.label);
    this.filterBrandId.set(null);
    this.filterBrandName.set('');
    this.filterProductId.set(null);
    this.filterProductName.set('');
    this.loadReport();
  }
}

onBrandClick(event: DoughnutChartClickEvent) {
  if (event.item.id) {
    this.filterBrandId.set(event.item.id);
    this.filterBrandName.set(event.item.label);
    this.filterCategoryId.set(null);
    this.filterCategoryName.set('');
    this.filterProductId.set(null);
    this.filterProductName.set('');
    this.loadReport();
  }
}

onProductClick(event: BarChartClickEvent) {
  if (event.item.id) {
    this.filterProductId.set(event.item.id);
    this.filterProductName.set(event.item.label);
    this.filterCategoryId.set(null);
    this.filterCategoryName.set('');
    this.filterBrandId.set(null);
    this.filterBrandName.set('');
    this.loadReport();
  }
}

clearFilter() {
  this.filterCategoryId.set(null);
  this.filterCategoryName.set('');
  this.filterBrandId.set(null);
  this.filterBrandName.set('');
  this.filterProductId.set(null);
  this.filterProductName.set('');
  this.loadReport();
}
```

---

## 5. Template Changes

### File: `admin-sales-report.component.html`

Add click handlers to charts:
```html
<app-doughnut-chart
  [data]="topCategoryChartData()"
  ...
  (itemClick)="onCategoryClick($event)"
/>

<app-doughnut-chart
  [data]="topBrandChartData()"
  ...
  (itemClick)="onBrandClick($event)"
/>

<app-bar-chart
  [data]="productsChartData()"
  ...
  (itemClick)="onProductClick($event)"
/>
```

Add filter indicator after period selector:
```html
@if (hasActiveFilter()) {
  <div class="active-filter">
    <div class="filter-chip">
      <i class="pi pi-filter"></i>
      <span class="filter-chip__label">{{ 'admin.sales_report.filtered_by' | translate }}:</span>
      @if (filterCategoryName()) {
        <span class="filter-chip__value">{{ filterCategoryName() }}</span>
      }
      @if (filterBrandName()) {
        <span class="filter-chip__value">{{ filterBrandName() }}</span>
      }
      @if (filterProductName()) {
        <span class="filter-chip__value">{{ filterProductName() }}</span>
      }
      <button class="filter-chip__clear" (click)="clearFilter()">
        <i class="pi pi-times"></i>
      </button>
    </div>
  </div>
}
```

---

## 6. Style Changes

### File: `admin-sales-report.component.scss`

Add filter chip styles:
```scss
.active-filter {
  display: flex;
  justify-content: center;
  margin-bottom: var(--spacing-sm);
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(99, 102, 241, 0.05));
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 24px;
  font-size: 0.85rem;

  > i {
    color: var(--primary-color);
  }

  &__label {
    color: var(--text-color-secondary);
    font-weight: 500;
  }

  &__value {
    color: var(--primary-color);
    font-weight: 600;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__clear {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    cursor: pointer;
    transition: all 0.2s ease;

    i { font-size: 0.7rem; }

    &:hover {
      background: #ef4444;
      color: white;
    }
  }
}
```

---

## 7. Translation Changes

Add to all i18n files (`en.json`, `fr.json`, `ar.json`):

**English:**
```json
"filtered_by": "Filtered by"
```

**French:**
```json
"filtered_by": "Filtré par"
```

**Arabic:**
```json
"filtered_by": "تمت التصفية حسب"
```

---

## Summary

1. Backend: Add 3 filter query params, update all SQL queries to apply filters
2. Service: Pass filter params to API
3. Chart components: Add `itemClick` output event with `id` in data
4. Main component: Add filter state, click handlers, update API calls
5. Template: Bind click events, add filter chip UI
6. Styles: Add filter chip CSS
7. Translations: Add "filtered_by" key
