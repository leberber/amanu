// src/app/models/notification.model.ts

// Segment types for targeting
export type SegmentType = 'all' | 'inactive_30' | 'inactive_60' | 'vip' | 'new_users' | 'by_city';

// Notification content types
export type NotificationType = 'custom' | 'promotion' | 'product' | 'category' | 'brand';

// Notification status
export type NotificationStatus = 'pending' | 'sent' | 'scheduled' | 'failed';

// Segment info from API
export interface SegmentInfo {
  segment_type: SegmentType;
  label: string;
  count: number;
  description: string;
}

// City statistics
export interface CityStat {
  city: string;
  count: number;
}

// Notification history record
export interface NotificationHistory {
  id: number;
  title_en: string;
  title_fr?: string;
  title_ar?: string;
  body_en: string;
  body_fr?: string;
  body_ar?: string;
  url: string;
  image_url?: string;
  segment_type: SegmentType;
  segment_value?: string;
  notification_type: NotificationType;
  target_id?: number;
  status: NotificationStatus;
  sent_count: number;
  failed_count: number;
  scheduled_at?: string;
  sent_at?: string;
  created_by: number;
  created_at: string;
}

// Request to send targeted notification
export interface TargetedNotificationRequest {
  title_en: string;
  title_fr?: string;
  title_ar?: string;
  body_en: string;
  body_fr?: string;
  body_ar?: string;
  url?: string;
  image_url?: string;
  segment_type: SegmentType;
  segment_value?: string;
  notification_type: NotificationType;
  target_id?: number;
  scheduled_at?: string;
}

// Response from send notification
export interface SendNotificationResponse {
  message: string;
  sent?: number;
  failed?: number;
  scheduled?: boolean;
  recipient_count?: number;
}

// Promotion item for builder
export interface PromotionItem {
  id: number;
  name_en: string;
  name_fr: string;
  name_ar: string;
  description_en?: string;
  description_fr?: string;
  description_ar?: string;
  discount_type: string;
  discount_value: number;
  code?: string;
}

// Product item for builder
export interface ProductItem {
  id: number;
  name_en: string;
  name_fr: string;
  name_ar: string;
  image_url?: string;
  price: number;
}

// Category item for builder
export interface CategoryItem {
  id: number;
  name_en: string;
  name_fr: string;
  name_ar: string;
  image_url?: string;
}

// Brand item for builder
export interface BrandItem {
  id: number;
  name_en: string;
  name_fr: string;
  name_ar: string;
  logo_url?: string;
}

// Notification template
export interface NotificationTemplate {
  id: string;
  name: string;
  icon: string;
  title_en: string;
  title_fr: string;
  title_ar: string;
  body_en: string;
  body_fr: string;
  body_ar: string;
}
