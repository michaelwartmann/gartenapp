# Release-Readiness-Test — Gartenapp End-to-End

**Zweck:** Vor dem ersten echten Gärtner (Kim) einmal die ganze Reise als
neuer User durchlaufen. Kein Skip von Schritten — der Stolperer kommt
oft an der Stelle die du nicht testest.

**Setup-Empfehlung:** *nicht* deinen echten Garten löschen. Stattdessen
einen Wegwerf-Garten `TestKim` anlegen, durchlaufen, am Ende per SQL
löschen.

---

## Pre-Flight (1 Min)

- [ ] Vercel-Build für `main` ist grün (kein Build-Fehler letzten Push).
- [ ] `notes/stage-5a-schema.sql` und `notes/stage-6-schema.sql` sind in
      Supabase eingespielt (sonst stürzt `/garten/plan` und Wetter ab).
- [ ] `npm run dev` läuft, Browser zeigt `localhost:3001` oder ähnlich.

---

## Phase 1 — Login als brandneuer User

1. **Cookies löschen** (Browser DevTools → Application → Storage → clear).
2. URL `localhost:3001` öffnen → erwartet: Redirect auf `/login`.
3. Garten-Name `TestKim` eintippen.
   - Vor dem Test muss `TestKim` als Garten in der DB existieren mit
     `password_hash = NULL`. Dafür unten der SQL-Block.
   - Erwartet: Login-Formular wechselt in „Erstes Mal hier — Passwort
     festlegen" Modus.
4. Passwort `test1234` zweimal eingeben → submit.
5. Erwartet: Redirect auf `/`, Cookie `garten_id` ist gesetzt (DevTools
   prüfen), Mein Garten ist sichtbar mit leerem Zustand.

**Falls fehlerhaft:** Login-Action `setupPassword` wirft, oder Cookie
nicht gesetzt → in iOS PWA besonders prüfen.

---

## Phase 2 — Leer-Zustand + Wetter-Setup

6. Mein Garten zeigt:
   - Header „🌱 Mein Garten" mit Buttons „🗺️ Plan" + „+ Pflanzen".
   - Wetter-Setup-Karte „📍 Wetter aktivieren" (weil noch keine PLZ).
   - Empfehlungs-CTA „🌿 Was kann ich pflanzen?".
   - Empty-State „Dein Garten ist noch leer".

7. Wetter-Setup tippen → Form aufklappen.
   - Land **DE** ist Default.
   - PLZ `46419` (Anholt) eingeben → Speichern.
   - Erwartet: Form schließt, 7-Tage-Streifen erscheint mit Tagesnamen
     (Heute, Morgen, Mi, Do, Fr, Sa, So oder ähnlich), Tmax/Tmin pro Tag,
     Niederschlag-Zahl wenn ≥1 mm.
   - Lokationslabel oben rechts: „Anholt, Nordrhein-Westfalen" o.ä.

8. Streifen-Optik prüfen:
   - 7 Spalten gleich breit, **kein** horizontaler Scroll.
   - Wenn ein Tag eine Warnung hat → Tag-Karte rot umrandet.
   - Wenn ein Tag einen Hinweis hat (warmer Tag, viel Regen, starker
     Wind) → Tag-Karte sandfarben umrandet.
   - Heute oder morgen mit Severe-Event → Banner unter dem Streifen.

**Falls Streifen leer bleibt:** Open-Meteo down, Geocoding fehlgeschlagen,
oder PLZ falsch. Sollte nicht stillschweigend brechen — Streifen sollte
dann erst gar nicht erscheinen, Setup-Banner bleibt sichtbar.

---

## Phase 3 — Erste Pflanze hinzufügen

9. „+ Pflanzen" oben rechts tippen → Katalog `/browse` öffnet sich.
   - Erwartet: 115 Pflanzen sichtbar, Filter „Alle/Gemüse/Kraut/Blume/Obst",
     Suchfeld.
