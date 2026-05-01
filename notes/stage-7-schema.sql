-- Stage 7 — Beete & Kategorien Polish
--
-- Adds a structured "Passt zu Beet-Arten" array to plants. Values are
-- BedKind strings ('beet', 'hochbeet', 'gewaechshaus', 'topf',
-- 'topf_innen', 'hydroponik', 'rasen', 'kuebel'). 1–4 entries per plant.
--
-- The 4 new BedKind values (topf_innen, hydroponik, rasen, kuebel) require
-- no schema change — beds.kind is already TEXT. Only the App-side validation
-- in app/garten/plan/actions.ts is being extended.
--
-- The Plant.category enum gets two new members ('Baum', 'Strauch') —
-- plants.category is also TEXT, no schema change needed.

ALTER TABLE plants ADD COLUMN IF NOT EXISTS suitable_bed_kinds TEXT[];
