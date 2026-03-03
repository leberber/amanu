/**
 * Product-related constants
 * Contains product constraints, stock status, units, and packaging types
 */

// Product Constraints
export const PRODUCT = {
  MIN_PRICE: 0,
  MAX_PRICE: 999999.99,
  MIN_STOCK: 0,
  MAX_STOCK: 999999,
  MIN_QUANTITY: 1,
  MAX_QUANTITY: 100,
  DEFAULT_QUANTITY: 1,
  QUANTITY_STEP: 1,
  QUANTITY_INCREMENT: 5,
  LOW_STOCK_THRESHOLD: 10,
  MEDIUM_STOCK_THRESHOLD: 50,
  OUT_OF_STOCK_THRESHOLD: 0,
  IMAGE_MAX_SIZE: 5 * 1024 * 1024, // 5MB
  IMAGE_ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  // Grid display settings
  GRID_MAX_HEIGHT: 300,
  GRID_MIN_COLUMN_WIDTH: 60,
  // Content limits
  MAX_DESCRIPTION_LENGTH: 200,
  DEFAULT_DESCRIPTION: 'Quality wholesale products for your business.'
} as const;

// Stock Status
export const STOCK_STATUS = {
  IN_STOCK: 'in_stock',
  LOW_STOCK: 'low_stock',
  OUT_OF_STOCK: 'out_of_stock'
} as const;

// Type for stock status
export type StockStatusType = typeof STOCK_STATUS[keyof typeof STOCK_STATUS];

// Packaging types (lowercase to match backend enum)
export const PACKAGING_TYPES = ['box', 'carton', 'crate', 'pack', 'bag', 'bundle'] as const;
export type PackagingType = typeof PACKAGING_TYPES[number];

// Unit configurations (lowercase keys to match backend enum)
export interface UnitConfig {
  key: string;
  display: string;
  displayShort: string;
  factor?: number; // For conversion (e.g., pound to kg)
}

export const UNIT_CONFIGS: UnitConfig[] = [
  { key: 'kg', display: 'Kilogram', displayShort: 'Kg' },
  { key: 'gram', display: 'Gram', displayShort: 'g' },
  { key: 'piece', display: 'Piece', displayShort: 'Piece' },
  { key: 'bunch', display: 'Bunch', displayShort: 'Bunch' },
  { key: 'dozen', display: 'Dozen', displayShort: 'Dozen' },
  { key: 'pound', display: 'Pound', displayShort: 'lb', factor: 0.453592 },
  { key: 'liter', display: 'Liter', displayShort: 'L' },
  { key: 'ml', display: 'Milliliter', displayShort: 'ml' },
  { key: 'box', display: 'Box', displayShort: 'Box' },
  { key: 'pack', display: 'Pack', displayShort: 'Pack' }
];

export const PRODUCT_UNITS = UNIT_CONFIGS.map(u => u.key);
export type ProductUnit = typeof UNIT_CONFIGS[number]['key'];