10. Suche `Tomate` → Filter → Tomate sollte als Karte erscheinen.
11. „+ Hinzufügen" auf der Tomate-Karte → wird zu „✓ Im Garten".
12. Zurück auf Mein Garten (← Mein Garten oben links).
13. Erwartet: Tomate ist unter „Meine Samen" (weil `planted_at = NULL`).
    Karte zeigt Pflanzennamen + lateinischen Namen, KEINE Beet-Zeile
    (weil noch kein Beet).

---

## Phase 4 — Plant-Detail + Override

14. Tomate-Karte tippen → `/plants/[id]`.
15. Erwartet:
    - Header-Bild (kawaii illustration, falls vorhanden).
    - Pflanze + lateinischer Name + Kategorie-Pill.
    - Großer grüner „🌱 Gepflanzt"-Button (weil noch nicht gepflanzt UND
      noch kein Beet → Schnellweg-Modus).
    - 16 Felder: Sorte, Saatzeit, Saattiefe, Nachbarn, Erde, … alle als
      tappable Boxen.
16. Eines der Felder antippen, z.B. „Sorte" → Textarea + Speichern/Abbrechen.
17. „San Marzano, Ochsenherz" eingeben, Speichern.
18. Erwartet: Feld zeigt den neuen Wert. Reload prüft dass es persistiert.

---

## Phase 5 — Garten-Plan, erstes Beet

19. Zurück auf Mein Garten → „🗺️ Plan" tippen → `/garten/plan` öffnet sich.
    - Erwartet: leere Plan-Seite mit „🗺️ Noch keine Beete"-Empty-State und
      „+ Beet hinzufügen"-Knopf.
20. „+ Beet hinzufügen" → Form klappt auf.
21. Bezeichnung „Hochbeet hinten", Kind `📦 Hochbeet` wählen → Anlegen.
22. Erwartet: Beet erscheint als Karte mit:
    - 📦 Hochbeet hinten / Hochbeet (kind-Label)
    - „Diese Saison" + „Letztes Jahr" Sektionen, beide leer
    - „+ Pflanze hinzufügen" gestrichelter Knopf

---

## Phase 6 — Pflanze ins Beet, Fruchtfolge-Tipp

