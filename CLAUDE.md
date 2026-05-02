# 🌱 Gartenapp

**Shared plant & seed tracker for gardening enthusiasts**

A digital plant companion inspired by Kim's physical plant card album. Mobile-first app for tracking and customizing botanical information for anyone who loves gardening - women, men, and families alike.

## 📱 Project Overview

**What it is**: Digital plant tracker with kawaii botanical illustrations
**For whom**: Gardening enthusiasts of all genders - women, men, families, and anyone who loves plants
**Purpose**: Inspired by Kim's physical plant card collection - a digital tool for organizing and exploring botanical knowledge
**Tone**: Nimble, humble, simple and beautiful. No overkill.
**Philosophy**: Demo first, polish later

## 🏗️ Technical Stack

- **Frontend**: Next.js 16 App Router + TypeScript + Tailwind CSS 4
- **Backend**: Supabase (PostgreSQL + Storage), RLS aktiviert, alle Reads serverseitig über `supabaseAdmin()`
- **Auth**: Per-Garten-Passwörter (Stage 3), erstes Login richtet Passwort ein, Forgot-Password über Admin-Email (Resend)
- **AI**: Gemini 2.5 Flash / Flash-Lite (Empfehlungen, Tasks, Fruchtfolge, Plant-Autofill) + Gemini 2.5 Flash-Image (Kawaii-Illustrationen)
- **Wetter**: Open-Meteo (Forecast) + Zippopotam (PLZ-Geocoding) für DE/AT/CH/NL
- **Deployment**: Vercel
- **Domain**: `garten.philia-aletheia.art` (live)

## 🎯 Current State

### ✅ Features Complete
- **115-plant catalog** with 16 German botanical fields each (+ optional 17th `family` for Fruchtfolge) — seeded from `data/plants.json`
- **Mein Garten split**: "Im Garten 🌱" (planted) vs "Meine Samen" (interessiert), per user
- **"Diese Woche"** time-aware tasks per planted plant on Mein Garten — Gemini 2.5 Flash-Lite, cached daily on `gardens.weekly_tasks_cache` (JSONB) + `weekly_tasks_cache_date`, invalidated on every Gepflanzt/Datum-ändern/Nicht-mehr-gepflanzt action
- **"Was kann ich pflanzen?"** — Gemini 2.5 Flash-Lite advisor at `/empfehlungen` with idea/verdict block + suggestions + companion-conflict filter
- **Garten-Plan** (`/garten/plan`): Beete pro Garten, Pflanzen pro Beet pro Saison, Vorjahre-Anzeige, Fruchtfolge-Tipp via Gemini 2.5 Flash-Lite (mit deterministischem Companion-Pre-Filter) beim "+ Pflanze hinzufügen"
- **Wetter-Coach** (Stage 6, oben in Mein Garten): 7-Tage-Vorhersage via Open-Meteo, severe-event-Banner (Frost / Sturm / Gewitter / Starkregen / Hitze / Trockenperiode) für die nächsten 48h mit Uhrzeit. Tasks werden Wetter-aware: „Tomate ausgeizen — Mittwoch Regen, vorher trocken halten." PLZ-Setup pro Garten, lat/lng via Zippopotam (DE/AT/CH/NL). Cache 6h auf `gardens.weather_cache`
- **Per-garden passwords**: first-login setup, forgot-password via Resend email to admin, 10-min reset-token dedup poka-yoke
- **Gepflanzt / Nicht mehr gepflanzt**: toggle `planted_at DATE` on plant detail
- **Manual plant + Gemini autofill** (`/browse/add`): fills the 16 fields + kawaii illustration in the background
- **On-demand kawaii image generation** via `gemini-2.5-flash-image` ("Nano Banana")
- **PWA installable**: manifest + icons cleared through middleware
- **RLS enabled, admin-client-only**: alle DB-Reads serverseitig über `supabaseAdmin()`, anon-Key sieht nichts

