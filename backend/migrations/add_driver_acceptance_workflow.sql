-- Migration: Add columns for driver acceptance workflow
-- This migration adds:
-- 1. preferred_corridor to drivers table (driver's preferred route)
-- 2. suggested_driver_id and corridor to trips table (suggested driver and route info)

-- Add preferred_corridor to drivers table
ALTER TABLE drivers
ADD COLUMN IF NOT EXISTS preferred_corridor VARCHAR(100) DEFAULT NULL;

-- Add suggested_driver_id to trips table (foreign key to users.id)
ALTER TABLE trips
ADD COLUMN IF NOT EXISTS suggested_driver_id INTEGER DEFAULT NULL REFERENCES users(id);

-- Add corridor to trips table
ALTER TABLE trips
ADD COLUMN IF NOT EXISTS corridor VARCHAR(100) DEFAULT NULL;

-- Create index on suggested_driver_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_trips_suggested_driver_id ON trips(suggested_driver_id);

-- Add comment for documentation
COMMENT ON COLUMN drivers.preferred_corridor IS 'Driver''s preferred corridor/route for delivery assignments';
COMMENT ON COLUMN trips.suggested_driver_id IS 'Suggested driver based on corridor preference (driver must accept)';
COMMENT ON COLUMN trips.corridor IS 'Corridor/route name for this trip';
