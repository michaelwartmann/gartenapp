-- Stage 5B.1 — Form-Override + Rotation pro Beet
--
-- Stage 5B leitete die Form aus `kind` ab (topf/kuebel = Ellipse, sonst
-- Rechteck). Stage 5B.1 erlaubt einen User-Override pro Beet: ein
-- Hochbeet kann oval angelegt werden, ein Topf rechteckig.
--
-- Außerdem bekommt jedes Beet einen Rotationswinkel in Grad. NULL/0 =
-- ungerollt; Konvas Transformer schreibt den Wert beim Drehen.
--
-- Idempotent. Beide Spalten sind NULL-able und haben harmlose Defaults,
-- also keine Datenmigration für Bestand nötig.

ALTER TABLE beds
  ADD COLUMN IF NOT EXISTS shape TEXT NULL;

ALTER TABLE beds
  DROP CONSTRAINT IF EXISTS beds_shape_check;

ALTER TABLE beds
  ADD CONSTRAINT beds_shape_check
  CHECK (shape IS NULL OR shape IN ('rect', 'ellipse'));

ALTER TABLE beds
  ADD COLUMN IF NOT EXISTS rotation NUMERIC NULL DEFAULT 0;
