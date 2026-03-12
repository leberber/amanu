/**
 * Trip models for order batching and multi-stop deliveries.
 * A Trip groups multiple orders for a single driver route.
 */

export type TripStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
export type StopStatus = 'pending' | 'arrived' | 'delivered' | 'failed';

export interface TripStop {
  id: number;
  trip_id: number;
  order_id: number;
  sequence: number;
  status: StopStatus;
  estimated_arrival?: string;
  arrived_at?: string;
  delivered_at?: string;
  notes?: string;

  // Order details (populated by endpoint)
  customer_name?: string;
  shipping_address?: string;
  contact_phone?: string;
  order_total?: number;
}

export interface Trip {
  id: number;
  driver_id?: number;
  status: TripStatus;
  total_weight_kg: number;
  total_volume_m3: number;
  estimated_distance_km: number;
  estimated_duration_min: number;
  h3_zone?: string;
  total_earnings: number;
  created_at: string;
  updated_at?: string;
  assigned_at?: string;
  started_at?: string;
  completed_at?: string;

  // Stop count
  total_stops: number;
  completed_stops: number;

  // Driver info (populated by endpoint)
  driver_name?: string;
  driver_phone?: string;
}

export interface TripWithStops extends Trip {
  stops: TripStop[];
}

// Create/Update models
export interface TripCreate {
  order_ids: number[];
  h3_zone?: string;
}

export interface TripStopUpdate {
  status?: StopStatus;
  notes?: string;
}

export interface TripUpdate {
  status?: TripStatus;
  driver_id?: number;
}

// API Response models
export interface AssignTripRequest {
  driver_id: number;
}

export interface AssignTripResponse {
  success: boolean;
  message: string;
  trip?: TripWithStops;
}

export interface BatchingPreviewResponse {
  orders_available: number;
  proposed_trips: ProposedTrip[];
  orders_to_batch: number;
  unbatched_orders: number;
  unbatched_orders_list: UnbatchedOrder[];
}

export interface UnbatchedOrder {
  order_id: number;
  customer_name: string;
  address: string;
  zone: string;
  reason: string;
  shipping_cost: number;
}

export interface ProposedTrip {
  zone: string;
  order_count: number;
  order_ids: number[];
  total_weight_kg: number;
  total_earnings: number;
  customers: ProposedTripCustomer[];
}

export interface ProposedTripCustomer {
  order_id: number;
  name: string;
  address: string;
}

export interface BatchingRunResponse {
  success: boolean;
  message: string;
  orders_processed: number;
  trips_created: number;
  trips: BatchedTripSummary[];
}

export interface BatchedTripSummary {
  id: number;
  zone?: string;
  stops: number;
  total_weight_kg: number;
  total_earnings: number;
}

export interface BatchingStats {
  pending_batchable_orders: number;
  pending_trips: number;
  assigned_trips: number;
  in_progress_trips: number;
  completed_trips_today: number;
  total_trips: number;
}

// Driver available order model
export interface AvailableOrder {
  order: import('./order.model').Order;
  is_full_load: boolean;
  earnings: number;
}

export interface PickupOrderResponse {
  success: boolean;
  message: string;
  order?: import('./order.model').Order;
}

// Drag-drop batching models
export interface PendingOrder {
  id: number;
  customer_name: string;
  address: string;
  zone: string;
  shipping_cost: number;
  weight_kg: number;
  created_at?: string;
  latitude?: number;
  longitude?: number;
}

export interface PendingOrdersResponse {
  orders: PendingOrder[];
  total: number;
}

export interface CustomBatch {
  order_ids: number[];
  orders: PendingOrder[];  // For UI display
  zone?: string;           // Optional zone label
}

export interface CustomBatchingRequest {
  batches: { order_ids: number[] }[];
}
