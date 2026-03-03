// Product-related constants
// Core product values are now centralized in app.constants.ts PRODUCT object
// This file only exports unit/packaging configurations used by services

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