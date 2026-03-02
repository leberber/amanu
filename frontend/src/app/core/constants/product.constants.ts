// Product-related constants
// Note: LOW_STOCK_THRESHOLD is defined in app.constants.ts PRODUCT object
export const PRODUCT_CONSTANTS = {
  DEFAULT_QUANTITY: 1,
  MIN_QUANTITY: 1,
  MAX_QUANTITY: 100,
  QUANTITY_STEP: 1,
  QUANTITY_INCREMENT: 5,
  
  // Grid display settings
  GRID_MAX_HEIGHT: 300,
  GRID_MIN_COLUMN_WIDTH: 60,
  
  // Limits
  MAX_DESCRIPTION_LENGTH: 200,
  MAX_NAME_LENGTH: 100,
  
  // Placeholder values
  PLACEHOLDER_IMAGE: 'assets/images/product-placeholder.jpg',
  DEFAULT_DESCRIPTION: 'Quality wholesale products for your business.'
} as const;

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