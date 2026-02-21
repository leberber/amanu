/**
 * Utility functions for product quantity operations
 */

import { QuantityConfig } from '../../models/product.model';
import { PRODUCT } from '../../core/constants/app.constants';

/**
 * Gets the default quantity for a product based on its quantity configuration.
 * For 'list' type configs, returns the first quantity in the list.
 * Otherwise returns the default product quantity.
 */
export function getDefaultQuantity(quantityConfig?: QuantityConfig): number {
  if (
    quantityConfig?.type === 'list' &&
    quantityConfig.quantities &&
    quantityConfig.quantities.length > 0
  ) {
    return quantityConfig.quantities[0];
  }
  return PRODUCT.DEFAULT_QUANTITY;
}

/**
 * Gets the base quantity (first in list) for carton calculations.
 * Falls back to 10 if not configured.
 */
export function getBaseQuantity(quantityConfig?: QuantityConfig): number {
  return quantityConfig?.quantities?.[0] || 10;
}

/**
 * Calculates the carton count based on total quantity and base quantity.
 */
export function getCartonCount(quantity: number, quantityConfig?: QuantityConfig): number {
  const baseQty = getBaseQuantity(quantityConfig);
  return quantity / baseQty;
}

/**
 * Formats carton count with leading zeros (e.g., "03x")
 */
export function formatCartonCount(quantity: number, quantityConfig?: QuantityConfig): string {
  const count = getCartonCount(quantity, quantityConfig);
  return count.toString().padStart(2, '0') + 'x';
}

/**
 * Checks if a quantity config uses list-based selection
 */
export function isListQuantityConfig(quantityConfig?: QuantityConfig): boolean {
  return quantityConfig?.type === 'list' &&
    !!quantityConfig.quantities &&
    quantityConfig.quantities.length > 0;
}

/**
 * Formats carton display for cart items (e.g., "8x10" for 8 cartons of 10 pieces).
 * Cart items store total pieces, so we divide by base quantity to get carton count.
 */
export function getCartonDisplay(totalPieces: number, quantityConfig?: QuantityConfig): string {
  const piecesPerBox = getBaseQuantity(quantityConfig);
  const cartonCount = totalPieces / piecesPerBox;
  return `${cartonCount}x${piecesPerBox}`;
}

/**
 * Formats carton display for order items (e.g., "8x10" for 8 cartons of 10 pieces).
 * Order items already store carton count in quantity field.
 */
export function getOrderCartonDisplay(cartonCount: number, piecesPerBox?: number): string {
  const pieces = piecesPerBox || 10;
  return `${cartonCount}x${pieces}`;
}
