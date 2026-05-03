-- Stage 9 — Ernte-Tracking als Verlaufs-Erfassung
--
-- Heute war 🌾 Abgeerntet binär: `bed_plantings.removed_at = today` setzte
-- die Pflanze als „weg". Eine Pflücksalat-Saison kollabierte auf einen
-- einzigen Tap.
--
-- Stage 9 trennt zwei Konzepte sauber:
--   - `harvests` = Event-Log: jede einzelne Ernte mit Menge + Einheit + Datum.
--   - `bed_plantings.removed_at` = „die Pflanze ist raus" (Saison-Ende, ausgerissen,
--     Frost). Wird beim „Pflanze raus"-Knopf im HarvestSheet gesetzt.
--
-- Eine Tomaten-Saison hat jetzt typisch ~15 Zeilen in `harvests`. Bilanz
-- pro Beet/Saison ist Aggregat.
--
-- Idempotent. Spalten + Constraints sind alle IF NOT EXISTS / DROP-then-ADD.

-- 1) plants.harvest_unit — vom Pflanzen-Typ abhängige Default-Einheit.
--    NULL = keine Mengen-Ernte sinnvoll (Blumen) → 🌾-Button im Chip ausblenden.
ALTER TABLE plants
  ADD COLUMN IF NOT EXISTS harvest_unit TEXT NULL;

ALTER TABLE plants
  DROP CONSTRAINT IF EXISTS plants_harvest_unit_check;

ALTER TABLE plants
  ADD CONSTRAINT plants_harvest_unit_check
  CHECK (
    harvest_unit IS NULL
    OR harvest_unit IN ('kg','g','stueck','bund','kopf','schnitt','schale')
  );

-- 2) harvests — der Event-Log selbst.
CREATE TABLE IF NOT EXISTS harvests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bed_planting_id UUID NOT NULL REFERENCES bed_plantings(id) ON DELETE CASCADE,
  garden_id UUID NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  unit TEXT NOT NULL,
  harvested_at DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE harvests
  DROP CONSTRAINT IF EXISTS harvests_unit_check;

ALTER TABLE harvests
  ADD CONSTRAINT harvests_unit_check
  CHECK (unit IN ('kg','g','stueck','bund','kopf','schnitt','schale'));

CREATE INDEX IF NOT EXISTS harvests_planting_idx
  ON harvests (bed_planting_id);

CREATE INDEX IF NOT EXISTS harvests_garden_year_idx
  ON harvests (garden_id, harvested_at);

-- RLS analog zu den anderen Tabellen: an, alle Reads/Writes laufen über
-- den admin-Client (Stage Security/RLS-Pattern aus 2026-05-01).
ALTER TABLE harvests ENABLE ROW LEVEL SECURITY;