### 🔧 Technical Features
- Mobile-first responsive design (max-width 480px)
- Next.js 16 App Router + React 19 server actions (`useActionState`, `after()`)
- Server-side cookies for iOS PWA persistence (`httpOnly` + `Set-Cookie`)
- Filename sanitization for German special characters (ü→u, ö→o, ä→a, ß→ss)
- Supabase Storage integration for custom illustrations

## 🗄️ Database Schema

### Supabase Project
- **Project ID**: `bbscvofuqucsxvamkwnx`
- **URL**: `https://bbscvofuqucsxvamkwnx.supabase.co`

### Tables
```sql
-- Core plant data (shared)
plants: id, name, latin_name, category, illustration_url, family,
        suitable_bed_kinds TEXT[], categories TEXT[],
        [16 botanical fields]

-- Per-garden auth + ownership + weekly-tasks cache + weather
gardens: id, owner_name, password_hash, reset_token, reset_expires_at,
         weekly_tasks_cache JSONB, weekly_tasks_cache_date DATE,
         zip_code, country_code, latitude, longitude, location_label,
         weather_cache JSONB, weather_cache_at TIMESTAMPTZ

-- Per-garden plant rows: interessiert (planted_at NULL) vs gepflanzt (date set)
garden_plants: id, garden_id, plant_id, planted_at DATE,
               [16 override fields], notes

-- Stage 5A: persistent beds per garden (x/y/w/h reserved for 5B editor)
beds: id, garden_id, label, kind, x, y, w, h, created_at

-- Stage 5A: bed history per season (Folgekulturen via multiple rows/year)
bed_plantings: id, bed_id, plant_id, season_year, planted_at DATE,
               removed_at DATE, notes
```

### Storage Buckets
- **illustrations**: Public bucket for kawaii plant images (`kawaii/` folder)

## 🌱 Plants Database

**Growing catalog of Western European garden plants** with authentic German cultivation data. Source of truth: `data/plants.json` (committed). Seed via `npm run seed-plants` (upserts by `(name, latin_name)`, preserves any existing `illustration_url`).

Categories (Stage 7.1, **Multi-Cat**): **Gemüse, Kraut, Blume, Obst, Baum, Strauch, Nuss.** Eine Pflanze kann mehrere Kategorien haben (`plants.categories TEXT[]`). `plants.category` ist die Primary (Display-Pille + Farbe), `categories` enthält *alle* zutreffenden — Filter durchsucht den Array. Tomate=[Gemüse, Obst], Apfel=[Obst, Baum], Brombeere=[Obst, Strauch], Lavendel=[Kraut, Strauch], Walnuss=[Nuss, Baum]. Single source: `PLANT_CATEGORIES` in `lib/supabase.ts`. Goal coverage: ~150-200 plants.

Beet-Arten (`bedKinds.ts`, 8 Werte): **Beet 🟫, Hochbeet 📦, Gewächshaus 🏠, Topf außen 🪴, Fensterbank 🪟, Hydroponik 💧, Rasen/Wiese 🌳, Kübel 🏺.** Wird sowohl in `beds.kind` als auch im Plant-Feld `suitable_bed_kinds TEXT[]` (welche Beet-Arten zur Pflanze passen) verwendet. Single source of truth: `lib/bedKinds.ts`.

**16 German Botanical Fields per plant:**
Sorte, Saatzeit, Saattiefe, Nachbarn, Erde, Witterung, Bodenmilieu, Dünger, Vorzucht, Schneiden, Einwintern, Ernte, Einjährig/Mehrjährig, Pflanzort, Wirkung auf den Körper, Stark-/Schwachzehrer

**Per-garden overrides**: each user (garden) can customize any of the 16 fields locally — stored in `garden_plants` rows scoped by `garden_id`. The login flow upserts a `gardens` row by name and sets `garten_id` cookie.

## 🛠️ Scripts & Tools

