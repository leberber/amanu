-- Migration: Add cross_sell_discount_amount column to orders table
-- This column stores the discount amount from cross-sell (bundle deal) promotions

-- Add the cross_sell_discount_amount column
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cross_sell_discount_amount FLOAT DEFAULT 0;

-- Update any existing orders to have 0 as the default
UPDATE orders SET cross_sell_discount_amount = 0 WHERE cross_sell_discount_amount IS NULL;
