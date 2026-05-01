# Stage 5 — Gartenplan mit Jahres-Gedächtnis & Fruchtfolge (zurückgestellt)

**Status:** Zurückgestellt. Braucht mehr Zeit und Fokus als ein Abend-Sprint.
Hier festgehalten, damit der Gedankengang nicht verloren geht.

**Datum erfasst:** April 2026
**Inspiriert durch:** Kim — sie macht im Frühjahr immer eine Skizze ihres
Gartens, schaut was sie für Saatgut hat, was wo letztes Jahr stand, und
plant daraus die Fruchtfolge (Starkzehrer → Schwachzehrer → …).

---

## Was wir gelernt haben

Ursprüngliche Idee: ein "virtueller Garten" wie die IKEA-App — Beete und
Hochbeete drag-and-droppen, evtl. mit Satellitenbild oder AR.

Nach Kim's Feedback: das ist eigentlich **kein Layout-Tool**, sondern ein
**Jahresplanungs-Tool mit Fruchtfolge-Gedächtnis**. Die Skizze ist nur
das Mittel; der eigentliche Wert ist:

- Was war wo letztes Jahr?
- Was kann ich daraus dieses Jahr im selben Beet pflanzen
  (Fruchtfolge-Regel, Familienwechsel, Stark-/Schwachzehrer-Rhythmus)?
- Wo soll mein Saatgut hin?

Das verschiebt die App vom Pflanzen-Tracker zum **Gärtner-Coach** — und
passt damit perfekt neben "Was kann ich pflanzen?" (Stage 4A) und "Diese
Woche" (Stage 4B). Ein dritter Pfeiler.

---

## Konzept

### Drei Datenebenen

1. **Beet** — bleibt jahrelang stehen. Hochbeet hinten, Frühbeet, Topf
   am Fenster. Hat Position auf dem Skizzen-Layout, Größe, Typ.
2. **Saison** — Jahr (oder: Frühjahr/Sommer/Herbst, wenn wir
   Folgekulturen erlauben).
3. **Bepflanzung** — pro Beet pro Saison: welche Pflanzen, ggf. mit
   Notizen. Diese Tabelle ist das eigentliche Gedächtnis.

### Beet-Gedächtnis als Hauptfeature

Im Frühjahr 2027 tippt Kim das Hochbeet an und sieht:

> *Letztes Jahr (2026): Tomate, Basilikum (Starkzehrer,
> Nachtschattengewächs).*
>
> *Vorschlag 2027: Schwachzehrer wie Salat, Möhre, Kräuter — oder
> Hülsenfrüchte (Bohne, Erbse) zur Bodenerholung. Lieber nicht:
> Kartoffel, Aubergine, Paprika (gleiche Familie, Krankheitsdruck).*

Das ist Gemini-Arbeit. Wir haben fast alles, was wir dafür brauchen.

### Best-Practice-Regeln (klassische Fruchtfolge)

- **3-4 Jahres-Familien-Rotation** — kein Brassica nach Brassica
- **Starkzehrer → Mittelzehrer → Schwachzehrer → Gründüngung**
- **Mischkultur im Beet** (gut/schlecht-Nachbarn — schon im Einsatz für
  /empfehlungen)
- **Saisonale Boden-Erinnerungen** (Kompost im Herbst, Gründüngung im
  Spätsommer, Mulch im Sommer)

---

## Was wir schon haben (Wiederverwendung)

| Vorhanden | Datei / Quelle |
|---|---|
| `stark_oder_schwachzehrer` pro Pflanze | `data/plants.json`, `lib/supabase.ts` |
| `nachbarn` mit "gut: ... Schlecht: ..." | `data/plants.json` |
| `extractSchlechtNames()` Parser | `lib/recommendPlants.ts:10` |
| `hasCompanionConflict()` | `lib/recommendPlants.ts:22` |
| `planted_at`-Historie pro Pflanze | seit Stage 4A, in `garden_plants` |
| Gemini-Wrapper-Pattern (System Prompt + responseSchema) | `lib/recommendPlants.ts`, `lib/weeklyTasks.ts` |
| Gemini-Autofill-Pipeline für Pflanzen | `lib/enrichPlant.ts`, `app/browse/add` |
| Tagescaching auf Garden-Ebene | `lib/getWeeklyTasks.ts` |

