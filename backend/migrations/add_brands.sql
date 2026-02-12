-- Migration: Add brands table and brand_id to products
-- Run this with: psql "postgresql://postgres:it is me@localhost:5432/elsuq" -f add_brands.sql

-- Create brands table
CREATE TABLE IF NOT EXISTS brands (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    name_translations JSON,
    description_translations JSON,
    logo_url VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP
);

-- Create index on brand name
CREATE INDEX IF NOT EXISTS idx_brands_name ON brands(name);

-- Add brand_id column to products table (allow NULL for existing products)
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_id INTEGER;

-- Add foreign key constraint
ALTER TABLE products
ADD CONSTRAINT fk_products_brand
FOREIGN KEY (brand_id) REFERENCES brands(id);

-- Create index on brand_id
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);
