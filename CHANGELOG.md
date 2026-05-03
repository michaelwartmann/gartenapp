# Changelog

Alle nennenswerten Änderungen an der Gartenapp, in umgekehrter chronologischer Reihenfolge.

---

## Stage 8.2 — Browse-Findability + smart Categorization + No-Overlap-AutoLayout (2026-05-03)

Drei UX-Mängel aus Kim-Live-Test:

- **Pflanze-fehlt-CTA an die Spitze** — `SearchFilter.tsx`: chip-style „+ Pflanze fehlt?" / „+ „<query>" anlegen" in der Filter-Zeile rechts neben dem Pflanzen-Count. Footer-CTA nur noch im Empty-State („keine Pflanzen gefunden") als Notnagel. Vorher unten unter dem Grid → Kim hat ihn nie gesehen.
- **Smart Plant-Categorization** — Kim trug „Zitrone" als „Gemüse" ein; Gemini-Background-Enrich addierte „Obst, Baum" → Final `[Gemüse, Obst, Baum]`. Falsch.
  - Neue Lib `lib/classifyPlantCategories.ts` — leichter Gemini-Call (Flash-Lite, ~800ms, returns nur das Category-Array). Prompt geteilt mit Backfill-Skript für Konsistenz.
  - Server-Action `suggestCategoriesForPlant(name, latinName)` — public, called debounced (600ms) vom AddPlantForm während des Tippens.
  - `AddPlantForm`: Live-Hint („✨ Gemini denkt: 🍎 Obst, 🌳 Baum") + Auto-Apply (solange User noch nichts manuell getoggelt hat). Bei manueller Wahl-Override bleibt Geminis Vorschlag als Hint stehen mit „Übernehmen"-Button.
  - **Soft-Confirm-Sheet beim Submit**: wenn User-Auswahl und Gemini-Vorschlag *zero overlap* haben (Zitrone-Fall), Modal: „Du hast {Gemüse} gewählt. Gemini denkt eher {Obst, Baum}." mit zwei Buttons.
  - `actions.ts:createPlantAndAdd`: Merge-Logik korrigiert von „immer mergen" zu „bei zero-overlap **replace**, sonst merge". Verhindert Mix-Salate. Updated auch `category` (Primary) wenn neue Primary anders ist — sonst war die Display-Pille falsch gefärbt.
- **Overlap-aware AutoLayout für neue Beete** — `assignDefaultPositions()` (`autoLayout.ts`): aufgeteilt in 2 Pässe. Pass 1 sammelt alle bereits positionierten Bett-Boxes; Pass 2 sucht für jedes neue Bett den ersten Cascade-Slot, der mit nichts kollidiert. Wenn keiner frei: stack unter alle, mittig (`placeBelowAll`). Vorher landete jedes neue Bett im Slot-0 = top-left, *direkt überlappend* mit dem ersten existierenden Bett. Kim dachte der Add hat nicht funktioniert.
- **Auto-Select neues Beet** — `AddBedForm` bekommt `onAdded(bedId)` Callback. EditorClient mountet AddBedForm jetzt selbst (statt Sibling auf page.tsx), wartet auf neue `views`-Prop nach revalidatePath, setzt selectedId auf die neue Bed-ID + scrollt das Inline-Detail in den Viewport. User sieht sofort dass + wo das neue Beet ist.

Files:
- `lib/classifyPlantCategories.ts` (neu)
- `app/browse/SearchFilter.tsx` (CTA-Position)
- `app/browse/add/AddPlantForm.tsx` (Smart-Suggestion + Soft-Confirm; controlled inputs)
- `app/browse/add/actions.ts` (`suggestCategoriesForPlant` + Merge→Replace + primary-update)
- `app/garten/plan/editor/autoLayout.ts` (Overlap-aware)
- `app/garten/plan/AddBedForm.tsx` (`onAdded` Callback)
- `app/garten/plan/editor/EditorClient.tsx` (mountet AddBedForm + auto-select)
- `app/garten/plan/page.tsx` (AddBedForm-Sibling weg im non-empty Branch)

---

## Stage 8.1 — Skizzen-Hintergründe + Small-Bed-Polish (2026-05-03)

Direkt nach Stage 8: Kim wollte den Hintergrund „mehr Garten, weniger weiße Wand". Statt sofort Stage 5C (Foto-Upload pro Garten, größerer Lift) bauen wir kuratierte Themes — sechs vorgenerierte Kawaii-Hintergründe zur Auswahl, ein 🎨-Tap im Editor-Header. Foto-Upload bleibt für später geplant.

- **6 generierte WebP-Hintergründe** (`public/garten-bg/{erde,wiese,holz,aquarell,stein,botanik}.webp`) — generiert via `npm run generate-backgrounds` (Gemini Flash-Image), zu 768 px @ q78 WebP komprimiert, total **216 KB** (von 9 MB ungeshrunken). Kawaii-Stil konsistent mit den Pflanzen-Illus.
- **Per-Garten persistiert** — `gardens.background_key TEXT` mit Length-Constraint, NULL = Standard-Off-White.
- **Picker als Bottom-Sheet** (`BackgroundPicker.tsx`) — 2-spaltig im 2:3-Format, Live-Vorschau jedes Themes als Thumbnail, ✓ markiert das aktive. Hint „Eigenes Foto kommt später".
- **`<KonvaImage>`-Layer** (`CanvasBackground.tsx`) als unterster Layer im BedCanvas, cover-fit, individuelle Opazität pro Theme (0.35–0.55) damit Beete lesbar bleiben.
- **🎨-Button im Editor-Header** (locked-Mode neben ✏️). Im Edit-Mode versteckt damit Save-Button alleine prominent ist.
- **Single source of truth** — `lib/canvasBackgrounds.ts` definiert Keys + Pfade + Labels + Opazität + Validator. `setGardenBackground`-Action validiert über `isValidBackgroundKey`, persistiert NULL für `'default'`.
- **Small-Bed-Lesbarkeits-Fix** — neuer `BedLabelStack`-Helper im BedCanvas: Kind-Icon wird auf Beeten < 70 px ausgeblendet, Label-Font shrinkt von 14 → 12 → 10 px je nach Größe, sehr kleine Beete (< 50×36) zeigen nur die ersten 2 Buchstaben (vollständiger Inhalt im Inline-Detail unten). Vorher: Icon + Label überlappten / verschwanden bei kleinen Beeten.

Files:
- `notes/stage-8_1-schema.sql` (neu) — Schema-Migration
- `scripts/generate-backgrounds.ts` (neu) — One-time Generator, idempotent + `--force`/`--only=KEY`
- `lib/canvasBackgrounds.ts` (neu) — Single source of truth
- `lib/supabase.ts` (Garden-Type +`background_key`)
- `app/garten/plan/actions.ts` (`setGardenBackground` + `getGardenBackgroundKey`)
- `app/garten/plan/BackgroundPicker.tsx` (neu)
- `app/garten/plan/editor/{CanvasBackground,BedCanvas,EditorClient}.tsx`
- `app/garten/plan/page.tsx` (lädt + reicht backgroundKey durch)
- `public/garten-bg/*.webp` (6 Bilder, 216 KB total)
- `package.json` (`generate-backgrounds` script)

---

## Stage 8 — Plan-Page Polish: Lock + Inline-Detail + Pflanzen-Thumbs (2026-05-03)

Drei Brainstorm-Ideen aus Kim-Feedback in einem Push: die Skizze sollte „lockable" sein, beim Tappen eines Beets sollte der Beet-Inhalt sofort sichtbar werden, und die Beete sollten ihre Pflanzen visuell zeigen — nicht nur Farbe + Label.

- **Editor wird zur primären Plan-Ansicht** — `/garten/plan` mountet jetzt den Editor (locked default), `/garten/plan/editor` ist nur noch ein Redirect für alte Bookmarks. Eine Wahrheit, ein Renderpfad. Listen-View (`BedCard.tsx`) ist weg.
- **Lock-Toggle 🔒/🔓** — Default locked: Beete sind nicht draggable, kein Transformer, Single-Tap selektiert. „✏️ Bearbeiten" schaltet auf unlocked → Drag/Resize/Rotation/ShapeToggle aktiv. „✓ Speichern" lockt automatisch zurück. „Verwerfen" rollt back + lockt.
- **Inline-Beet-Detail unter dem Canvas** (`BedInlineView.tsx`) — wenn locked + ein Beet selektiert: kompakter Beet-Block mit Header (✏️ Label/Kind editieren, 🗑️ löschen) + „Diese Saison" Chips (reused via shared `PlantChips.tsx`) + collapsible „Letztes Jahr".
- **Pflanzen-Thumbnails auf der Skizze** (`PlantThumbnails.tsx`) — bis zu 3 Kawaii-Bilder pro Beet via `useImage`, +N-Badge bei mehr. Min-Größe 22 px (sonst hidden, Label bleibt). Greyed wenn nicht gepflanzt oder geerntet. Rendert über `<KonvaImage>` mit White-Background-Card für Lesbarkeit.
- **Label-Position adaptiv** — wenn Beet Pflanzen hat: Label rückt nach oben (rechts vom Kind-Icon, ellipsized), Bilder unten. Ohne Pflanzen: Label bleibt zentriert wie in 5B.
- **Touch-Action conditional** — `manipulation` im Lock-Mode (Page-Scroll funktioniert), `none` im Edit-Mode (Drag konkurriert nicht mit Scroll).
- **Shared Chips** (`PlantChips.tsx`) — `CurrentChip` und `LastYearChip` aus dem alten BedCard extrahiert, in `BedInlineView` reused.

Files:
- `app/garten/plan/page.tsx` (komplett umgeschrieben — mountet Editor)
- `app/garten/plan/editor/page.tsx` (Redirect-Stub)
- `app/garten/plan/editor/{EditorClient,BedCanvas}.tsx` (Lock-Mode + Thumbs-Prop + Selection-Logik)
- `app/garten/plan/editor/BedInlineView.tsx` (neu)
- `app/garten/plan/editor/PlantThumbnails.tsx` (neu)
- `app/garten/plan/PlantChips.tsx` (neu, extrahiert aus BedCard)
- `app/garten/plan/BedCard.tsx` (gelöscht — durch BedInlineView abgelöst)
- `package.json` (`use-image`)

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