## Was uns fehlt

| Fehlt | Wie zu beschaffen |
|---|---|
| **Pflanzenfamilie** als 17. Feld (Solanaceae, Brassicaceae, …) | Spalte zum `plants`-Schema, einmal über die existierende Gemini-Autofill-Pipeline für die 115 Pflanzen durchziehen → deterministisch verfügbar |
| **Beet-Tabelle** mit Position/Größe/Typ + JSON-Layout pro Garten | Neue Tabelle `beds` + JSONB-Layout-Spalte auf `gardens` |
| **Bepflanzungs-Historie pro Beet pro Saison** | Neue Tabelle `bed_plantings { bed_id, season_year, plant_id, planted_at, removed_at?, notes }` |
| **Visueller Editor (Drag & Drop)** | SVG oder `react-konva` + `@use-gesture/react` für Touch — der UX-aufwendigste Teil |
| **Fruchtfolge-Empfehlung** — neue Gemini-Funktion | `lib/recommendRotation.ts` mit Schema `{ recommended: [...], avoid: [...], reasoning }` |

---

## Aufwand-Schätzung

- Statisches Skizzen-Layout (Stufe 1): ~2 Wochen Abendarbeit
- + Foto-Hintergrund (Stufe 2): +2-3 Tage
- + Beet-Gedächtnis & Fruchtfolge-Coach: +1-1,5 Wochen

**Gesamt: ~3-4 Wochen** Abendarbeit für ein vollwertiges Planungswerkzeug.

Risiken:
- **Touch-UX am Handy** (PWA-Vollbild auf iOS) — der größte Unbekannte.
  Erst Prototyp, dann Vollausbau.
- **Scope wächst schnell** — Sonnen-/Schattenverlauf, Bewässerung,
  Pflanzabstände werden alle natürliche Wünsche, sobald das Layout da
  ist. Hart in Stufe 1+2 enden.
- **App-Konzept verschiebt sich** — Liste vs. räumliche Sicht,
  zwei Top-Level-Modi. Discoverability + Bedienlogik müssen klar sein.

---

## Offene Fragen für Kim

1. **Wie viele Jahre Historie?** Best Practice = 3-4 Jahre für
   Familien-Rotation. 1 Jahr ist Minimum für die Fruchtfolge-Regel.
2. **Wann startet eine neue Saison?** Manueller "Saison 2027 starten"-
   Knopf im Frühjahr, oder automatisch beim Datumswechsel?
3. **Folgekulturen im gleichen Beet erlaubt?** z.B. Radieschen im April →
   Bohnen im Juni → Feldsalat im September. Im echten Leben sehr üblich.
   Wenn ja, wird `bed_plantings` ein Zeitfenster (von/bis), nicht nur
   ein Jahresslot.
4. **Wie genau die Pflanzen-Platzierung im Beet?** Variante A (Pflanzen
   pro Beet, ohne Koordinaten) reicht meist. Variante B (Pflanzen
   punktgenau im Beet) ist 2-3× aufwendiger und am Handy fummelig.
5. **Ein Garten = ein Plan, oder mehrere?** Hauptgarten + Balkon +
   Schrebergarten — ein Layout oder mehrere?
6. **Foto-Hintergrund:** ein Foto pro Garten, oder zusätzlich pro Beet
   (Detailfoto)?

---

## Empfohlener Bauplan, wenn wir starten

1. **Schema-Ergänzungen** (manuell SQL im Supabase Editor):
   - `plants.family TEXT` (Pflanzenfamilie)
   - `beds (id, garden_id, label, kind, layout_json)` neue Tabelle
   - `bed_plantings (id, bed_id, plant_id, season_year, planted_at,
     removed_at, notes)` neue Tabelle
