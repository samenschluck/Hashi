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

### M2 — Rendering und Eingabe (`feat/m2-board`)

- Canvas-Renderer mit zwischengespeichertem Untergrund; gezeichnet wird nur bei
  Zustandsänderung, die Animationsschleife läuft ausschließlich während des
  Einschnappens einer Brücke und hält danach von selbst an.
- Sichtgeometrie (`src/render/view.ts`) als reine Rechnung: Zentrierung, Zoom,
  Verschiebe-Begrenzung und Trefferprüfung sind ohne Browser testbar.
- Gestenerkennung (`src/input/gestures.ts`) ebenfalls DOM-frei: Ziehen von Insel zu
  Insel, Tipp-Tipp als gleichwertige Alternative, Zwei-Finger-Zoom, Verschieben.
- Trefferfläche mindestens 48 dp, aber kleiner als eine Gitterzelle — damit sich die
  Bereiche zweier Inseln nie überlappen und ein Tippen nie mehrdeutig wird.
- Undo/Redo/Leeren, Haptik-Service mit Web-Fallback, Zustand-Store.
- `npm run ui:check` fährt die App im echten Chromium hoch, spielt beide Bedienarten
  durch und prüft die Browser-Konsole auf Fehler.

### M3 — Spielfluss, Meta und Persistenz (`feat/m3-flow`)

- Screens: Splash, Hauptmenü, Level-Auswahl (5 Seiten à 30 Level je Grad), Spiel,
  Ergebnis, Tagesrätsel mit Kalender, Statistik, Einstellungen, Spielregeln.
- **600 vorgenerierte Rätsel** (150 je Grad, 143 KB) als JSON, zur Build-Zeit über
  `npm run puzzles:generate` erzeugt. Die vier Dateien werden einzeln nachgeladen,
  nicht ins Startbundle gepackt.
- `npm run puzzles:verify` prüft alle ausgelieferten Rätsel gegen den Solver — läuft
  in der CI bei jedem Push und dauert 0,5 s.
- Endlos-Modus mit Laufzeitgenerierung in einem **Web Worker**, mit synchronem
  Rückfall, falls kein Worker verfügbar ist.
- Tagesrätsel mit datumsbasiertem Seed, Kalenderansicht, Streak-Zähler.
- Tipp-System angeschlossen: Start mit 5 Tipps, 2 Gratis-Tipps pro Tag, Begründung
  im Klartext unter dem Brett.
- Persistenz über `@capacitor/preferences` (Browser: localStorage) mit **Doppelpuffer
  und Prüfsumme**, entprelltem Schreiben und sofortigem Flush beim Pausieren.
- Schemaversion mit toleranter Migration: ein beschädigter Stand kostet Fortschritt,
  aber startet die App nie ab.
- Android-Zurück-Taste auf jedem Bildschirm, Pause/Resume hält die Uhr an.
- Einstellungen: Ton, Vibration, Dark/Light/System, Linkshänder-Layout, DE/EN.

### M4 — Werbung (`feat/m4-ads`)

- Zentraler `AdService` als einziger Berührungspunkt zur AdMob-SDK, mit Browser-Mock.
- UMP-Consent **vor** der ersten Ad-Anfrage; ohne `canRequestAds` wird gar nichts
  angefragt. Menüpunkt „Datenschutzeinstellungen" erscheint nur, wenn die SDK ihn
  verlangt.
- Adaptiver Anchored Banner unten, Höhe fest im Flex-Layout reserviert und aus dem
  `bannerAdSizeChanged`-Ereignis exakt nachgeführt. Dazu 16 dp Sicherheitsabstand
  zum nächsten bedienbaren Element.
- Rewarded Video als einziger Weg zu zusätzlichen Tipps: +3 nur nach vollständig
  angesehenem Video, maximal 5 Videos pro Tag, Vorladen bei Levelstart und nach
  jedem Video.
- Test-IDs sind der Standard und lassen sich ohne echte IDs nicht abschalten.
- `npm run ads:inject-appid` schreibt die App-ID in eine Android-Ressource, weil sie
  im Manifest stehen muss und keine Laufzeitgröße ist.
- Kein Interstitial.

### M5 — Android-Build und Store-Unterlagen (`feat/m5-android`)

- Capacitor initialisiert, Bundle-ID `com.bridgelet.game`, nur Android, `android/`
  committet. `minSdk 24`, `compileSdk 36`, `targetSdk 36`.
- Manifest: nur `INTERNET` und `AD_ID`, dazu die AdMob-App-ID als Ressourcenverweis.
- Release-Signierung über `android/keystore.properties` (gitignored); fehlt die
  Datei, wird mit dem Debug-Schlüssel signiert — das fällt beim Upload auf, statt
  still etwas Falsches zu erzeugen.
- Icons und Splash über `@capacitor/assets` aus einer Quelldatei, adaptives
  Android-Icon inklusive.
- `store/`: Listings DE und EN, je 8 echte Screenshots in 1080×1920, Feature
  Graphic 1024×500, Store-Icon 512×512, Datenschutzerklärung DE/EN,
  ausgefülltes Data-Safety-Formular, Antworten zum Content-Rating.
- `README.md` mit vollständiger Anleitung von `npm install` bis zum Play-Upload.
- Manuell auslösbarer Workflow **Android Release (AAB)**.
- **Nachgereicht:** Klangeffekte. Beim Abgleich mit der Anforderungsliste fiel auf,
  dass es zwar einen Ton-Schalter in den Einstellungen gab, aber keinen Ton. Die
  vier Effekte werden mit der Web Audio API erzeugt, ganz ohne Audiodateien.

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

Alle geplanten Meilensteine sind umgesetzt. Was noch aussteht, steht unten unter
„Entscheidungen, die beim Betreiber liegen" und unter „Bekannte Probleme".

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
