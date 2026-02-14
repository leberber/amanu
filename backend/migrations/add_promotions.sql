-- Migration: Add Promotions Feature
-- Date: 2024
-- Description: Creates tables for promotions system

-- Create promotions table
CREATE TABLE IF NOT EXISTS promotions (
    id SERIAL PRIMARY KEY,

    -- Basic Info
    name VARCHAR(100) NOT NULL,
    description TEXT,
    code VARCHAR(50) UNIQUE,

    -- Translations (JSON)
    name_translations JSONB DEFAULT '{}',
    description_translations JSONB DEFAULT '{}',

    -- Discount Configuration
    discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage',
    discount_value DECIMAL(10, 2) NOT NULL,

    -- Scope
    scope VARCHAR(20) NOT NULL DEFAULT 'global',
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,

    -- Conditions
    min_order_amount DECIMAL(10, 2) DEFAULT 0,
    max_discount DECIMAL(10, 2),
    usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0,

    -- Validity
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,

    -- Audit
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- Create indexes for promotions
CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_promotions_scope ON promotions(scope);
CREATE INDEX IF NOT EXISTS idx_promotions_category ON promotions(category_id);
CREATE INDEX IF NOT EXISTS idx_promotions_brand ON promotions(brand_id);
CREATE INDEX IF NOT EXISTS idx_promotions_product ON promotions(product_id);

-- Create promotion_usages table for tracking
CREATE TABLE IF NOT EXISTS promotion_usages (
    id SERIAL PRIMARY KEY,
    promotion_id INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    discount_applied DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(promotion_id, order_id)
);

-- Create indexes for promotion_usages
CREATE INDEX IF NOT EXISTS idx_promotion_usages_promotion ON promotion_usages(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usages_user ON promotion_usages(user_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usages_order ON promotion_usages(order_id);

-- Add promotion-related columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promotion_id INTEGER REFERENCES promotions(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10, 2);

-- Create index for orders with promotions
CREATE INDEX IF NOT EXISTS idx_orders_promotion ON orders(promotion_id);

-- Update existing orders to set subtotal = total_amount (for backward compatibility)
UPDATE orders SET subtotal = total_amount WHERE subtotal IS NULL;
