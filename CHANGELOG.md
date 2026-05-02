# Changelog

Alle nennenswerten Änderungen an der Gartenapp, in umgekehrter chronologischer Reihenfolge.

---

## Stage 5B.1 — Form-Override + Rotation (2026-05-02)

Direkt nach 5B aufgekommen: Beet-Form sollte sich pro Beet manuell setzen lassen (Hochbeet kann oval angelegt werden, Topf rechteckig), und Beete sollten sich drehen lassen damit die Skizze Garten-Geometrie abbilden kann.

- **`beds.shape TEXT NULL`** (`'rect' | 'ellipse' | NULL`) — explizite User-Override; NULL = aus `kind` ableiten (Stage 5B-Verhalten unverändert).
- **`beds.rotation NUMERIC NULL DEFAULT 0`** — Rotation in Grad, normalisiert auf [0, 360) sowohl client- als auch serverseitig.
- **Form-Toggle-Chip** über dem Canvas wenn ein Beet selektiert ist: `[▭ Rechteck | ◯ Oval]`. Tap wechselt sofort, dirty-Flag triggert.
- **Konva-Transformer mit `rotateEnabled`** — der Rotate-Anchor erscheint oben über dem Beet. `onTransformEnd` schreibt sowohl skalierte w/h als auch normalisierte Rotation.
- **Rotation-Reset-Knopf** „↺ 47°" wenn Rotation ≠ 0; ein Tap setzt sie auf 0.
- `updateBedLayout` erweitert um optionale `shape` + `rotation` Felder, server-seitig validiert und auf [0, 360) normalisiert.

Files:
- `notes/stage-5b_1-schema.sql` (neu) — Schema-Migration mit CHECK-Constraint auf shape
- `lib/supabase.ts` (Bed-Type + neuer `BedShape`-Export)
- `app/garten/plan/editor/{autoLayout,BedCanvas,EditorClient}.tsx`
- `app/garten/plan/actions.ts` (`updateBedLayout` + `VALID_BED_SHAPES`)

---

## Stage 5B — Visueller Beet-Editor (2026-05-02)

Die `beds`-Tabelle hatte seit Stage 5A vier reservierte NUMERIC-Felder (`x`, `y`, `w`, `h`) — alle leer. Stage 5B löst dieses Versprechen ein: User können ihre Beete jetzt als Rechtecke (Töpfe + Kübel als Ellipsen) auf einer Skizzenfläche anordnen.

- **Neue Sub-Route `/garten/plan/editor`** — Konva-Stage 480×720 logische px, responsiv gescaled für schmale Screens. Eigener Top-Bar mit „← Plan" + „✓ Speichern".
- **Drag + Resize** — `react-konva` allein, kein `@use-gesture`. Konvas eingebautes Drag mit `dragBoundFunc`-Clamping zum Canvas-Rand; `Transformer` mit Bottom-Right-Eckgriff für Resize, MIN_BED 40 px.
- **Tap-Geste** — erster Tap selektiert (orange Stroke), zweiter Tap auf das selektierte Beet öffnet das bestehende `EditBedSheet` für Label/Kind-Edit. Drag und Tap diskriminiert via `dragDistance={4}`.
- **Form pro Beet-Art** — `topf` 🪴 und `kuebel` 🏺 rendern als `<Ellipse>`, alle anderen als `<Rect>`. Skizze ist sofort lesbar ohne Label.
- **Auto-Layout für Bestand** — beim ersten Öffnen werden NULL-Koord-Beete in 2-Spalten-Kaskade vorpositioniert (insertion order = `created_at`); Hinweis-Banner „Beete wurden automatisch angeordnet — auf ✓ Speichern tippen".
- **Server-Action `updateBedLayout`** — batched, validiert Garden-Ownership in einer Query, clampt server-seitig zu Canvas-Bounds, `revalidatePath` für `/garten/plan` + `/garten/plan/editor`.
- **Listen-View bleibt** — `/garten/plan` unverändert; neuer „🗺️ Skizze bearbeiten"-Knopf über den Beet-Karten (nur wenn ≥1 Beet).
- **`beforeunload`-Warnung** wenn Dirty + Navigieren.
- **Konva via `dynamic({ssr:false})`** geladen — Standard-Pattern für Browser-only-APIs in Next 16 App Router.