### Plant catalog
```bash
# Seed/refresh the plants table from data/plants.json (idempotent upsert)
npm run seed-plants

# Backfill kawaii images for any plant that has no illustration_url.
# Default model: gemini-2.5-flash-image (free-tier friendly).
# Override with IMAGE_MODEL env var if needed (e.g. imagen-3.0-generate-002 if you have paid Imagen access).
npm run generate-images

# See which image-gen models your API key actually has access to
npm run generate-images -- --list-models

# Regenerate all images (e.g. for a style refresh) — overwrites existing
npm run generate-images -- --all

# Backfill plants.family (Solanaceae, Brassicaceae, …) for Fruchtfolge.
# Idempotent: only fills WHERE family IS NULL. Pass --all to overwrite.
npm run backfill-families

# Backfill plants.suitable_bed_kinds (welche Beet-Arten zur Pflanze passen).
# Idempotent: only fills WHERE suitable_bed_kinds IS NULL. Pass --all to overwrite, --dry für Vorschau.
npm run backfill-bed-kinds

# Backfill plants.categories — sekundäre Kategorien via Gemini (Apfel→[Obst, Baum], Tomate→[Gemüse, Obst], …).
# Idempotent: only updates rows where categories IS NULL or only has the primary. Pass --all/--dry.
npm run backfill-categories

# Bulk-set garden locations from scripts/locations.json
# (admin task — for setting many gardens' PLZ at once)
npm run set-locations
```

### Environment Variables
```bash
# .env.local (configured locally)
NEXT_PUBLIC_SUPABASE_URL=https://bbscvofuqucsxvamkwnx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_[key]
SUPABASE_SECRET_KEY=sb_secret_[key]
GOOGLE_AI_API_KEY=[your_google_ai_key]
```

## 🚀 Deployment

### Live
- **Production**: `https://garten.philia-aletheia.art` — served from the **`prototype` branch** (Vercel "Production Branch" setting)
- **Preview**: `https://gartenapp-dev.vercel.app` — served from the **`main` branch** (jeder Push auf main triggert nur einen Preview-Build)
- **Promotion-Workflow**: entwickeln auf `main`, dann `git checkout prototype && git merge --no-ff main -m "merge: <kurzbeschreibung>" && git push origin prototype` → Vercel baut Production automatisch. Push auf `main` alleine geht **nicht** auf Production.
- **v1.0**: frozen as git tag `v1.0` (demo release — Stage 1)

### Local
- **Dev server**: `http://localhost:3001` (or `:3000`)
- **Network**: `http://192.168.1.100:3001` (mobile testing)

### Repository
- **GitHub**: `https://github.com/michaelwartmann/gartenapp.git`

### Vercel Environment Variables
All four vars from `.env.example` must be set in the Vercel project:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SECRET_KEY
GOOGLE_AI_API_KEY
```

## 🎨 Design System

### Colors
- Background: `#FAFAF7`
- Card background: `#FFFFFF`  
- Primary green: `#4A7C59`
- Accent terracotta: `#C17B5C`
- Text primary: `#2C2C2A`
- Text muted: `#888780`
- Border: `#E8E6DF`

### Typography & Layout
- Font: `system-ui, -apple-system, sans-serif`
- Border radius: 12px (cards), 8px (fields)
- Mobile-first: max-width 480px centered
- Touch targets: minimum 44px height
- No shadows, borders only

## 🔑 Key Decisions Made