23. „+ Pflanze hinzufügen" am Beet → AddPlantSheet öffnet sich.
    - Erwartet: Pflanzen sortiert. Tomate (die wir vorhin in Mein Garten
      gepackt haben) sollte mit Badge `📦 Hab Samen` ganz oben erscheinen.
    - Andere Pflanzen verstecken sich erst (Toggle „Auch Katalog zeigen").
24. Tomate wählen → Confirm-View mit:
    - Pflanze + Kategorie
    - „Fruchtfolge-Tipp"-Block: „Wird geprüft …" → nach 1-3 s eine Pill
      `PASST GUT` (frisches Beet, kein Konflikt) + Begründungs-Satz.
    - Knopf „Ins Beet planen".
25. „Ins Beet planen" → Sheet schließt, Tomate erscheint als Chip im
    Beet — gestrichelter Rand, leerer Kreis ○ links (= geplant, noch
    nicht gepflanzt), kein Datum.

**Falls Tipp nicht erscheint:** Gemini hat geantwortet aber Verdict
fehlt → fallback ist `OKAY` mit „Konnte gerade keine Einschätzung laden."

---

## Phase 7 — Toggle ✓ und Datum

26. Auf den ○-Kreis am Tomate-Chip tippen.
27. Erwartet:
    - Chip wird solid mit Hintergrundfarbe der Kategorie.
    - ○ wird ✓.
    - Kleines Datum (DD.MM heute) erscheint im Chip.
28. Mein Garten reload → Tomate ist jetzt unter **„Im Garten 🌱"** statt
    „Meine Samen". Karte zeigt jetzt eine grüne Beet-Zeile „📦 Hochbeet
    hinten".

---

## Phase 8 — Plant-Detail mit Beet

29. Zur Tomate-Detail-Seite zurück.
30. Erwartet:
    - Großer „Gepflanzt"-Knopf ist **weg** (weil Pflanze in einem Beet ist).
    - Stattdessen ein Info-Block oben: „🌱 Im Garten seit DD.MM.YYYY ·
      heute gepflanzt" (oder X Tage alt).
    - Sektion „🗺️ Im Plan" mit der Hochbeet-Zeile:
      - Beet-Icon + Label
      - „gepflanzt seit DD.MM.YYYY" + „Datum ändern"-Link
      - Toggle ✓ (solid grün) rechts.
31. „Datum ändern" tippen → Datums-Input. Setze auf 7 Tage in Vergangenheit.
32. Speichern → erwartet: Im-Plan-Zeile zeigt neues Datum, Alters-Header
    oben zeigt „1 Woche alt".
33. Mein Garten reload → Karte sollte unter „Im Garten" mit dem
    rückdatierten Datum als globale Wahrheit (Datum ist nicht direkt
    sichtbar auf der Karte, aber „Im Garten" Sektion ist konsistent).

---

## Phase 9 — Letztes Jahr & Fruchtfolge-Warnung

34. Zurück zum Garten-Plan.
35. Im Beet „+ ergänzen" bei „Letztes Jahr" → Sheet öffnet sich, Titel
    „Letztes Jahr im Beet" (statt „Pflanze ins Beet"), kein
    Fruchtfolge-Tipp.
36. Tomate erneut wählen → „Als Vorjahres-Pflanze hinzufügen".
37. Erwartet: kleines, gedimmtes Vorjahres-Chip „Tomate" mit · 2025.
38. Jetzt erneut „+ Pflanze" diese Saison → Tomate wählen → Tipp prüfen.
    - Erwartet: `LIEBER NICHT` oder `OKAY` mit Hinweis „Letztes Jahr
      standen hier Tomaten" oder ähnlich (Familie Solanaceae).

**Falls Tipp keinen Familien-Hinweis hat:** `family` für Tomate ist null
in der DB → `npm run backfill-families` laufen lassen.

---

## Phase 10 — Companion-Konflikt

39. Im Beet „+ Pflanze" → Tomate ist da, jetzt suche `Kartoffel`.
    - Suche aktivieren um Katalog-Modus.
    - Wenn Kartoffel im Katalog → wählen.
40. Erwartet: Fruchtfolge-Tipp ist `LIEBER NICHT` mit
    „Tomate und Kartoffel sind im selben Beet ein bekannter Konflikt
    — lieber trennen." (deterministisch aus dem Companion-Pre-Filter,
    sehr schnell, keine Gemini-Latenz).

---

## Phase 11 — 🌾 Abgeerntet (Folgekultur / Vorzucht)

41. Auf einem ✓-Chip in der „Diese Saison"-Liste das 🌾-Icon tippen.
42. Erwartet:
    - Chip wird durchgestrichen + auf ~55% gedimmt
    - Toggle ✓ verschwindet
    - 🌾 wird zu ↶ (rückgängig)
43. ↶ tippen → Chip kehrt in den ✓-Zustand zurück.

**Vorzucht-Workflow als Test:**
44. Neues Beet `Gewächshaus`, kind `🏠 Gewächshaus` anlegen.
45. Tomate dort hinzufügen, ✓, Datum auf 15.02. zurückdatieren.
46. Mein Garten: „Im Garten seit 15.02.2026 · X Wochen alt" sollte stimmen.
47. Gewächshaus-Chip 🌾 abernten → durchgestrichen.
48. Tomate ins Hochbeet packen (sollte schon da sein, sonst neuer Eintrag),
    Datum auf heute.
49. Plant-Detail: Alters-Header sollte **immer noch 15.02.2026** als Beginn
    zeigen — nicht zurückgesetzt.

---

## Phase 12 — Diese Woche Tasks (Gemini + Wetter)

50. Mein Garten — „📋 Diese Woche" Sektion sichtbar?
    - Erwartet: 0 bis 8 Tasks. Jeder Task hat Pill `JETZT` / `DIESE
      WOCHE` / `DEMNÄCHST`, Aufgabentext, Begründung.
    - Begründung sollte das Wetter erwähnen wenn relevant: „morgen
      Regen", „die nächsten Tage warm und trocken", o.ä.
    - Tap auf einen Task → führt zur Plant-Detail der jeweiligen Pflanze.

