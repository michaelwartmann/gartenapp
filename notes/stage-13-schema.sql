-- Stage 13 — Beet-Tagebuch: Foto-Verlauf pro Beet
--
-- Pro Beet kann Kim Fotos hochladen, jedes mit `taken_at`-Datum (per
-- Default heute, im Upload-Sheet änderbar). Die Strip-View in
-- `BedInlineView` zeigt die neuesten zuerst, der Fullscreen-Viewer
-- erlaubt Vor/Zurück + Löschen.
--
-- Einzelner Eintrag pro Foto (kein Upsert) — User kann beliebig viele
-- Fotos pro Beet sammeln. Storage-Pfad: bed-photos/{bed_id}/{photo_id}.webp.
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS bed_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bed_id UUID NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
  garden_id UUID NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  taken_at DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bed_photos_bed_idx
  ON bed_photos (bed_id, taken_at DESC);

-- RLS analog zu den anderen Tabellen: an, alle Reads/Writes laufen über
-- den admin-Client (Stage Security/RLS-Pattern).
ALTER TABLE bed_photos ENABLE ROW LEVEL SECURITY;

-- Storage-Bucket (Public — Foto-Lese-Zugriff via CDN-URL ohne Auth,
-- Schreib-Zugriff nur via admin-Client in der Server-Action).
INSERT INTO storage.buckets (id, name, public)
VALUES ('bed-photos', 'bed-photos', true)
ON CONFLICT (id) DO NOTHING;
