-- Stage 7.1 — Multi-Category, Findability & Polish
--
-- Plants get a TEXT[] of categories so a single plant can show up under
-- multiple filters (Tomate → [Gemüse, Obst], Apfel → [Obst, Baum],
-- Lavendel → [Kraut, Strauch], Walnuss → [Nuss, Baum]).
--
-- The existing single-pick `category` column stays as the *display
-- primary* (used for the colored category-pill on plant-detail and the
-- color-mapping in catalog cards). Filter logic switches to the array.
--
-- Idempotent: column add + initial backfill copy primary into the array.

-- 1. The existing CHECK constraint on `category` only accepts the original
--    4 values (Gemüse / Kraut / Blume / Obst). Stage 7 added 'Baum' and
--    'Strauch' to the app but never relaxed the DB constraint — manual
--    plant-adds happened to dedup against existing rows so it never
--    surfaced. Now drop and re-add for the full 7 values.
ALTER TABLE plants DROP CONSTRAINT IF EXISTS plants_category_check;
ALTER TABLE plants ADD CONSTRAINT plants_category_check
  CHECK (category IN ('Gemüse', 'Kraut', 'Blume', 'Obst', 'Baum', 'Strauch', 'Nuss'));

-- 2. The categories array — written by /browse/add (multi-pick) and
--    backfilled via `npm run backfill-categories` for the existing rows.
ALTER TABLE plants ADD COLUMN IF NOT EXISTS categories TEXT[];

UPDATE plants SET categories = ARRAY[category] WHERE categories IS NULL;