**Falls keine Tasks:** valide wenn nichts Saisonales ansteht. Aber
prüfe Vercel-Logs / Console — Gemini-Fehler oder Cache-Bug?

---

## Phase 13 — Empfehlungen

51. Vom Mein Garten den dashed Knopf „🌿 Was kann ich pflanzen?" tippen.
52. Fragebogen: Sonne/Platz/Vorlieben + Freitext „Ich habe Romanesco-Samen,
    geht das?"
53. Submit → erwartet:
    - Idea-Block oben mit Verdict (`good` / `mixed` / `tricky` / `none`)
      und 2-5 Sätzen Kommentar.
    - 5-8 Vorschläge als Karten mit Pflanze + Begründung.
    - HARTE REGEL: keine Pflanze die schon im Garten ist.
    - HARTE REGEL: keine Pflanze die schlechter Nachbar zu Tomate ist
      (Kartoffel sollte ausgefiltert sein).

---

## Phase 14 — Manuelle Pflanze (Gemini-Autofill)

54. Im Katalog ganz unten „+ Pflanze fehlt? Selbst hinzufügen" tippen.
55. Name `Mangold`, Kategorie Gemüse → Anlegen.
56. Erwartet:
    - Sofortige Weiterleitung zu `/plants/[id]?fresh=1`.
    - „✨ Wird im Hintergrund mit KI ausgefüllt" Banner.
    - Nach 6-14 Sekunden lädt sich die Seite neu (zwei Auto-Reloads), 16
      Felder + lateinischer Name + Kawaii-Bild erscheinen.

**Falls Felder leer bleiben nach 30 s:** Gemini hat versagt. Prüfe
`GOOGLE_AI_API_KEY` in Vercel envs.

---

## Phase 15 — Cleanup

Nach erfolgreichem Durchlauf, im Supabase SQL Editor ausführen:

```sql
-- Löscht TestKim und alle abhängigen Daten (CASCADE auf
-- garden_plants, beds, bed_plantings via ON DELETE CASCADE)
DELETE FROM gardens WHERE owner_name = 'TestKim';

-- Falls Mangold beim Test angelegt wurde und nicht produktiv genutzt
-- werden soll:
-- DELETE FROM plants WHERE name = 'Mangold';
```

---

## SQL zum Anlegen von TestKim (vor dem Test)

```sql
INSERT INTO gardens (owner_name) VALUES ('TestKim');
-- password_hash bleibt NULL → erste Login wird als Setup behandelt
```

---

## Smoke-Test-Notizen pro Phase

Wenn etwas nicht funktioniert: Console (DevTools) + Vercel-Logs prüfen.
Häufige Stolperer:

- **„column gardens.zip_code does not exist":** Schema-SQL nicht
  ausgeführt.
- **Beet-Liste leer obwohl angelegt:** Cookie `garten_id` falsch / fehlt.
- **Picker leer:** `listAvailablePlants` wirft → Supabase RLS-Konfiguration
  prüfen, sollte über admin-Client laufen.
- **Wetter zeigt komische PLZ:** Zippopotam hat erste Treffer geliefert,
  bei mehrdeutigen PLZs gerne über Setup-Karte korrigieren.
- **Gemini-Tasks leer trotz Pflanzen:** Cache hat einen leeren Tasks-
  Eintrag → `gardens.weekly_tasks_cache = NULL` setzen, Reload.

---

## Was NICHT durch dieses Skript getestet wird

- iOS PWA install-Flow auf einem echten iPhone (Cookies, Standalone-Mode)
- Email-basiertes Forgot-Password (Resend muss konfiguriert sein)
- Multi-User-Effekte (zwei User editieren gleichen Garten — sollte nicht
  passieren)
- Lange Pflanzendaten / sehr viele Beete (Performance)
- Wetter-Cache-Refresh nach 6 h Stale (würde 6 h Wartezeit erfordern)

Das sind alles Restrisiken die wir bei Bedarf gezielt prüfen.