Files:
- `app/garten/plan/editor/{page.tsx,EditorClient.tsx,BedCanvas.tsx,autoLayout.ts}` (neu)
- `app/garten/plan/actions.ts` (+ `updateBedLayout` + Helpers)
- `app/garten/plan/page.tsx` (Skizze-Knopf)
- `CLAUDE.md` (Stage 5B als ✅, Key Decision #14)
- `notes/stage-5b-design.md` (Koordinatensystem + Library-Wahl, Foundation für Stage 5C)
- `package.json` (`react-konva`, `konva`)

---

## Stage 7.1 — Multi-Category, Findability & Polish (2026-05-01)

Nach Kims Erst-Run kamen sechs Themen auf:

- **Multi-Kategorien:** `plants.categories TEXT[]` neu — eine Pflanze kann unter mehreren Filtern auftauchen. Tomate findet man unter Gemüse *und* Obst, Apfel unter Obst *und* Baum, Lavendel unter Kraut *und* Strauch, Brombeere unter Obst *und* Strauch. `category` bleibt als Display-Primary (Pillen-Farbe). Filter-Logik in `/browse` nutzt `categories.includes(filter)`.
- **Nuss als 7. Kategorie** (`#A37D5C`) — Walnuss, Haselnuss, Mandel bekommen einen eigenen Filter.
- **Multi-Pick UI** in `/browse/add`: Toggle-Buttons, ≥1 Pflicht, primary = first picked (mit ★).
- **AssignBedSheet Polling** für `suitable_bed_kinds` — wenn frisch angelegte Pflanze noch keine KI-Klassifizierung hat, polled das Sheet alle 2.5 s (max 30 s) und sortiert die Beete neu sobald die Daten da sind. Dezenter „✨ KI sortiert noch …"-Hinweis statt Block.
- **Slider-Fix im Browse-Catalog:** `flex flex-wrap` statt `overflow-x-auto pb-1` — keine horizontalen Slider mehr in den Filter-Pillen.
- **20 neue Seed-Einträge:** 10 Bäume (Tanne, Fichte, Birke, Eiche, Ahorn, Linde, Eibe, Magnolie, Ginkgo, Kastanie) + 10 Sträucher (Forsythie, Hortensie, Rhododendron, Flieder, Hibiskus, Buchsbaum, Liguster, Schmetterlingsflieder, Schneeball, Spierstrauch). Stage-2-Style. Buchsbaum mit Zünsler-Hinweis.
- **Backfill-Skript `npm run backfill-categories`** — Gemini ergänzt sekundäre Kategorien für die Bestand-Pflanzen (Apfel→[Obst, Baum], Tomate→[Gemüse, Obst], Brombeere→[Obst, Strauch] etc.). Idempotent, `--dry`-Flag.
- **Plant-Detail** zeigt Primary-Pille + „auch X"-Chips für Sekundär-Kategorien.
- **enrichPlant.ts** liefert zusätzlich `categories` (1–3 Werte) — wird beim Anlegen mit der User-Auswahl gemergt (User-Primary bleibt index 0, Gemini-Vorschläge werden ergänzt, cap 3).

Files:
- `lib/supabase.ts` (PlantCategory + 7 Werte, `Plant.categories`)
- `lib/enrichPlant.ts` (categories Output + Merge)
- `app/browse/{SearchFilter,page}.tsx`, `app/browse/add/{AddPlantForm,actions,page}.tsx`
- `app/garten/plan/{actions,AssignBedSheet,BedCard,AddPlantSheet}.tsx`
- `app/plants/[id]/page.tsx`, `app/page.tsx`
- `data/plants.json` (115 → 135), `notes/stage-7_1-schema.sql`
- `scripts/backfill-categories.ts`, `scripts/seed-plants.ts` (PlantEntry-Type)

---

## Stage 7 — Beete & Kategorien Polish (2026-05-01)

Kim-Feedback nach erstem Hands-On:

- **8 Beet-Arten statt 4:** zusätzlich Fensterbank/Topf innen 🪟, Hydroponik 💧, Rasen/Wiese 🌳 (für Bäume + Sträucher), Kübel 🏺. Single-source-of-truth in `lib/bedKinds.ts`.
- **Beet-Art-Picker als 3-spaltiges Grid** statt horizontalem Slider — alle Optionen auf einen Blick, keine Scroll-Falle mehr.
- **✏️-Edit-Knopf neben 🗑️** auf jeder Beet-Karte. Öffnet `EditBedSheet` (Modal mit Label-Input + Kind-Grid + Speichern). `renameBed` zu `updateBed(id, label, kind)` erweitert.
- **Plant-Kategorien Baum + Strauch** für Zier- und Nutzgehölze (Eiche, Forsythie, Rhodo, Lavendel-Strauch). „Obst" bleibt eßbar — Apfelbaum wandert nicht. Eigene Farben (Baum `#5C7C4A`, Strauch `#8FA376`).
- **Strukturiertes Feld `plants.suitable_bed_kinds TEXT[]`** — welche Beet-Arten zur Pflanze passen. Gemini-enriched on plant-add + Backfill-Skript `npm run backfill-bed-kinds` für die existierenden 115 Pflanzen.
- **„Wo kommt das hin?" Sheet** (`AssignBedSheet`) nach Plant-Add: optional, sortiert kompatible Beete oben mit ✓, unpassende mit ⚠. Skip-Button „Nur in Samenvorrat". Greift in zwei Flows: nach manueller Pflanze (`/browse/add`) und auf Plant-Detail bei „🌱 Gepflanzt", wenn der Garten ≥1 Beete hat aber die Pflanze noch keinem Beet zugeordnet ist.
- **Plant-Detail „🌿 Passt zu"-Chip-Reihe** rendert `suitable_bed_kinds` als Icon-Chips unter dem Detail-Header.
- **AddPlantSheet (Plan-Picker)** wird Eignung-aware: Pflanzen werden je nach Beet-Kind sortiert und mit ✓/⚠-Markern versehen, plus Toggle „Nur passende anzeigen".
- **enrichPlant.ts Prompt** ergänzt um Baum/Strauch-Heuristiken (Saatzeit = Pflanzzeit, Schneiden = Schnittart, immer mehrjährig) und das neue `suitable_bed_kinds`-Output-Schema mit Beaufort-artigem Enum-Constraint.

Files:
- `lib/bedKinds.ts` (neu), `lib/supabase.ts`, `lib/enrichPlant.ts`
- `app/garten/plan/{actions,AddBedForm,BedCard,EditBedSheet,AddPlantSheet,AssignBedSheet}.tsx`
- `app/browse/add/{actions,AddPlantForm,AddPlantFlow,page}.tsx`
- `app/plants/[id]/page.tsx`
- `app/page.tsx`, `app/browse/SearchFilter.tsx`
- `scripts/backfill-bed-kinds.ts`, `notes/stage-7-schema.sql`

---

## Stage 6 — Wetter-Coach (2026-05-01)

7-Tage-Vorhersage über Open-Meteo + Standort-Geocoding via Zippopotam (DE/AT/CH/NL). Severe-Event-Banner für die nächsten 48 h mit zwei Schweregraden:

- **Hinweis** (sandfarben): warmer Tag (28–32 °C), starker Wind (Bft 7–8, 50–74 km/h), viel Regen (15–30 mm/Tag), Trockenperiode (≥ 5 Tage)
- **Warnung** (rot): Frost (< 0 °C), Hitze (> 32 °C), Sturm (Bft 9+, ≥ 75 km/h), Starkregen (> 30 mm/Tag oder > 15 mm/h), Gewitter (mit Hagel-Hinweis bei WMO 96/99)

Schwellen sind aligned mit Beaufort-Skala und DWD-Normen — keine Sturm-Warnung mehr bei Bft 7. Banner zeigen Uhrzeit aus den Stunden-Daten wenn punktuell („Sturm morgen ab 14 Uhr").

Die „Diese Woche"-Tasks werden Wetter-aware: das Forecast wird kompakt zusammengefasst und in den Gemini-Prompt gegeben, Tasks lesen sich z.B. „Tomate ausgeizen — Mittwoch Regen, vorher trocken halten."

**Polish im selben Push (2026-05-01):**
- 47× `touch-none` → `touch-manipulation` global. Verhinderte vorher Scrolling auf jedem Tap-Target.
- Plant-Detail: 16 Felder default read-only, ein „✏️ Bearbeiten / ✓ Fertig"-Toggle wechselt in den Edit-Modus. iOS-Settings-Pattern.

Files:
- `lib/weather.ts`, `lib/weatherEvents.ts`, `lib/getWeatherForGarden.ts`
- `app/wetter/{actions,WeatherSetup,WeatherStrip}.tsx`
- `lib/weeklyTasks.ts` + `lib/getWeeklyTasks.ts` (Forecast-Integration)
- `notes/stage-6-schema.sql`, `scripts/set-locations.ts`

---

## Stage 5A.1 — Per-Beet Pflanztermine, Option C (2026-05-01)

Plan und Mein Garten sind jetzt eine Wahrheit. Die Pflanzen-Detail-Seite zeigt für Pflanzen mit Beet-Einträgen die Beete direkt mit per-Beet-Häkchen und per-Beet-Pflanzdatum. Der globale `garden_plants.planted_at` wird aus den Beeten *abgeleitet* (MIN aller Bed-Termine). Pflanzen ohne Beet behalten den einfachen globalen „Gepflanzt"-Knopf als Schnellweg.

- `deriveGlobalPlantedAt`-Helper sammelt alle Bed-Termine, schreibt MIN als globalen Wert, oder NULL wenn alle Beete ○ sind.
- `updateBedPlantingDate(plantingId, dateISO)` für per-Beet-Korrektur.
- „🌱 Im Garten seit 15.02.2026 · 11 Wochen alt"-Header — bleibt sichtbar beim Umpflanzen Vorzucht → Hauptbeet, weil MIN das Sa-Datum behält.
- 🌾 **Abgeerntet**: Chip-Button setzt `removed_at`, Chip wird durchgestrichen + auf 55% gedimmt; ↶ macht es rückgängig. Rotation-Advisor ignoriert abgeerntete Pflanzen für Mischkultur.
- Mein-Garten-Karten zeigen jetzt eine grüne Beet-Zeile (📦 Hochbeet hinten · +1).

**Deferred zu Stage 5A.2 (geplant Februar 2027):** expliziter „🌱→📦 Umpflanzen"-Knopf für Vorzucht-Workflow. Heute über manuellen Pfad lösbar (🌾 alte Zeile + neuer Eintrag), das Alter bleibt erhalten weil MIN-Logik.

---

## Stage 5A — Garten-Plan mit Beet-Gedächtnis (2026-05-01)

Inspiriert von Kims jährlicher Frühjahrs-Skizze: Beete sind langlebige Container pro Garten, Bepflanzungen werden pro Saison gespeichert, und ein Gemini-Wrapper sagt beim Pflanzen-Hinzufügen *„passt gut / okay / lieber nicht"* mit kurzem Grund.

- Schema: `plants.family TEXT` (17. Feld, optional, für Familien-Rotation), Tabellen `beds` und `bed_plantings` mit `season_year` und `removed_at`.
- `lib/recommendRotation.ts` — Gemini 2.5 Flash-Lite + deterministischer Companion-Pre-Filter (klare Konflikte vor Gemini abfangen).
- UI `/garten/plan`: Beet-Karten, Diese-Saison + Letztes-Jahr-Sektion (Scope auf 1 Jahr begrenzt — Best Practice für Fruchtfolge), Plant-Picker mit Status-Badges (📦 Hab Samen / 🌱 Im Garten / 🛒 Kaufe Samen).
- Pflanze ins Beet planen → automatisch in `garden_plants` (Meine Samen) erzeugt. Bed ✓ → garden_plants zu „gepflanzt" promoviert.
- `npm run backfill-families` — Skript klassifiziert Pflanzen via Gemini in lateinische Familien.

Files:
- `lib/recommendRotation.ts`, `scripts/backfill-families.ts`
- `app/garten/plan/{page,actions,BedCard,AddPlantSheet,AddBedForm}.tsx`
- `notes/stage-5a-schema.sql`, `notes/stage-5-jahresplanung-fruchtfolge.md`

---

## Security/RLS — admin-client-only (2026-05-01)

Supabase Advisor flagged `rls_disabled_in_public`. RLS aktiviert auf allen `public`-Tabellen. Da unsere Auth cookie-basiert läuft (kein Supabase Auth, `auth.uid()` immer null), passen klassische RLS-Policies nicht. Stattdessen alle DB-Reads serverseitig über `supabaseAdmin()` (Secret Key umgeht RLS). Anon-Key sieht jetzt nichts mehr, inkl. `gardens.password_hash`.

- `lib/supabase.ts`: anon-Client raus, `supabaseAdmin()` factory rein.
- 3 Read-Sites umgebaut: `app/page.tsx`, `app/browse/page.tsx`, `app/plants/[id]/page.tsx`.
- Plant Detail Client Component nutzt jetzt Server Actions (`loadPlantWithOverrides`, `saveFieldOverride`) statt direkter Supabase-Calls.

---

## Stage 4B — „Diese Woche" Tasks (2026-04-26)

Time-aware Aufgaben-Block oben in Mein Garten. Gemini 2.5 Flash-Lite liest `(today, planted plants + planted_at + saatzeit/vorzucht/schneiden/ernte)` und liefert bis zu 8 imperative deutsche Aufgaben getaggt `jetzt` / `diese_woche` / `demnaechst`.

Cached pro Garten pro Tag auf `gardens.weekly_tasks_cache(_date)`; invalidiert von `markAsPlanted` / `updatePlantedDate` / `markAsNotPlanted`. Sektion versteckt sich wenn keine Pflanzen oder Gemini leer zurückkommt.

---

## Stage 4A — „Was kann ich pflanzen?" + Planted/Interessiert (2026-04-24)

`/empfehlungen` mit Gemini 2.5 Flash, Idea-Verdict-Block (`good` / `mixed` / `tricky` / `none`) + 5–8 Vorschlägen, jeweils mit Begründung. Companion-Conflict-Filter („Tomate + Kartoffel ist heikel") deterministisch vor Gemini.

`garden_plants.planted_at DATE` führt den Split ein: NULL = „Meine Samen" (interessiert), Datum gesetzt = „Im Garten 🌱" (gepflanzt). Plant Detail bekommt „Gepflanzt / Datum ändern / Nicht mehr gepflanzt"-Knöpfe.

---

## Stage 3 — Per-garden passwords (2026-04-24)

Statt globalem Gartenpasswort: jeder Garten hat eigenen Hash. Erste Login → Setup-Modus für Passwort-Wahl. Forgot-Password-Flow: User gibt Garten-Name ein, Resend mailt Reset-Link an Admin (`michael.wartmann@gmail.com`), Admin leitet weiter. 10-Min-Reset-Token-Dedup-Poka-Yoke verhindert Spam.

`scrypt`-Hash, `crypto.randomBytes` für Tokens. Schema-Erweiterung: `gardens.password_hash`, `reset_token`, `reset_expires_at`.

Manuelle-Pflanze-Flow (`/browse/add`) im selben Cycle: User legt Pflanze mit Name + Kategorie an, Gemini füllt im Hintergrund die 16 Felder + generiert Kawaii-Bild via `gemini-2.5-flash-image`.

---

## Stage 2 — Catalog expansion + kawaii images (2026-04-23)

115 Pflanzen in 4 Batches nachseededt. On-demand Kawaii-Bildgenerierung über `gemini-2.5-flash-image` (Free Tier).

`npm run generate-images` als Backfill-Skript (idempotent, nur missing). PWA-Installierbarkeit durch Middleware-Whitelist für Manifest + Icons.

---

## v1.0 — Demo Release (2026-04-22)

Erstes shippable Demo:
- 30 Pflanzen mit 16 deutschen Botanik-Feldern
- Mein-Garten / Browse-Catalog / Plant-Detail
- Garten-gate Auth (`Garten2026` shared password)
- Mobile-first, PWA-Manifest, kawaii Header-Bilder
- Vercel-Deployment unter `garten.philia-aletheia.art`

Frozen als git-tag `v1.0`.
