# Known Bugs

## Stock Page - Row Disappears on Windows Chrome

**Status:** Open
**Platform:** Windows Chrome only
**Component:** `frontend/src/app/pages/stock/stock.component.ts`

### Description
When creating a new product row and focusing on the `nmbCarton` input field, the entire row disappears. This only happens on Windows Chrome, not on Mac.

### Steps to Reproduce
1. Go to Stock page
2. Click "Add Row" to create a new product
3. Fill in Prix Achat and Prix Carton
4. Click into the "Nbr Carton" input field
5. The row disappears

### Root Cause
PrimeNG's `p-inputNumber` component fires `ngModelChange` on focus in Windows Chrome (but not on Mac). This triggers `onNmbCartonChange()` which calls `allRows.update()`, causing `filteredRows` to recompute. Since new rows have empty `brand` and `category` values, they get filtered out by active filters or don't match search queries.

**Event chain:**
1. Focus on nmbCarton input (Windows Chrome fires ngModelChange)
2. `onNmbCartonChange()` runs
3. `this.allRows.update(rows => [...rows])` triggers signal update
4. `filteredRows` computed signal recomputes
5. New row (empty brand/category) gets filtered out
6. Row disappears from DOM

### Proposed Fix
Add `r.id < 0 ||` check to all filter conditions in `filteredRows` computed signal to always include new rows (negative IDs):

```typescript
// In filteredRows computed signal
if (catFilter && catFilter.length > 0) {
  rows = rows.filter(r => r.id < 0 || catFilter.includes(r.category));
}

if (brandFilter && brandFilter.length > 0) {
  rows = rows.filter(r => r.id < 0 || brandFilter.includes(r.brand));
}

if (prioFilter && prioFilter.length > 0) {
  rows = rows.filter(r => r.id < 0 || prioFilter.includes(r.priority));
}

if (this.searchQuery().trim()) {
  const search = this.searchQuery().toLowerCase();
  rows = rows.filter(r =>
    r.id < 0 ||
    r.name.toLowerCase().includes(search) ||
    r.category.toLowerCase().includes(search) ||
    r.brand.toLowerCase().includes(search)
  );
}
```

### Why Windows Chrome Differs
- Windows Chrome may fire `ngModelChange` on focus or first keydown
- Different IME (Input Method Editor) handling on Windows
- PrimeNG InputNumber locale/number parsing differences
- Spin button interaction triggers events differently
