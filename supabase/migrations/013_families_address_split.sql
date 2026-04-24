-- Migration 013: Ersätt address-kolumn med separata adressfält
ALTER TABLE families DROP COLUMN IF EXISTS address;
ALTER TABLE families ADD COLUMN IF NOT EXISTS street TEXT;
ALTER TABLE families ADD COLUMN IF NOT EXISTS street_number TEXT;
ALTER TABLE families ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE families ADD COLUMN IF NOT EXISTS city TEXT;
