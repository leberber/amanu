-- Migration: Add routing and batching columns to orders table
-- Run this against your PostgreSQL database

-- Add delivery_type column (STANDARD or PRIORITY)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS delivery_type VARCHAR(20) DEFAULT 'STANDARD';

-- Add is_full_load flag
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS is_full_load BOOLEAN DEFAULT FALSE;

-- Add min_vehicle_capacity_kg
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS min_vehicle_capacity_kg FLOAT DEFAULT NULL;

-- Add trip_id foreign key (will reference trips table)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS trip_id INTEGER DEFAULT NULL;

-- Create trips table
CREATE TABLE IF NOT EXISTS trips (
    id SERIAL PRIMARY KEY,
    driver_id INTEGER REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'PENDING',
    total_weight_kg FLOAT DEFAULT 0.0,
    total_volume_m3 FLOAT DEFAULT 0.0,
    estimated_distance_km FLOAT DEFAULT 0.0,
    estimated_duration_min FLOAT DEFAULT 0.0,
    h3_zone VARCHAR(50),
    total_earnings FLOAT DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,
    assigned_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by_id INTEGER REFERENCES users(id)
);

-- Create trip_stops table
CREATE TABLE IF NOT EXISTS trip_stops (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    sequence INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    estimated_arrival TIMESTAMP WITH TIME ZONE,
    arrived_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    notes VARCHAR(500)
);

-- Add foreign key constraint for trip_id in orders (if trips table exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'orders_trip_id_fkey'
    ) THEN
        ALTER TABLE orders
        ADD CONSTRAINT orders_trip_id_fkey
        FOREIGN KEY (trip_id) REFERENCES trips(id);
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_delivery_type ON orders(delivery_type);
CREATE INDEX IF NOT EXISTS idx_orders_is_full_load ON orders(is_full_load);
CREATE INDEX IF NOT EXISTS idx_orders_trip_id ON orders(trip_id);
CREATE INDEX IF NOT EXISTS idx_trips_driver_id ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_h3_zone ON trips(h3_zone);
CREATE INDEX IF NOT EXISTS idx_trip_stops_trip_id ON trip_stops(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_stops_order_id ON trip_stops(order_id);
