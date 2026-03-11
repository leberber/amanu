import { DRIVER_STATUS, VEHICLE_TYPE, DriverStatus, VehicleType } from '../core/constants/driver.constants';
import { Order } from './order.model';

/**
 * Driver Vehicle interface
 */
export interface DriverVehicle {
  id: number;
  driver_id: number;
  vehicle_type: VehicleType;
  capacity_kg?: number;
  capacity_volume?: number;
  license_plate?: string;
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
}

/**
 * Driver Read interface (from API)
 * Stats are computed from orders, not stored
 */
export interface DriverRead {
  id: number;
  user_id: number;
  status: DriverStatus;
  is_available: boolean;
  max_active_orders: number;
  created_at: string;
  updated_at?: string;

  // Primary vehicle info (convenience fields from endpoint)
  vehicle_type?: VehicleType;
  capacity_kg?: number;
  capacity_volume?: number;

  // Computed stats (populated by endpoint from orders)
  active_orders_count: number;
  total_deliveries: number;
  total_earnings: number;
  average_rating?: number;
  total_ratings: number;
}

/**
 * @deprecated Use DriverRead instead
 */
export type DriverProfile = DriverRead;

export interface DriverReadWithFlags extends DriverRead {
  cancellation_count: number;
  is_flagged: boolean;
  flag_reason?: string;
  flagged_at?: string;
  suspended_until?: string;
  // User info (populated by endpoint)
  full_name?: string;
  phone?: string;
  email?: string;
}

/**
 * @deprecated Use DriverReadWithFlags instead
 */
export type DriverProfileWithFlags = DriverReadWithFlags;

export interface DriverUpdate {
  is_available?: boolean;
  status?: DriverStatus;
}

/**
 * @deprecated Use DriverUpdate instead
 */
export type DriverProfileUpdate = DriverUpdate;

export interface DriverAdminUpdate extends DriverUpdate {
  max_active_orders?: number;
  is_flagged?: boolean;
  flag_reason?: string;
  suspended_until?: string;
}

/**
 * @deprecated Use DriverAdminUpdate instead
 */
export type DriverProfileAdminUpdate = DriverAdminUpdate;

/**
 * Driver with User info (API response)
 */
export interface DriverWithProfile {
  id: number;
  email: string;
  full_name: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  driver?: DriverRead;
  /** @deprecated Use driver instead */
  driver_profile?: DriverRead;
}

/**
 * Driver Registration
 */
export interface DriverRegister {
  email: string;
  full_name: string;
  phone: string;
  password: string;
  vehicle_type: VehicleType;
  capacity_kg?: number;
  capacity_volume?: number;
}

export interface ConvertToDriver {
  full_name: string;
  phone: string;
  vehicle_type: VehicleType;
  capacity_kg?: number;
  capacity_volume?: number;
}

/**
 * Trip interfaces
 */
export interface TripStatusUpdate {
  notes?: string;
}

export interface CancelTripRequest {
  reason: string;
}

export interface AcceptTripResponse {
  success: boolean;
  message: string;
  order?: Order;
}

/**
 * Driver Stats
 */
export interface DriverStats {
  total_deliveries: number;
  total_earnings: number;
  average_rating?: number;
  total_ratings: number;
  active_orders_count: number;
  cancellation_count: number;
  deliveries_today: number;
  earnings_today: number;
  deliveries_this_week: number;
  earnings_this_week: number;
}

/**
 * Driver Earnings
 */
export interface DriverEarning {
  order_id: number;
  amount: number;
  delivered_at: string;
  customer_name: string;
  delivery_address: string;
}

export interface DriverEarningsResponse {
  total_earnings: number;
  earnings_today: number;
  earnings_this_week: number;
  earnings_this_month: number;
  recent_earnings: DriverEarning[];
}

/**
 * Driver Status Update
 */
export interface DriverStatusUpdate {
  status: DriverStatus;
}

export interface DriverStatusResponse {
  success: boolean;
  status: DriverStatus;
  is_available: boolean;
}

/**
 * Driver System Config
 */
export interface DriverSystemConfig {
  id: number;
  assignment_timeout_minutes: number;
  max_active_orders_default: number;
  max_cancellations_per_period: number;
  cancellation_period_days: number;
  auto_flag_on_max_cancellations: boolean;
  auto_suspend_on_max_cancellations: boolean;
  suspension_duration_hours: number;
  base_delivery_fee: number;
  per_km_rate: number;
  driver_commission_percent: number;
  allow_driver_self_assign: boolean;
  require_admin_approval: boolean;
  notify_driver_on_new_order: boolean;
  created_at: string;
  updated_at?: string;
}

export interface DriverSystemConfigUpdate {
  assignment_timeout_minutes?: number;
  max_active_orders_default?: number;
  max_cancellations_per_period?: number;
  cancellation_period_days?: number;
  auto_flag_on_max_cancellations?: boolean;
  auto_suspend_on_max_cancellations?: boolean;
  suspension_duration_hours?: number;
  base_delivery_fee?: number;
  per_km_rate?: number;
  driver_commission_percent?: number;
  allow_driver_self_assign?: boolean;
  require_admin_approval?: boolean;
  notify_driver_on_new_order?: boolean;
}

/**
 * Admin Assignment interfaces
 */
export interface AssignOrderRequest {
  driver_id: number;
  estimated_delivery_minutes?: number;
}

export interface AssignOrderResponse {
  success: boolean;
  message: string;
  order?: Order;
}

export interface FlagDriverRequest {
  reason: string;
}

export interface SuspendDriverRequest {
  reason: string;
  duration_hours: number;
}

/**
 * Driver System Stats (admin view)
 */
export interface DriverSystemStats {
  total_drivers: number;
  active_drivers: number;
  available_drivers: number;
  busy_drivers: number;
  suspended_drivers: number;
  flagged_drivers: number;
  orders_in_pool: number;
  orders_assigned: number;
  orders_in_transit: number;
  deliveries_today: number;
}

/**
 * Re-export constants for convenience
 */
export { DRIVER_STATUS, VEHICLE_TYPE } from '../core/constants/driver.constants';
