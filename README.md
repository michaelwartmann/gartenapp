# 🌱 Gartenapp

**Digitaler Garten-Begleiter mit kawaii Pflanzen-Illustrationen, Fruchtfolge-Coach und Wetter-Tipps.**

Inspiriert von Kims physischem Pflanzen-Karten-Album. Mobile-first, deutsch, einfach zu bedienen — auch für Hobby-Gärtner ohne Tech-Hintergrund.

**Live:** https://garten.philia-aletheia.art

---

## Was die App kann

- **115 Pflanzen** im Katalog mit 16 deutschen Botanik-Feldern (Sorte, Saatzeit, Nachbarn, Bodenmilieu, Schneiden, Ernte, Stark-/Schwachzehrer, …) und kawaii Illustrationen
- **Pro Garten** persönliche Sammlung: Pflanzen unter „Meine Samen" (interessiert) oder „Im Garten 🌱" (gepflanzt mit Datum)
- **Garten-Plan** (`/garten/plan`): Beete als langlebige Container, Bepflanzungen pro Saison, Vorjahre-Gedächtnis. Beim Pflanzen-Hinzufügen sagt Gemini *„passt gut / okay / lieber nicht"* mit Fruchtfolge-Begründung (Familien-Rotation, Nährstoff-Reihenfolge, Mischkultur).
- **Diese Woche**: zeitnahe Aufgaben-Liste pro gepflanzter Pflanze, generiert von Gemini, Wetter-aware
- **Wetter-Coach**: 7-Tage-Vorhersage über Open-Meteo, Severe-Event-Banner für Frost / Sturm / Gewitter / Starkregen / Hitze / Trockenperiode, Schwellen aligned mit Beaufort-Skala und DWD-Normen
- **Was kann ich pflanzen?** (`/empfehlungen`): kurzer Fragebogen + Freitext, Gemini schlägt 5–8 passende Pflanzen vor, mit Companion-Conflict-Filter
- **Manuelle Pflanze** (`/browse/add`): Name + Kategorie eingeben, Gemini füllt im Hintergrund die 16 Felder + generiert Kawaii-Bild
- **Pro Garten eigenes Passwort**, erstes Login richtet es ein, Forgot-Password über Admin-Email
- **Mobile-first** (max-width 480 px), als PWA installierbar

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind CSS 4**
- **Supabase** (PostgreSQL + Storage)
- **Gemini 2.5 Flash / Flash-Lite** für Empfehlungen, Tasks, Fruchtfolge, Plant-Autofill
- **Open-Meteo** + **Zippopotam** für Wetter und PLZ-Geocoding (DE/AT/CH/NL)
- **Resend** für Forgot-Password-Mails
- **Vercel** für Deployment

## Lokal entwickeln

```bash
npm install
cp .env.example .env.local  # echte Werte eintragen
npm run dev
```

`http://localhost:3000` (oder 3001, je nachdem was frei ist) öffnen.

## Skripte

```bash
npm run dev                       # Dev-Server
npm run build                     # Production-Build
npm run seed-plants               # data/plants.json → DB upserten
npm run generate-images           # Kawaii-Bilder für Pflanzen ohne Bild
npm run backfill-families         # plants.family (Solanaceae, …) befüllen
npm run backfill-bed-kinds        # plants.suitable_bed_kinds (welche Beet-Arten passen) befüllen
npm run backfill-categories       # plants.categories Sekundär-Kategorien (Apfel→[Obst, Baum]) via Gemini
npm run set-locations             # Bulk-PLZ-Setup aus scripts/locations.json
```

## Wo finde ich was?

- **`CLAUDE.md`** — vollständiger Projekt-Kontext, Schema, Design-System, Roadmap
- **`CHANGELOG.md`** — chronologische Liste aller Stages mit Details
- **`notes/`** — SQL-Migrationen pro Stage, Test-Plan, deferred Pläne
  - `release-readiness-test.md` — End-to-End-Walkthrough vor Release
  - `stage-5a-schema.sql` und `stage-6-schema.sql` — Schema-Migrationen
  - `stage-5-jahresplanung-fruchtfolge.md` — ursprünglicher Stage-5-Plan-Doc

## Tonalität

> Nimble, humble, simple and beautiful. No overkill.
> Demo first, polish later.

Inspiriert von Kims physischer Pflanzen-Karten-Sammlung. Warm, erdig, deutsch, ohne Technik-Schickschnack.