1. **Per-Garten-Auth (Stage 3)**: jeder Garten hat eigenes Passwort, kein User-Account-Modell — bewusst leichtgewichtig
2. **Personal Customization**: `garden_plants` speichert User-Overrides der 16 Felder pro Garten
3. **Mobile-First**: max-width 480 px, min Touch-Target 44 px, `touch-action: manipulation` (nicht `none`) damit Scroll überall flüssig läuft
4. **German Botanical Focus**: alle UI-Strings + Daten auf Deutsch, lateinische Pflanzen-Familien als Referenz
5. **Kawaii Aesthetic**: weiche, niedliche Illustrationen — inspiriert von Kims handgezeichneten Karten
6. **Filename Sanitization**: ü→u, ö→o, ä→a, ß→ss für Storage-Uploads
7. **Plan ↔ Mein Garten als eine Wahrheit (Stage 5A.1)**: globaler `garden_plants.planted_at` wird aus den Beeten abgeleitet (MIN aller Bed-Termine), damit umpflanzen das Alter erhält
8. **Wetter-Schwellen Beaufort-getreu (Stage 6)**: Hinweis vs. Warnung, keine Alarme bei Bft 7 — User sollen nicht freaked-out werden
9. **RLS + admin-client-only (Security-Fix)**: cookie-basierte Auth + Server-side admin-Client für alle DB-Reads, anon-Key sieht nichts
10. **Read-Mode default auf Plant Detail**: 16 Felder sind nicht versehentlich tappbar, „✏️ Bearbeiten"-Toggle aktiviert Edit-Modus (iOS-Settings-Pattern)
11. **Beet-Arten als shared Konstante (Stage 7)**: `lib/bedKinds.ts` ist single source of truth für die 8 Werte; AddBedForm, BedCard, EditBedSheet, AssignBedSheet und der actions-Validator ziehen alle aus derselben Liste. Verhindert Drift.
12. **`suitable_bed_kinds` als strukturiertes Plant-Feld (Stage 7)**: nicht nur Freitext in „Pflanzort"; AssignBedSheet sortiert nach Eignung, Plan-Picker zeigt ✓/⚠. Gemini-enriched + Backfill-Skript für Bestand.
13. **Multi-Cat: Findability vor Strenge (Stage 7.1)**: Pflanzen können in mehreren Kategorien gleichzeitig sein. Tomate ist Gemüse *und* Obst, Apfel ist Obst *und* Baum. Filter sucht über den Array, nicht über die Single-Spalte. Primary (= `category`) bleibt für Display und Farbe. Reduziert Klassifizierungs-Streitfragen, hilft beim Suchen.
14. **Konva, kein use-gesture im MVP (Stage 5B)**: Skizzen-Editor nutzt `react-konva` allein — Konvas eingebautes Drag + `Transformer` reicht für Move + Resize. `@use-gesture/react` würde nur zusätzlichen Layer für Gesten bringen, die wir noch nicht brauchen. Edit-Mode ist *implizit*: jedes Beet ist im Editor immer draggable, ein zweites Tap auf ein selektiertes Beet öffnet das EditBedSheet. Logischer Canvas 480×720 px wird für schmale Screens proportional gescaled, gespeicherte Werte bleiben in logischen px. Töpfe + Kübel rendern als Ellipse, alle anderen Beet-Arten als Rechteck — die Skizze ist sofort lesbar ohne das Label zu lesen.

## 🎯 v2 Roadmap

Stages shipped on top of v1.0 — siehe `CHANGELOG.md` für Details:

