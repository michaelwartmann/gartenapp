-- Stage 10 — Garten-Bilanz mit Lerntagebuch-Framing
--
-- Stage 9 hat „Pflanze raus" als 🪦-Button im HarvestSheet eingeführt — er
-- setzt heute `bed_plantings.removed_at = today` ohne Grund. Für die
-- Bilanz-Seite (vor allem die „💔 Was nicht klappte"-Sektion) brauchen wir
-- den *Grund*: Saison-Ende ist anders als Frost ist anders als Schädlinge.
-- Das ist Lerntagebuch-Daten, nicht Scoring.
--
-- Sieben Werte:
--   - 'saison_ende'  → Pflanze hat geliefert, ist jetzt fertig (Apfelbaum,
--                       Tomate nach erstem Frost). Default beim alten 1-Tap.
--   - 'frost'        → Vorzeitig durch Frost erwischt
--   - 'schaedlinge'  → Schädlinge haben sie gekostet
--   - 'krankheit'    → Pilz / Mehltau / Bakterie
--   - 'eingegangen'  → Wuchs nicht an, ohne klare Ursache
--   - 'umgepflanzt'  → Vorzucht → Hauptbeet (Stage 5A.2-Vorgriff)
--   - 'anderes'      → Catch-all
--
-- Idempotent. Keine Bestandsmigration: NULL bleibt erlaubt für alte
-- removed_at-Einträge ohne Grund.

ALTER TABLE bed_plantings
  ADD COLUMN IF NOT EXISTS removed_reason TEXT NULL;

ALTER TABLE bed_plantings
  DROP CONSTRAINT IF EXISTS bed_plantings_removed_reason_check;

ALTER TABLE bed_plantings
  ADD CONSTRAINT bed_plantings_removed_reason_check
  CHECK (
    removed_reason IS NULL
    OR removed_reason IN (
      'saison_ende',
      'frost',
      'schaedlinge',
      'krankheit',
      'eingegangen',
      'umgepflanzt',
      'anderes'
    )
  );
