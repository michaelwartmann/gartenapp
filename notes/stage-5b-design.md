# Stage 5B — Design Notes

Dokumentiert die Entscheidungen hinter dem visuellen Beet-Editor, damit Stage 5C (Foto-Hintergrund) und spätere Editor-Features auf dieselbe Foundation aufbauen.

## Library-Wahl: react-konva, kein use-gesture

- **`react-konva` + `konva`** sind installiert. Konvas `<Group draggable>` und `<Transformer>` decken Move + Resize vollständig ab — kein `@use-gesture/react` nötig.
- `@use-gesture/react` wäre eine zweite Gesture-Layer für HTML-Elemente; Konva hat eigenes Touch-/Maus-Handling. Doppelt brauchen wir's nicht.
- Sollte später Pinch-Zoom auf den Stage oder Mehrfinger-Resize gewünscht sein, kann `use-gesture` nachgerüstet werden ohne den Editor neu zu schreiben.

## Koordinatensystem

- **Logischer Canvas: 480 × 720 px** (portrait). Werte in `beds.x/y/w/h` sind diese logischen Pixel.
- **Render-Skalierung:** `EditorClient` misst die verfügbare Container-Breite via `clientWidth` und setzt Stage `scaleX/scaleY` entsprechend (max 1, kleiner für Screens unter 480 px CSS). DB-Werte bleiben in logischen px — die Skala ist reine Render-Sache.
- **DragBoundFunc** rechnet Stage-Koordinaten (post-scale) in logische Koordinaten zurück, clampt, und gibt skalierte zurück.
- Folgen für 5C: ein Foto-Hintergrund kommt als `<KonvaImage>` als hinterster Layer, in denselben logischen 480×720 px. Beim Upload wird auf diese Größe gefittet (centered, contain).

## Form pro Beet-Art

- `topf` und `kuebel` → `<Ellipse>` (rund, wie in echt)
- Alle anderen → `<Rect cornerRadius={8}>`
- Bounding-Box-Schema (`x/y/w/h`) ist identisch — Drag + Transformer arbeiten unabhängig von der Form. Ellipse rendert mit `radiusX = w/2, radiusY = h/2` und Center bei `(x + w/2, y + h/2)` *innerhalb der Group* (Group-Position bleibt top-left).
- Quadratischer Default für runde Kinds (`w = h`) im Auto-Layout, damit sie als Kreis erscheinen statt als Ellipse.

## Auto-Layout für Bestand

- 2-Spalten-Kaskade: `marginX=30, marginY=30, cellW=200, cellH=120, gapX=20, gapY=20`
- Index = Position im `created_at`-sortierten Array
- Markiert via `autoLaid: true` → triggert das initial-dirty-Flag, sodass „Speichern" sofort verfügbar ist und der Banner „Beete wurden automatisch angeordnet" erscheint
- Reine client-seitige Berechnung in `assignDefaultPositions()` (Pure-Function); persistiert erst beim Save

## Tap-vs-Drag-Disambiguierung

- `dragDistance={4}` auf jedem Group — Touches unter 4 px Drift zählen als Tap, nicht als Drag-Start
- Tap-Logik: erster Tap setzt `selectedId`, zweiter Tap auf das *bereits selektierte* Beet öffnet das `EditBedSheet`
- Tap auf Stage-Background deselektiert (klar erkennbar an Klick auf `e.target.getStage()`)
- Vorteil dieses Patterns: keine Long-Press-Geste nötig, alles ist mit einem Finger erreichbar, kein Modi-Toggle

## Server-Action `updateBedLayout`

- In `app/garten/plan/actions.ts`
- Validiert: Garden-Cookie, finite numbers, batch-Limit 200, Garden-Ownership in *einer* Query (`select id where garden_id=? and id in (...)`), keine Partial-Commits bei Fehler
- Server clampt zusätzlich zu Canvas-Bounds + MIN_BED — Defense-in-Depth gegen manipulierte Client-State
- Batched-Update via `Promise.all` (für ~5–10 Beete pro Garten reicht das; bei mehr in einer SQL-CASE-WHEN-Update zusammenfassen)
- `revalidatePath('/garten/plan')` und `'/garten/plan/editor'` damit der Server-Component-Cache neu lädt

## Was nicht passiert ist (bewusst)

- Kein Snap-to-Grid — wenn der free-form-Approach zu chaotisch wird, kann ein 8-px-Snap nachgeschoben werden
- Kein Undo/Redo
- Kein Pinch-Zoom auf den Stage
- Beete werden im Editor *nicht* mit Pflanzen-Inhalt angezeigt — der Editor ordnet nur Layouts an. Plant-Add bleibt im Listen-View
- Kein Persistieren von Zoom/Pan im DB

## Foundation für Stage 5C

Stage 5C (Foto-Hintergrund) erbt:
- Logische 480×720-px-Welt
- Stage-Skalierungs-Pattern via `EditorClient`-Wrapper
- `dynamic({ssr:false})`-Loading
- BedCanvas-Strukur — Foto wird ein zusätzlicher Layer *vor* dem Beet-Layer mit Opazitäts-Slider im Top-Bar
