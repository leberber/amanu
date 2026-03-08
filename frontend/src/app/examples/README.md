# Examples

Reference components for implementation. Copy and adapt as needed.

## Available Examples

### maps-navigation
Opens Google Maps with multiple delivery stops.

**Usage:**
```typescript
import { MapsNavigationExampleComponent } from './examples/maps-navigation/maps-navigation.component';

// In your template
<app-maps-navigation-example />
```

**To test:** Add a route temporarily:
```typescript
// In app.routes.ts
{
  path: 'example/maps',
  loadComponent: () => import('./examples/maps-navigation/maps-navigation.component')
    .then(m => m.MapsNavigationExampleComponent)
}
```

Then visit: `http://localhost:4200/example/maps`

---

## How to Use in Real Components

```typescript
// In trip-details.component.ts
openNavigation(trip: Trip) {
  const origin = `${WAREHOUSE_LAT},${WAREHOUSE_LNG}`;

  const stops = trip.orders
    .sort((a, b) => a.delivery_sequence - b.delivery_sequence)
    .map(o => `${o.destination_lat},${o.destination_lng}`)
    .join('/');

  window.open(`https://www.google.com/maps/dir/${origin}/${stops}`, '_blank');
}
```
