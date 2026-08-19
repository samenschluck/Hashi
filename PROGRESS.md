# PROGRESS.md — Bridgelet

Stand: 2026-08-19

## Erledigt

### Vorbereitung

- `PLAN.md` erstellt und freigegeben, Entscheidungen E1–E8 getroffen (siehe dort, Abschnitt 10).
- Tech-Stack gegen die npm-Registry verifiziert, AdMob-Plugin-API aus den ausgelieferten
  Typdefinitionen von `@capacitor-community/admob@8.1.0` gelesen statt aus dem Gedächtnis.

### M0 — Projektgerüst (`chore/m0-setup`, PR #1)

- Vite 8, React 19.2, Tailwind 4, Zustand 5, Vitest 4, TypeScript strict.
- ESLint erzwingt die Schichtentrennung (`src/core/` ohne React/Capacitor, Renderer ohne
  React, native Plugins nur in `src/services/`).
- App-Layout reserviert die Bannerhöhe fest über `--banner-h`.
- CI: Lint, Prettier, Typecheck, Tests, Laufzeitmessung, Web-Build.

### M1 — Spiellogik, Solver, Generator (`feat/m1-core`)

- `PuzzleState`: Züge, Undo/Redo, Reset, Regelvalidierung, Gewinnprüfung mit Union-Find.
- Sieben benannte Deduktionsregeln (D1–D7) in einem Constraint-Store mit Trail-basiertem
  Backtracking.
- Solver: Propagation plus Backtracking, zählt Lösungen mit Abbruch bei 2.
- Generator: Rückwärtskonstruktion mit **iterativer Nachbesserung** statt blindem
  Verwerfen — solange ein Netz mehrdeutig ist, kommt eine Verbindung dazu.
- Tipp-System inklusive Erkennung falsch gesetzter Brücken.
- 45 Unit-Tests, davon 200 verifizierte Rätsel je Schwierigkeitsgrad.

## Messwerte

Generierungszeit über je 30 Läufe, lokal (Node 22):

| Grad    | Median  | p95     | Max     |
| ------- | ------- | ------- | ------- |
| Einfach | 1,6 ms  | 4,3 ms  | 6,7 ms  |
| Mittel  | 3,1 ms  | 11,3 ms | 14,1 ms |
| Schwer  | 10,5 ms | 36,5 ms | 48,4 ms |
| Experte | 33,4 ms | 211 ms  | 247 ms  |

Die geforderte Grenze von 500 ms für Experte wird damit nicht nur im Median, sondern in
jedem einzelnen gemessenen Lauf eingehalten. Das vereinbarte Median-Kriterium (E2) war am
Ende gar nicht nötig — es bleibt trotzdem als Absicherung gegen langsame CI-Runner stehen.

Der Eindeutigkeitstest über 4 × 200 Rätsel (inklusive unabhängiger Nachprüfung durch den
Solver) läuft in rund 15 Sekunden. Die volle Stichprobe aus E3 bleibt damit ohne
Einschränkung im Standard-CI-Lauf.

## Offen

- **M2** Canvas-Rendering und Touch-Eingabe
- **M3** Spielfluss, Meta, Persistenz, vorgenerierte Rätsel, Daily
- **M4** AdMob: Consent, Banner, Rewarded
- **M5** Android-Build und Store-Readiness

## Bekannte Probleme und Anmerkungen

- Kein Android SDK in der Entwicklungsumgebung: Der Gradle-/AAB-Build ist nur über den
  GitHub-Actions-Workflow verifizierbar, nicht lokal. Gerätetests (Touch-Gefühl, 60 fps,
  echte Ads) kann ich nicht durchführen.
- **Schwierigkeitsstufe „Schwer" neu definiert.** Die geplante Klasse „braucht
  Zusammenhangsschlüsse, aber keinen Widerspruchsbeweis" ist in der Messung praktisch
  leer geblieben. „Mittel" und „Schwer" unterscheiden sich jetzt über die Anzahl der
  fortgeschrittenen Schlüsse statt über deren Art. Begründung in `PLAN.md`, Abschnitt 4.4.
- Ein Tipp nennt immer die bewiesene **Untergrenze** einer Kante. Steht in der Lösung eine
  Doppelbrücke, die Deduktion beweist aber zunächst nur eine, dann nennt der Tipp eine
  Brücke. Das ist beabsichtigt: ein Tipp deckt nie mehr auf, als an dieser Stelle
  tatsächlich bewiesen ist.

## Entscheidungen, die beim Betreiber liegen

- Marken- und Namensprüfung für „Bridgelet" vor dem Play-Upload (ich leiste keine
  Rechtsberatung).
- AdMob-Konto: echte App-ID, Ad-Unit-IDs und die GDPR-Nachricht in der AdMob-Konsole.
  Ohne konfigurierte Nachricht liefert `showConsentForm()` nichts.
- Play Console: Datenschutzerklärung veröffentlichen, Data-Safety- und
  Content-Rating-Angaben verantworten. Ich liefere ausgefüllte Vorlagen.
- Release-Keystore erzeugen und als GitHub-Secret hinterlegen.