2. **Pflanzenfamilie backfillen** — Skript analog zu
   `npm run generate-images`, ruft Gemini einmal pro Pflanze und füllt
   `family`. Idempotent (nur wo `family IS NULL`).
3. **Beet-Editor** als neue Route `/garten/plan` — leeres Rechteck,
   Beete als verschiebbare/skalierbare Kacheln. Erst statisch, dann
   Drag & Drop. Speichert in `gardens.layout_json`.
4. **Beet-Detail** — Tap auf Beet öffnet Modal/Sheet mit:
   letzter Saison + aktueller Bepflanzung + "Pflanzen hinzufügen"-Button.
5. **Fruchtfolge-Empfehlung** als neuer Gemini-Wrapper
   `lib/recommendRotation.ts`, getriggert beim "Pflanze hinzufügen"
   in einem Beet, das Vorjahres-Daten hat.
6. **Mein Garten erweitern** — toggle "Liste / Plan" oben, oder Plan
   als optionaler Block. Discoverability klären.
7. **"Diese Woche" beet-aware machen** — Tasks beziehen sich auf
   Beete ("Tomaten im Hochbeet ausgeizen"), nicht nur Pflanzen.

---

## Discussion doc für Kim (zum Weiterleiten)

*Hi Kim — du hattest gefragt, ob man den Garten in der App auch visuell
anlegen kann (so wie man Möbel in der IKEA-App stellt), und ob ein
Satellitenbild als Grundlage funktioniert. Hier ist ehrlich was möglich
ist, was nicht, und wo wir entscheiden müssten.*

### TL;DR

**Stufen 1 + 2 + Fruchtfolge-Gedächtnis** wären die richtige Größe —
etwa 3-4 Wochen Abendarbeit, riesiger Mehrwert als Planungswerkzeug.
Satellitenbild und AR (wie IKEA Place) lassen wir lieber weg.

### ✅ Was wir bauen würden

**Stufe 1 — Schematischer Gartenplan**
Leeres Rechteck = dein Garten. Du ziehst Beet, Hochbeet, Gewächshaus,
Topf rein, gibst ihnen Namen, ordnest Pflanzen zu. Nordpfeil oben.

**Stufe 2 — Foto als Hintergrund**
Foto deines Gartens (aus dem Fenster oder per Drohne) als Hintergrund,
Beete drauf zeichnen. Fühlt sich echt an.

**Stufe 3 (neu, durch dein Feedback) — Jahres-Gedächtnis & Fruchtfolge**
Jedes Beet merkt sich, was die letzten Jahre drin war. Im Frühjahr
schlägt die App vor, was rein passt — Fruchtfolge, Familienwechsel,
Stark/Schwachzehrer-Rhythmus, Mischkultur. Aus deiner Frühjahrs-Skizze
wird ein lebendiges Planungswerkzeug.

### ❌ Was wir weglassen würden

**Echtes Satellitenbild** — meist zu unscharf (~50 cm/Pixel) und 2+
Jahre alt. Ein Foto aus deinem Fenster ist besser. Maps-API kostet,
Datenschutz wird komplizierter.

**Augmented Reality (wie IKEA Place)** — die IKEA-App nutzt ARKit/
ARCore. Das sind native iPhone-/Android-Funktionen. Unsere Web-App kann
das nicht. Müsste komplett von Grund auf neu gebaut werden, in einer
anderen Technik. Monate Arbeit. Wäre ein eigenes Projekt.

### Offene Fragen, die wir klären sollten

1. Wie viele Jahre Historie sollen pro Beet gemerkt werden?
2. Wann startet eine neue Saison — manuell oder automatisch?
3. Sind Folgekulturen im gleichen Beet wichtig (Radieschen → Bohnen →
   Feldsalat)?
4. Pflanzen pro Beet zugeordnet (einfach) oder punktgenau im Beet
   platziert (aufwendiger)?
5. Ein Garten / ein Plan, oder mehrere (z.B. Hauptgarten + Balkon)?
6. Foto pro Garten, oder zusätzlich Detailfotos pro Beet?
