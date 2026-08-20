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
| Einfach | 1,2 ms  | 6,8 ms  | 8,4 ms  |
| Mittel  | 1,5 ms  | 12,6 ms | 16,9 ms |
| Schwer  | 10,6 ms | 34,5 ms | 58,3 ms |
| Experte | 15,9 ms | 49,8 ms | 70,6 ms |

Die geforderte Grenze von 500 ms für Experte wird damit nicht nur im Median, sondern in
jedem einzelnen gemessenen Lauf eingehalten. Das vereinbarte Median-Kriterium (E2) war am
Ende gar nicht nötig — es bleibt trotzdem als Absicherung gegen langsame CI-Runner stehen.

Der Eindeutigkeitstest über 4 × 200 Rätsel (inklusive unabhängiger Nachprüfung durch den
Solver) läuft in rund 15 Sekunden. Die volle Stichprobe aus E3 bleibt damit ohne
Einschränkung im Standard-CI-Lauf.

## Offen

Alle geplanten Meilensteine sind umgesetzt. Was noch aussteht, steht unten unter
„Entscheidungen, die beim Betreiber liegen" und unter „Bekannte Probleme".

## Nachbesserung: Schwierigkeit statt Größe

Nach dem ersten spielbaren Stand fiel im Test auf, dass die Grade vor allem über die
Boardgröße gestaffelt waren — die Rätsel wurden dadurch länger, nicht schwerer. Die
Messung bestätigte das: Der Anteil echter Einsichten an allen Deduktionsschritten lag
bei 5 % („Mittel") bis 20 % („Experte"), der Rest war mechanische Buchhaltung.

Geändert wurde:

- **Kleinere Bretter** — 7 / 9 / 10 / 12 statt 7 / 10 / 13 / 17. „Experte" war auf einem
  Telefon ohnehin nur mit ständigem Zoomen bedienbar.
- **Neue Einstufung** (`DIFFICULTY_CRITERIA`) aus Deduktionstiefe, Mindestzahl
  fortgeschrittener Schlüsse und Obergrenze für Leerlaufstrecken dazwischen.
- **Zwei neue Deduktionsregeln**: D9 (zwei Einsen / zwei Zweien) als wiedererkennbares
  Muster für bessere Tipps, D8 (Paritätsschluss über eine Schnittkante) als echter neuer
  Schluss.
- **Prüfskripte**: `npm run puzzles:analyze` misst die Zusammensetzung der Schwierigkeit,
  `npm run rules:check` prüft alle Deduktionsregeln gegen die 600 bekannten Lösungen und
  läuft in der CI mit.

Ergebnis (Median über je 150 Rätsel):

| Grad    | Schritte alt → neu | Anteil Einsichten | mit D1–D4 allein lösbar |
| ------- | ------------------ | ----------------- | ----------------------- |
| Mittel  | 34 → 34            | 5,2 % → 9,4 %     | 61 % → 32 %             |
| Schwer  | 61 → 55            | 12,0 % → 15,1 %   | 26 % → 15 %             |
| Experte | 107 → 86           | 20,2 % → 22,0 %   | 9,6 % → 7,0 %           |

Alle 600 Rätsel wurden neu erzeugt und erneut auf Eindeutigkeit geprüft.

## Nachbesserung 2: Mauern, verborgene Zahlen, Sterne

Rückmeldung nach dem Spieltest: „Schwer" besteht fast nur aus Einsen und Zweien
und lässt sich durch Probieren lösen. Die Messung bestätigte den ersten Teil —
bei „Experte" war fast die Hälfte aller Inseln eine Zwei und es gab keine
einzige über 4.

Die naheliegende Gegenmaßnahme wurde geprüft und **verworfen**: Ein Generator
mit Knotenpunkt-Bevorzugung hob den Anteil hoher Inselzahlen von 9,6 auf 22,6 %,
senkte dabei aber den Anteil fortgeschrittener Schlüsse von 15,1 auf 12,0 %.
Hohe Zahlen sind stark eingeschränkt und damit Geschenke, keine Hürden.

