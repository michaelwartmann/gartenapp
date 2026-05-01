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

- **Frontend**: Next.js 16 App Router + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Storage)
- **Auth**: Simple password gate (`Garten2026`)
- **Deployment**: Vercel (planned)
- **Domain**: `garten.philia-aletheia.art` (to be configured)

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

Categories: **Gemüse, Kraut, Blume, Obst.** Goal coverage: ~150-200 plants.

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
- **Production**: `https://gartenapp-git-main-mikeio.vercel.app`
- **Release**: v1.0 (demo release — frozen as git tag `v1.0`)
- **Custom domain**: `garten.philia-aletheia.art` (planned)

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

1. **Simple Auth**: Password gate instead of user accounts - easier for shared access
2. **Personal Customization**: garden_plants table stores individual user field overrides
3. **Mobile-First Design**: 480px max width, large touch targets
4. **German Botanical Focus**: Authentic German gardening terminology
5. **Kawaii Aesthetic**: Soft, cute illustrations inspired by Kim's artistic style
6. **Filename Sanitization**: Handle German special characters for file uploads
7. **Single Page App**: Simple navigation for all gardening enthusiasts

## 🎯 v2 Roadmap

Stages shipped on top of v1.0:

- ✅ **Stage 2**: Catalog expansion (115 plants), on-demand kawaii image generation, manual-plant + Gemini autofill.
- ✅ **Stage 3**: Per-garden passwords, first-login setup flow, forgot-password via Resend email to admin.
- ✅ **Stage 4A**: "Was kann ich pflanzen?" recommendations via Gemini 2.5 Flash, planted-vs-interessiert split (`garden_plants.planted_at DATE`), "Gepflanzt / Nicht mehr gepflanzt" controls on plant detail, conflict-detection ("Tomaten + Kartoffeln ist heikel") in free-text recommendations.
- ✅ **Stage 4B**: "Diese Woche" time-aware tasks block at the top of Mein Garten. Gemini 2.5 Flash-Lite reads `(today, planted plants + planted_at + saatzeit/vorzucht/schneiden/ernte)` and returns up to 8 imperative German tasks tagged `jetzt` / `diese_woche` / `demnaechst`. Cached per-garden-per-day on `gardens.weekly_tasks_cache(_date)`; invalidated by `markAsPlanted` / `updatePlantedDate` / `markAsNotPlanted`. Section hides when no planted plants or when Gemini returns zero tasks.
- ✅ **Security/RLS**: alle Supabase-Reads laufen serverseitig über `supabaseAdmin()`; RLS auf allen `public`-Tabellen aktiviert (default-deny für anon-Key).
- ✅ **Stage 5A**: Garten-Plan unter `/garten/plan`. Beete (`beds`) sind langlebige Container pro Garten, Bepflanzungen (`bed_plantings`) werden pro Saison gespeichert und erlauben Folgekulturen. UI: Beet anlegen, Pflanze über Sheet hinzufügen, Vorjahre als gedimmte Chips. Beim Hinzufügen läuft `recommendRotation` (Gemini 2.5 Flash-Lite + deterministischer Companion-Pre-Filter) und zeigt verdict `gut` / `okay` / `schlecht` mit kurzem Grund. 17. Pflanzenfeld `family` (Solanaceae, Brassicaceae, …) optional — Backfill via `npm run backfill-families`. Schema in `notes/stage-5a-schema.sql`.

Next up:

1. **Stage 5B** — visueller Beet-Editor (drag/drop auf Skizzenfläche) mit `react-konva` + `@use-gesture/react`. Touch-UX-Risiko früh testen.
2. **Stage 5C** — Foto-Hintergrund pro Garten (Storage-Subfolder `garden-bg/`, Konva-Image-Layer mit Opazitäts-Slider).
3. **Stage 4C** (optional) — push notifications / email reminders driven off the daily-tasks pipeline.
4. **Filter/sort** the catalog by any of the 16 botanical dimensions.

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
