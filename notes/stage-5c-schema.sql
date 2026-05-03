-- Stage 5C — eigener Foto-Hintergrund pro Garten
--
-- Stage 8.1 hat 6 kuratierte Themes geliefert (gardens.background_key in
-- 'erde'/'wiese'/'holz'/'aquarell'/'stein'/'botanik' oder NULL für Default-
-- Off-White). 5C erweitert um eigene Foto-Uploads:
--
--   - background_key = 'custom' → Foto wird genutzt, URL liegt in
--     gardens.background_url
--   - background_opacity = 0.0–1.0 → User-Slider, weil Foto-Detailgrad
--     stark variiert. NULL = Theme-Default (0.55 für custom).
--
-- Storage-Bucket "garden-bg" wird ebenfalls hier angelegt (Public, analog
-- zum existierenden "illustrations"-Bucket für Pflanzen-Karteibilder).
-- Pfad-Pattern in Storage: gardens/{garden_id}.webp (überschreibend).
--
-- Idempotent. Beide Spalten NULL-able, kein Datenmigrations-Bedarf.

-- 1) Spalten
ALTER TABLE gardens
  ADD COLUMN IF NOT EXISTS background_url TEXT NULL;

ALTER TABLE gardens
  ADD COLUMN IF NOT EXISTS background_opacity NUMERIC NULL;

ALTER TABLE gardens
  DROP CONSTRAINT IF EXISTS gardens_background_opacity_check;

ALTER TABLE gardens
  ADD CONSTRAINT gardens_background_opacity_check
  CHECK (
    background_opacity IS NULL
    OR (background_opacity >= 0 AND background_opacity <= 1)
  );

-- 2) Storage-Bucket (Public — Skizzen-Bilder sind nicht sensibel,
--    Lese-Zugriff via CDN-URL ohne Auth, Schreib-Zugriff nur via
--    admin-Client in der Server-Action).
INSERT INTO storage.buckets (id, name, public)
VALUES ('garden-bg', 'garden-bg', true)
ON CONFLICT (id) DO NOTHING;
