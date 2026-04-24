-- Migration 012: Lägg till adressfält på families
ALTER TABLE families ADD COLUMN IF NOT EXISTS address TEXT;
