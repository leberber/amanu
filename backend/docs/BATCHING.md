# Delivery Batching System

This document explains how the delivery batching system works, including route pre-computation and batch creation.

## Overview

The batching system groups customer orders into efficient delivery batches using pre-computed route data from Google Directions API.

**Key concept:** Routes from depot to each customer are computed ONCE and stored in the database. Batching then uses this stored data for instant grouping without additional API calls.

## Data Model

### CustomerRoute Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | int | Primary key |
| `user_id` | int | Customer user ID (unique) |
| `distance_meters` | int | Route distance in meters |
| `duration_seconds` | int | Estimated travel time |
| `route_geom` | LINESTRING | PostGIS geometry of the route path |
| `heading` | float | Initial bearing from depot (0-360°) |
| `corridor` | string | Direction label, e.g., "Direction Ouadhia" |
| `fetched_at` | timestamp | When the route was fetched |

### Heading (Direction)

The `heading` is the initial bearing when leaving the depot:
- 0° = North
- 90° = East
- 180° = South
- 270° = West

This allows grouping customers by the direction they're in relative to the depot.

### Corridor

The `corridor` is a human-readable label combining direction with the customer's commune:
- "Direction Ouadhia"
- "Direction Tizi-Ouzou"
- "Direction Ait Khelfa"

## Batching Logic

### 1. Group by Corridor
Orders are first grouped by corridor (destination commune area).

### 2. Sort by Heading within Corridor
Within each corridor, customers are sorted by heading to create a logical route order.

### 3. Sort by Distance
Finally, sort by distance (nearest or farthest first depending on strategy).

### Example

```
Corridor: "Direction Ouadhia" (27 customers)
├── Customer A: 2.5 km, heading 125°
├── Customer B: 3.2 km, heading 128°
├── Customer C: 4.1 km, heading 130°
└── ... sorted by heading, then distance

Corridor: "Direction Tizi-Ouzou" (10 customers)
├── Customer X: 5.0 km, heading 302°
├── Customer Y: 6.3 km, heading 305°
└── ...
```

## API Endpoints

All endpoints require **Admin authentication**.

### Fetch Routes

#### Fetch missing routes only
```
POST /api/v1/admin/routes/fetch-all
```
Fetches routes for customers without existing routes. Skips customers who already have routes.

**Response:**
```json
{
  "total_customers": 64,
  "fetched": 5,
  "failed": 0,
  "skipped": 59
}
```

#### Re-fetch ALL routes
```
POST /api/v1/admin/routes/refetch-all
```
Re-fetches routes for ALL customers, overwriting existing data. Use when you need fresh route data.

**Response:**
```json
{
  "total_customers": 64,
  "fetched": 64,
  "failed": 0,
  "skipped": 0
}
```

#### Fetch single customer route
```
POST /api/v1/admin/routes/fetch
Content-Type: application/json

{
  "user_id": 123
}
```

### View Routes

#### List all routes
```
GET /api/v1/admin/routes/
```

#### List routes by corridor
```
GET /api/v1/admin/routes/?corridor=Direction%20Ouadhia
```

#### Get corridor statistics
```
GET /api/v1/admin/routes/stats
```

**Response:**
```json
[
  {
    "corridor": "Direction Ouadhia",
    "count": 27,
    "total_distance_km": 78.5,
    "avg_distance_km": 2.9
  },
  {
    "corridor": "Direction Ait Khelfa",
    "count": 10,
    "total_distance_km": 112.0,
    "avg_distance_km": 11.2
  }
]
```

#### Get single customer route
```
GET /api/v1/admin/routes/{user_id}
```

### Delete Routes

#### Delete single route
```
DELETE /api/v1/admin/routes/{user_id}
```

#### Delete all routes
```
DELETE /api/v1/admin/routes/
```

## Using Swagger UI

1. Go to `http://localhost:8000/docs`
2. Click **Authorize** (top right)
3. Enter your admin access token
4. Find **Customer Routes** section
5. Click **Try it out** on any endpoint

## Configuration

### Environment Variables

```env
# Google Maps API key (required for route fetching)
GOOGLE_MAPS_API_KEY=your_api_key_here

# Depot location (warehouse)
DEPOT_LATITUDE=36.549608
DEPOT_LONGITUDE=4.099945
DEPOT_NAME=Entrepôt Elsuq - Ouadhia
```

### Config File

Located at `app/core/config.py`:
```python
DEPOT_LATITUDE: float = float(os.getenv("DEPOT_LATITUDE", "36.549608"))
DEPOT_LONGITUDE: float = float(os.getenv("DEPOT_LONGITUDE", "4.099945"))
```

## Database

### Check stored routes
```sql
SELECT corridor, COUNT(*) as count,
       ROUND(AVG(distance_meters)/1000.0, 1) as avg_km
FROM customer_routes
GROUP BY corridor
ORDER BY count DESC;
```

### View route geometry
```sql
SELECT user_id, corridor, heading,
       ST_AsGeoJSON(route_geom) as geojson
FROM customer_routes
LIMIT 5;
```

## When to Re-fetch Routes

Re-fetch routes when:
- Depot location changes
- Road network changes significantly
- Customer address is updated
- You need fresh traffic-based duration estimates

For individual customer address changes, use the single fetch endpoint:
```
POST /api/v1/admin/routes/fetch
{"user_id": 123}
```
