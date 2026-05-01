-- Stage 5A — Garten-Plan Schema
-- In Supabase SQL Editor ausführen, einmalig.

-- 17. Pflanzenfeld: botanische Familie (Solanaceae, Brassicaceae, …)
-- Wird per `npm run backfill-families` befüllt. Bleibt initial NULL.
ALTER TABLE plants ADD COLUMN IF NOT EXISTS family TEXT;

-- Persistente Beete pro Garten
CREATE TABLE IF NOT EXISTS beds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garden_id UUID NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  kind TEXT NOT NULL,
  -- Position/Größe für Phase 5B Editor; in 5A NULL
  x NUMERIC,
  y NUMERIC,
  w NUMERIC,
  h NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS beds_garden_id_idx ON beds (garden_id);

-- Bepflanzungs-Historie pro Beet pro Saison.
-- Folgekulturen erlaubt: ein Beet kann pro Jahr mehrere Einträge haben
-- (z.B. Radieschen Apr → Bohnen Jun → Feldsalat Sep).
CREATE TABLE IF NOT EXISTS bed_plantings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bed_id UUID NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
  plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  season_year INT NOT NULL,
  planted_at DATE,
  removed_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bed_plantings_bed_year_idx
  ON bed_plantings (bed_id, season_year);

-- RLS: an, ohne Policies — App greift nur via admin client zu (s. RLS-Fix).
ALTER TABLE beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE bed_plantings ENABLE ROW LEVEL SECURITY;