Was stattdessen gebaut wurde:

- **Mauern** — gesperrte Zellen, die Sichtlinien unterbrechen. Wirkung auf die
  messbare Deduktionstiefe: leicht negativ. Sie bleiben, weil sie eine Art von
  Arbeit hinzufügen, die der Solver nicht kennt (Sichtlinien mit dem Auge
  verfolgen). Das ist eine bewusste Entscheidung gegen die Messung, kein
  Versehen.
- **Inseln mit verborgener Zahl** — der wirksamste Hebel. Anteil
  fortgeschrittener Schlüsse bei „Schwer" 14,9 → 18,0 %, bei „Experte"
  21,0 → 39,1 %. Stufe 3 ist damit zum ersten Mal keine leere Klasse mehr.
- **Sterne pro Level** — 3 ohne Tipp und Rückgängig, 2 mit Rückgängig, 1 mit
  Tipp. Bestes Ergebnis bleibt gespeichert, blockiert nie den Fortschritt.

Ebenfalls vorgeschlagen und **abgelehnt**: begrenztes Rückgängig mit belohnten
Videos für weitere Versuche. Begründung in `PLAN.md`, Abschnitt 4.4c —
kurz: Es widerspricht der Vorgabe „keine Verlierbedingung", macht das Rätsel
nicht schwerer, sondern nur die Strafe größer, und bestraft auf einem Telefon
Fehlgriffe statt Denkfehler.

Stand danach (Median über je 150 Rätsel):

| Grad    | Inseln | Schritte | Anteil Einsichten | mit D1–D4 allein lösbar |
| ------- | ------ | -------- | ----------------- | ----------------------- |
| Einfach | 10     | 14       | 0 %               | 100 %                   |
| Mittel  | 15     | 33       | 10,3 %            | 37 %                    |
| Schwer  | 21     | 52       | 18,0 %            | 29 %                    |
| Experte | 31     | 82       | 39,1 %            | 3 %                     |

## Bekannte Probleme und Anmerkungen

- Kein Android SDK in der Entwicklungsumgebung: Der Gradle-/AAB-Build ist nur über den
  GitHub-Actions-Workflow verifizierbar, nicht lokal. Gerätetests (Touch-Gefühl, 60 fps,
  echte Ads) kann ich nicht durchführen.
  **Teilweise erledigt am 20.08.2026:** Der Release-Workflow ist erstmals durchgelaufen
  (Lauf 1, Version 1.0.0, versionCode 1). Gradle-Build erfolgreich in 3 min 15 s, AAB
  6,5 MB, und `keytool -printcert` bestätigt die Signatur mit dem Release-Schlüssel statt
  mit dem Debug-Schlüssel. Damit ist der Bauweg bewiesen; offen bleiben nur die Punkte,
  die ein echtes Gerät brauchen.
- **Schwierigkeitsstufe „Schwer" neu definiert.** Die geplante Klasse „braucht
  Zusammenhangsschlüsse, aber keinen Widerspruchsbeweis" ist in der Messung praktisch
  leer geblieben. „Mittel" und „Schwer" unterscheiden sich jetzt über die Anzahl der
  fortgeschrittenen Schlüsse statt über deren Art. Begründung in `PLAN.md`, Abschnitt 4.4.
- **Stufe 3 bleibt auch mit der neuen Paritätsregel D8 fast leer.** D6 und D8 setzen beide
  eine Engstelle im Möglichkeitsgraphen voraus; über 600 Bretter hinweg entschied D8
  zwei Mal, D6 elf Mal. Der Versuch, solche Engstellen über die Wachstumsstrategie des
  Generators zu erzwingen (`growthRecency`), hat das nur unwesentlich verschoben. Beide
  Regeln bleiben im Solver, weil sie korrekt sind und dort, wo sie greifen, einen guten
  Tipp liefern — als eigene Schwierigkeitsstufe taugen sie nicht.
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
