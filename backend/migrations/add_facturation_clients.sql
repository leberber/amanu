-- Migration: Link facturations to users, add fiscal_info JSONB to users
-- Run this once on the production database

-- 1. Add fiscal_info JSONB column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS fiscal_info JSONB;

-- 2. Re-point facturations.client_id to users instead of facturation_clients
--    (If the column doesn't exist yet, just add it)
ALTER TABLE facturations ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- 3. If facturation_clients table exists from a previous migration, drop it
--    (only safe if it has no data you need to keep)
-- DROP TABLE IF EXISTS facturation_clients;
