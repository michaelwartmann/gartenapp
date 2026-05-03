-- Stage 8.1 — kuratierte Skizzen-Hintergründe
--
-- Pro Garten kann ein Hintergrund-Theme gewählt werden (erde, wiese,
-- holz, aquarell, stein, botanik). NULL = klassisches Off-White (Default
-- aus Stage 5B). Die Werte sind die Keys aus lib/canvasBackgrounds.ts;
-- der Validator dort bleibt die einzige Quelle der Wahrheit. Hier nur
-- ein lockerer Längen-Check als Defense-in-Depth.
--
-- Idempotent. Spalte ist NULL-able mit harmlosem Default, keine Daten-
-- migration für Bestand nötig.

ALTER TABLE gardens
  ADD COLUMN IF NOT EXISTS background_key TEXT NULL;

ALTER TABLE gardens
  DROP CONSTRAINT IF EXISTS gardens_background_key_check;

ALTER TABLE gardens
  ADD CONSTRAINT gardens_background_key_check
  CHECK (background_key IS NULL OR length(background_key) BETWEEN 1 AND 32);
