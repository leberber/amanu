/**
 * Utility functions for product quantity operations using pieces_per_box
 */

import { PRODUCT } from '../../core/constants/product.constants';
import { fractionLabel } from './box-options.utils';

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function formatFractionalCartons(quantity: number, ppb: number): string {
  const count = quantity / ppb;
  if (Number.isInteger(count)) return count.toString();
  const whole = Math.floor(count);
  const remainderPieces = quantity - whole * ppb;
  const g = gcd(remainderPieces, ppb);
  const frac = fractionLabel(remainderPieces / g, ppb / g);
  return whole > 0 ? `${whole} ${frac}` : frac;
}

/**
 * Gets the default quantity for a product.
 * Returns pieces_per_box if available, otherwise default quantity.
 */
export function getDefaultQuantity(piecesPerBox?: number): number {
  return piecesPerBox || PRODUCT.DEFAULT_QUANTITY;
}

/**
 * Gets the base quantity (pieces per box) for carton calculations.
 * Falls back to 10 if not configured.
 */
export function getBaseQuantity(piecesPerBox?: number): number {
  return piecesPerBox || 10;
}

/**
 * Calculates the carton count based on total quantity and pieces per box.
 */
export function getCartonCount(quantity: number, piecesPerBox?: number): number {
  const baseQty = getBaseQuantity(piecesPerBox);
  return quantity / baseQty;
}

/**
 * Formats carton count with leading zeros (e.g., "03x")
 */
export function formatCartonCount(quantity: number, piecesPerBox?: number): string {
  const count = getCartonCount(quantity, piecesPerBox);
  return count.toString().padStart(2, '0') + 'x';
}

/**
 * Formats carton display for cart items (e.g., "8x10" for 8 cartons of 10 pieces).
 * Cart items store total pieces, so we divide by base quantity to get carton count.
 */
export function getCartonDisplay(totalPieces: number, piecesPerBox?: number): string {
  const ppb = getBaseQuantity(piecesPerBox);
  const cartonCount = totalPieces / ppb;
  return `${cartonCount}x${ppb}`;
}

/**
 * Formats carton display for order items (e.g., "8x10" for 8 cartons of 10 pieces).
 * Order items already store carton count in quantity field.
 */
export function getOrderCartonDisplay(totalPieces: number, piecesPerBox?: number, packagingLabel?: string, unitLabel?: string, compact = false): string {
  const pieces = piecesPerBox || 10;
  const cartonStr = formatFractionalCartons(totalPieces, pieces);
  if (packagingLabel && unitLabel) {
    return compact
      ? `${cartonStr}${packagingLabel[0].toLowerCase()} × ${pieces}${unitLabel[0].toLowerCase()}`
      : `${cartonStr} ${packagingLabel} × ${pieces} ${unitLabel}`;
  }
  return `${cartonStr}x${pieces}`;
}
