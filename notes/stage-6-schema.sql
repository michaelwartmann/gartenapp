-- Stage 6 — Wetter-Coach
-- In Supabase SQL Editor ausführen, einmalig.

ALTER TABLE gardens ADD COLUMN IF NOT EXISTS zip_code TEXT;
ALTER TABLE gardens ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'DE';
ALTER TABLE gardens ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE gardens ADD COLUMN IF NOT EXISTS longitude NUMERIC;
ALTER TABLE gardens ADD COLUMN IF NOT EXISTS location_label TEXT;
ALTER TABLE gardens ADD COLUMN IF NOT EXISTS weather_cache JSONB;
ALTER TABLE gardens ADD COLUMN IF NOT EXISTS weather_cache_at TIMESTAMPTZ;