- ✅ **Stage 2** (2026-04-23): 115 Pflanzen, Kawaii-Bildgenerierung, manuelle Pflanze + Gemini-Autofill
- ✅ **Stage 3** (2026-04-24): Per-Garten-Passwörter, First-Login-Setup, Forgot-Password via Resend
- ✅ **Stage 4A** (2026-04-24): „Was kann ich pflanzen?" Empfehlungen, planted/interessiert split
- ✅ **Stage 4B** (2026-04-26): „Diese Woche" zeitnahe Tasks mit Per-Day-Cache
- ✅ **Security/RLS** (2026-05-01): RLS aktiviert, admin-client-only für Reads
- ✅ **Stage 5A** (2026-05-01): Garten-Plan mit Beeten, Bepflanzungen pro Saison, Fruchtfolge-Coach via Gemini, 17. Feld `family`
- ✅ **Stage 5A.1** (2026-05-01): Per-Beet-Pflanztermine als kanonische Wahrheit (Option C), Plan und Mein-Garten synchronisiert, 🌾 Abgeerntet-Polish, Pflanzen-Alter sichtbar
- ✅ **Stage 6** (2026-05-01): Wetter-Coach mit Beaufort-getreuen Schwellen, Severe-Event-Banner, Wetter-aware „Diese Woche"-Tasks
- ✅ **Mobile UX-Polish** (2026-05-01): `touch-manipulation` global, Edit-Mode-Toggle auf Plant Detail
- ✅ **Stage 7** (2026-05-01): Beete & Kategorien Polish — 8 Beet-Arten (Fensterbank, Hydroponik, Rasen, Kübel) als 3-Grid-Picker, ✏️-Edit-Knopf, Pflanzen-Kategorien Baum + Strauch, AssignBedSheet beim Pflanze-Hinzufügen, neues `suitable_bed_kinds`-Feld pro Pflanze (Gemini + Backfill)
- ✅ **Stage 7.1** (2026-05-01): Multi-Category, Findability & Polish — `plants.categories TEXT[]` (Tomate=[Gemüse, Obst], Apfel=[Obst, Baum]), Nuss als 7. Kategorie, Multi-Pick im /browse/add, Filter via `categories.includes`, AssignBedSheet Polling für `suitable_bed_kinds`, Slider-Fix in Browse-Filter (flex-wrap), 20 neue Seed-Pflanzen (Bäume + Sträucher), `npm run backfill-categories`
- ✅ **Stage 5B** (2026-05-02): Visueller Beet-Editor — Sub-Route `/garten/plan/editor` mit `react-konva` Canvas (480×720 logische px, responsiv gescaled). Beete als Rechtecke (Töpfe + Kübel als Ellipsen), Drag zum Verschieben, Transformer-Eckgriff zum Resizen, zweiter Tap öffnet EditBedSheet. Bestand mit NULL-Koords wird beim ersten Öffnen in 2-Spalten-Kaskade vorpositioniert; ✓ Speichern persistiert via batched `updateBedLayout`. Listen-View bleibt unverändert.

Next up:

1. **Stage 5A.2** — expliziter „🌱→📦 Umpflanzen"-Knopf (Vorzucht → Hauptbeet) für Februar 2027 wenn Vorzucht-Saison startet.
2. **Stage 5C** — Foto-Hintergrund pro Garten (Storage-Subfolder `garden-bg/`, Konva-Image-Layer mit Opazitäts-Slider). Architektur ist von 5B vorbereitet.
3. **Stage 4C** (optional) — push notifications / email reminders driven off the daily-tasks pipeline.
4. **Filter/sort** the catalog by any of the 16 botanical dimensions.

## 🧪 Release-Readiness

Vor jedem Release-Schritt zu echten Gärtnern: `notes/release-readiness-test.md` durchklicken (15 Phasen, ~30 Min) mit einem Wegwerf-Garten (`TestKim` o.ä.). Deckt Login, Empty-State, Wetter-Setup, Pflanzen-Add, Plan, Toggle-State, Vorzucht-Workflow, Companion-Konflikt, Empfehlungen, manuelle Pflanze + Mobile-Scrolling ab.

## 📝 Development Notes

### Architecture Choices
- Next.js 16 with App Router for modern React patterns
- Supabase for rapid backend setup with real-time capabilities
- TypeScript for type safety with botanical data structures
- Tailwind for mobile-first responsive design

### User-Friendly Features
- No complex user management - simple shared access
- Large, clear typography and buttons for accessibility
- Intuitive tap-to-edit interaction pattern
- Gentle error messages and loading states
- Inclusive design for gardeners of all backgrounds

---

**Built with ❤️ for gardening enthusiasts everywhere**  
*Inspired by Kim's passion for plants*  
*Simple, warm, earthy. No overkill.*
