// Product-related constants
export const PRODUCT_CONSTANTS = {
  DEFAULT_QUANTITY: 1,
  MIN_QUANTITY: 1,
  MAX_QUANTITY: 100,
  QUANTITY_STEP: 1,
  LOW_STOCK_THRESHOLD: 20,
  QUANTITY_INCREMENT: 5,
  
  // Grid display settings
  GRID_MAX_HEIGHT: 300,
  GRID_MIN_COLUMN_WIDTH: 60,
  
  // Limits
  MAX_DESCRIPTION_LENGTH: 200,
  MAX_NAME_LENGTH: 100,
  
  // Placeholder values
  PLACEHOLDER_IMAGE: 'assets/images/product-placeholder.jpg',
  DEFAULT_DESCRIPTION: 'Fresh, high-quality produce delivered daily from local farms.'
} as const;

export const PRODUCT_UNITS = {
  KG: 'kg',
  GRAM: 'gram', 
  PIECE: 'piece',
  BUNCH: 'bunch',
  DOZEN: 'dozen',
  POUND: 'pound'
} as const;

export type ProductUnit = typeof PRODUCT_UNITS[keyof typeof PRODUCT_UNITS];