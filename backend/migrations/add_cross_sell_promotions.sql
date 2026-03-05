-- Migration: Add Cross-Sell Promotions Feature
-- Date: 2024
-- Description: Creates table for cross-sell promotions system (bundle deals)

-- Create cross_sell_promotions table
CREATE TABLE IF NOT EXISTS cross_sell_promotions (
    id SERIAL PRIMARY KEY,

    -- Basic Info
    name VARCHAR(100) NOT NULL,

    -- Target product (the one that gets discounted)
    target_product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    -- Trigger products (JSON array of product IDs)
    trigger_product_ids JSONB NOT NULL DEFAULT '[]',

    -- Discount Configuration
    discount_type VARCHAR(20) NOT NULL DEFAULT 'fixed_amount',
    discount_value DECIMAL(10, 2) NOT NULL,

    -- Minimum quantity of trigger product needed
    min_trigger_quantity INTEGER NOT NULL DEFAULT 1,

    -- Validity (optional date range)
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,

    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,

    -- Constraint: discount value must be positive
    CONSTRAINT chk_discount_value_positive CHECK (discount_value > 0),
    -- Constraint: min trigger quantity must be at least 1
    CONSTRAINT chk_min_trigger_quantity CHECK (min_trigger_quantity >= 1)
);

-- Create indexes for cross_sell_promotions
CREATE INDEX IF NOT EXISTS idx_cross_sell_target_product ON cross_sell_promotions(target_product_id);
CREATE INDEX IF NOT EXISTS idx_cross_sell_active ON cross_sell_promotions(is_active);
CREATE INDEX IF NOT EXISTS idx_cross_sell_dates ON cross_sell_promotions(start_date, end_date);

-- Create GIN index for trigger_product_ids JSON array for efficient lookups
CREATE INDEX IF NOT EXISTS idx_cross_sell_triggers ON cross_sell_promotions USING GIN (trigger_product_ids);
