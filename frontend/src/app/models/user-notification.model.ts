export type UserNotificationType =
  | 'order_confirmed'
  | 'order_shipped'
  | 'order_delivered'
  | 'order_cancelled'
  | 'payment_received'
  | 'trip_assigned'
  | 'promotion'
  | 'system';

export interface UserNotification {
  id: number;
  user_id: number;
  type: UserNotificationType;
  title: string;
  message: string;
  title_translations?: Record<string, string>;
  message_translations?: Record<string, string>;
  reference_id?: number;
  reference_type?: string;
  url?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export interface UnreadCountResponse {
  count: number;
}
