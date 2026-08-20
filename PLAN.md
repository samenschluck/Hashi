# PLAN.md — Bridgelet (Hashiwokakero) für Android

Stand: 2026-08-19 · Status: **freigegeben, Umsetzung läuft**

Dieses Dokument beschreibt Architektur, Datenmodell, Algorithmen, Build-Pipeline und
Meilensteine. Abschnitt 10 hält die getroffenen Entscheidungen fest, Abschnitt 11 die
bekannten Risiken.

---

## 1. Verifizierter Tech-Stack

Alle Versionen wurden gegen die npm-Registry geprüft (Stand heute), nicht geraten.

| Paket                               | Version                      | Anmerkung                                                             |
| ----------------------------------- | ---------------------------- | --------------------------------------------------------------------- |
| `typescript`                        | 5.x (strict)                 | `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` an           |
| `react` / `react-dom`               | **19.2.x** (Entscheidung E1) |                                                                       |
| `vite`                              | 8.x                          |                                                                       |
| `zustand`                           | 5.x                          |                                                                       |
| `tailwindcss`                       | 4.x                          | v4 nutzt CSS-first-Config (`@theme`), keine `tailwind.config.js` mehr |
| `vitest`                            | 4.x                          |                                                                       |
| `@capacitor/core`, `cli`, `android` | **8.5.0**                    | „Capacitor 6+" ist erfüllt; 8 ist aktuell                             |
| `@capacitor-community/admob`        | **8.1.0**                    |                                                                       |
| `@capacitor/preferences`            | 8.0.1                        |                                                                       |
| `@capacitor/haptics`                | 8.0.2                        |                                                                       |
| `@capacitor/app`                    | 8.1.1                        | Back-Button, Pause/Resume                                             |
| `@capacitor/status-bar`             | 8.0.3                        |                                                                       |
| `@capacitor/assets`                 | 3.0.5                        | Icon-/Splash-Generierung                                              |

Capacitor 8 setzt `minSdk 24`, `compileSdk 36`, `targetSdk 36` (aus
`@capacitor/android/capacitor/build.gradle` ausgelesen). Das deckt die aktuelle
Play-Anforderung ab. Node 22 wird lokal und in CI verwendet.

**AdMob-API — verifiziert** (aus den `.d.ts` des Plugins 8.1.0, nicht erfunden):

- `AdMob.initialize({ initializeForTesting, testingDevices, tagForChildDirectedTreatment, tagForUnderAgeOfConsent })`
- Banner: `showBanner(opts)`, `hideBanner()`, `resumeBanner()`, `removeBanner()`;
  Optionen `{ adId, adSize: BannerAdSize.ADAPTIVE_BANNER, position: BannerAdPosition.BOTTOM_CENTER, margin, isTesting, npa }`
- Banner-Events: `BannerAdPluginEvents.SizeChanged` liefert `{ width, height }` in **dp** —
  darüber wird die reservierte Layout-Höhe exakt gesetzt. Weiter: `Loaded`, `FailedToLoad`, `Opened`, `Closed`, `AdImpression`, `AdPaid`.
- Rewarded: `prepareRewardVideoAd({ adId, isTesting }) → AdLoadInfo`,
  `showRewardVideoAd() → AdMobRewardItem` (resolved **wenn die Belohnung verdient ist**).
  Events: `RewardAdPluginEvents.Loaded | FailedToLoad | Showed | FailedToShow | Rewarded | Dismissed | AdImpression`.
- Consent (UMP): `requestConsentInfo({ debugGeography, testDeviceIdentifiers, tagForUnderAgeOfConsent }) → { status, isConsentFormAvailable, canRequestAds, privacyOptionsRequirementStatus }`,
  `showConsentForm()`, `showPrivacyOptionsForm()`, `resetConsentInfo()`.
  Status-Enum: `NOT_REQUIRED | OBTAINED | REQUIRED | UNKNOWN`.

**Unsicherheit U1:** Die konkreten Google-Test-Ad-Unit-IDs schreibe ich beim
Implementieren direkt aus der aktuellen Google-Doku ab und verlinke die Quelle im Code —
ich tippe sie nicht aus dem Gedächtnis.

---

## 2. Ordnerstruktur

```
/
├─ PLAN.md · PROGRESS.md · README.md
├─ .env.example                    # AdMob-IDs, dokumentiert; .env ist gitignored
├─ index.html
├─ src/
│  ├─ core/                        # reine TS-Logik, KEIN React, KEIN Capacitor
│  │  ├─ types.ts                  # Island, Bridge, Puzzle, Difficulty …
│  │  ├─ geometry.ts               # Nachbarschaft, Kreuzungen, Kandidatenkanten
│  │  ├─ puzzleState.ts            # Zustand, Züge, Undo/Redo, Validierung, Gewinnprüfung
│  │  ├─ unionFind.ts
│  │  ├─ deductions.ts             # einzelne benannte Deduktionsregeln (Basis für Tipps)
│  │  ├─ solver.ts                 # Propagation + Backtracking, Lösungszählung (Abbruch bei 2)
│  │  ├─ generator.ts              # Rückwärtskonstruktion + Eindeutigkeitsprüfung
│  │  ├─ difficulty.ts             # Einstufung über benötigte Deduktionstiefe
│  │  ├─ hint.ts                   # nächster zwingender Zug + Begründung (i18n-Key + Parameter)
│  │  └─ rng.ts                    # deterministischer PRNG (SplitMix64/xoshiro), seed-basiert
│  ├─ render/                      # Canvas-Renderer (kein React)
│  │  ├─ boardRenderer.ts · layers.ts · theme.ts · animation.ts
│  ├─ input/
│  │  ├─ pointer.ts                # Drag/Tap-Erkennung, Toleranzen
│  │  └─ gestures.ts               # Pinch-Zoom, Pan
│  ├─ services/                    # einziger Kontakt zu nativen APIs, alle mit Web-Fallback
│  │  ├─ storage.ts · ads.ts · haptics.ts · appLifecycle.ts · platform.ts
│  ├─ state/                       # Zustand-Stores
│  │  ├─ gameStore.ts · progressStore.ts · settingsStore.ts · hintStore.ts · adStore.ts
│  ├─ ui/                          # React-Komponenten & Screens
│  │  ├─ screens/ · components/ · hooks/
│  ├─ data/
│  │  ├─ puzzles/{easy,medium,hard,expert}.json   # je ≥150, zur Build-Zeit erzeugt
│  │  └─ manifest.json
│  ├─ i18n/  de.json · en.json
│  ├─ config/game.ts               # ALLE Balancing-Werte, keine Magic Numbers
│  └─ tests/                       # Vitest
├─ scripts/
│  ├─ generate-puzzles.mjs         # Vorgenerierung (Node, nutzt src/core)
│  ├─ verify-puzzles.mjs           # CI-Gegenprüfung der ausgelieferten JSONs
│  └─ inject-admob-appid.mjs       # AdMob-App-ID aus .env in die Android-Ressourcen
├─ store/                          # Listing DE/EN, Screenshots, Privacy, Data Safety, Rating
├─ android/                        # committet
└─ .github/workflows/ci.yml · android-release.yml
```

Regel: `src/core/` importiert nichts aus `react`, `@capacitor/*` oder dem DOM. Das wird
per ESLint-`no-restricted-imports` erzwungen, nicht nur per Konvention. Kommentare
deutsch, Bezeichner englisch.

---

## 3. Datenmodell

```ts
type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

interface Island {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly required: number;
} // 1..8
interface EdgeDef {
  readonly id: number;
  readonly a: number;
  readonly b: number;
  readonly horizontal: boolean;
} // a < b, benachbart, freie Linie
interface Puzzle {
  readonly id: string; // z.B. "easy-0042" oder "daily-2026-08-19"
  readonly seed: string;
  readonly difficulty: Difficulty;
  readonly width: number;
  readonly height: number;
  readonly islands: readonly Island[];
  readonly solution: readonly (0 | 1 | 2)[]; // pro EdgeDef-Index — eindeutig, verifiziert
}
```

- **Kanten statt Koordinaten:** Kandidatenkanten (benachbarte Inselpaare ohne Insel
  dazwischen) und die Kreuzungspaare werden einmalig vorberechnet. Ein Zug ist damit
  `edgeId → count`, was Solver, Renderer, Undo-Stack und Serialisierung stark vereinfacht.
- **Zugmodell:** `applyMove(edgeId, count)`; Undo/Redo als Liste von `{edgeId, from, to}`.
- **Gewinnprüfung:** alle `required` exakt erfüllt **und** Union-Find ergibt genau eine
  Komponente über alle Inseln.
- **Regelvalidierung:** kein Zählwert > 2, keine Kreuzung (Kreuzungstabelle), keine
  Überschreitung von `required` (Überschreitung wird als Fehler markiert, aber nicht verhindert —
  es gibt keine Verlierbedingung).

**Speicherformat** (`schemaVersion`, migrierbar):

```ts
interface SaveData {
  schemaVersion: 1;
  settings: {
    sound: boolean;
    vibration: boolean;
    theme: 'dark' | 'light' | 'system';
    leftHanded: boolean;
    locale: 'de' | 'en';
  };
  levels: Record<string, { solved: boolean; bestTimeMs: number | null; hintsUsed: number }>;
  inProgress: Record<string, { moves: [edgeId: number, count: number][]; elapsedMs: number }>;
  daily: {
    streak: number;
    longestStreak: number;
    lastSolvedDay: string | null;
    solvedDays: string[];
  };
  hints: { balance: number; lastFreeGrantDay: string | null };
  ads: {
    rewardedCountToday: number;
    rewardedDay: string | null;
    adsRemoved: boolean;
    consentDone: boolean;
  };
  stats: { solvedTotal: number; totalTimeMs: number; hintsSpent: number };
  clock: { lastSeenEpochMs: number }; // Schutz gegen Uhr-Zurückstellen
}
```

**Atomares Schreiben:** `@capacitor/preferences` hat kein atomares Rename. Deshalb
Doppelpuffer: Schreiben abwechselnd nach `save.a` / `save.b` (mit Checksumme), danach
Zeiger-Key `save.ptr` setzen. Bricht der Prozess mittendrin ab, zeigt `save.ptr` noch auf
den intakten alten Slot. Schreibvorgänge werden entprellt (250 ms) und bei
`appStateChange → inactive` sofort geflusht.

**Uhr-Manipulation:** `clock.lastSeenEpochMs` wird monoton fortgeschrieben. Springt die
Systemzeit rückwärts, werden „neuer Tag"-Ereignisse (Gratis-Tipps, Rewarded-Limit,
Daily) nicht ausgelöst; Vorwärtssprünge zählen normal. Das ist eine bewusst simple,
offline taugliche Absicherung — kein echter Schutz gegen einen entschlossenen Nutzer,
und mehr ist ohne Backend auch nicht möglich.

---

## 4. Solver, Generator, Schwierigkeit, Tipps — das Herzstück

### 4.1 Deduktionsregeln (benannt, einzeln testbar, direkt als Tipp-Text verwendbar)

Für jede Insel: `remaining = required − gesetzteBrückenenden`, Kandidatenkanten mit
Restkapazität `cap_i ∈ {0,1,2}`.

| ID                       | Regel                                                                                                                           | Beispiel-Begründung (Tipp-Text)                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `D1_SATURATED`           | `remaining == 0` → alle Restkanten auf 0 fixieren                                                                               | „Diese Insel ist voll — die restlichen Verbindungen entfallen."                                      |
| `D2_FORCED_ALL`          | `Σ cap_i == remaining` → alle Kanten auf `cap_i`                                                                                | „Diese 4 hat nur zwei Nachbarn, also gehen zu beiden zwei Brücken."                                  |
| `D3_MIN_PER_EDGE`        | `min_i = max(0, remaining − Σ_{j≠i} cap_j) > 0` → mindestens `min_i` setzen                                                     | „Selbst wenn alle anderen Nachbarn voll ausgelastet sind, bleibt hier mindestens eine Brücke übrig." |
| `D4_NO_CROSS`            | Kante > 0 verbietet alle kreuzenden Kanten                                                                                      | „Diese Brücke kreuzt die andere — nur eine davon kann existieren."                                   |
| `D5_NO_ISOLATION`        | Ein Zug, der eine geschlossene Teilkomponente < alle Inseln erzeugt, ist verboten (klassisch: 1–1 und 2=2 zwischen zwei Inseln) | „Damit wäre dieser Teil vom Rest abgeschnitten — alle Inseln müssen zusammenhängen."                 |
| `D6_CONNECTIVITY_BRIDGE` | Kante, ohne die eine Inselgruppe unerreichbar wird, ist erzwungen                                                               | „Ohne diese Brücke kommt der rechte Teil des Feldes nicht mehr ans Netz."                            |
| `D7_HYPOTHESIS`          | Probeannahme auf einer Kante, führt in ≤ N Schritten zum Widerspruch → Gegenwert erzwungen                                      | „Wäre hier keine Brücke, ergäbe sich weiter unten ein Widerspruch."                                  |

Propagation läuft als Worklist bis zum Fixpunkt. `D7` ist der teure Fall und wird nur für
`hard`/`expert` und im Tipp-System als letzte Stufe eingeschaltet.

### 4.2 Solver

`solve(puzzle, { maxSolutions: 2 })` → `{ solutions, count }`. Propagation bis zum
Fixpunkt, dann Backtracking auf der Kante mit den wenigsten Möglichkeiten
(MRV-Heuristik), Abbruch sobald die zweite Lösung gefunden ist. Das ist der einzige
Weg, Eindeutigkeit zu **beweisen** statt zu hoffen.

### 4.3 Generator

1. Zufälligen **zusammenhängenden** Brückengraphen bauen: Inseln nacheinander setzen und
   per horizontaler/vertikaler Brücke (1 oder 2) an das bestehende Netz hängen, dabei
   Kreuzungen und Überläufe über Inseln ausschließen.
2. Optional zusätzliche Kanten einstreuen (mehr Dichte = schwerer, aber nicht immer).
3. Inselwerte = Grad im erzeugten Graphen. Der Graph selbst wird verworfen, nur die
   Inselwerte bilden das Rätsel.
4. **Verifikation mit dem Solver:** genau eine Lösung? Sonst Kandidat verwerfen und mit
   fortgeschrittenem Seed neu versuchen.
5. Schwierigkeit einstufen (4.4). Passt sie nicht zum Ziel, verwerfen.

Alles läuft über `rng(seed)` — `generate(seed, difficulty)` ist bitgenau reproduzierbar.

### 4.4 Schwierigkeit = Boardgröße plus nötige Schlussweise

| Grad    | Größe | Verlangte Schlussweise                                |
| ------- | ----- | ----------------------------------------------------- |
| Einfach | 7×7   | nur D1–D4 (Inselgrade und Kreuzungsausschluss)        |
| Mittel  | 10×10 | zusätzlich D5/D6, aber weniger als 4 solcher Schlüsse |
| Schwer  | 13×13 | zusätzlich D5/D6, mindestens 4 solcher Schlüsse       |
| Experte | 17×17 | ohne D7 (Widerspruchsbeweis) nicht lösbar             |

**Korrektur gegenüber der ersten Fassung dieses Plans:** ursprünglich war „Schwer" als
„braucht D6, aber nicht D7" geplant. Die Messung über mehrere tausend Kandidaten hat
gezeigt, dass diese Klasse praktisch leer ist — die Isolationsregel D5 deckt fast alles ab,
was unterhalb des Widerspruchsbeweises liegt, und wo sie nicht reicht, reicht D6 meistens
auch nicht. Statt eine leere Klasse zu behaupten, unterscheidet „Mittel" von „Schwer"
jetzt die **Anzahl** der fortgeschrittenen Schlüsse (`HARD_ADVANCED_STEPS` in
`src/config/game.ts`). Die Vorgabe „Schwierigkeitsgrade über Boardgröße und benötigte
Deduktionstiefe" bleibt damit erfüllt, nur ist die Tiefe feiner gemessen als über die
bloße Regelmenge.

Ein Rätsel gilt nur dann als „Experte", wenn es mit den flacheren Mengen **nicht** lösbar
ist. Rätsel, die selbst mit D7 nicht rein deduktiv lösbar sind (die also Raten
erfordern), werden grundsätzlich verworfen — das Tipp-System könnte sie nicht erklären.

### 4.5 Tipp-System

Weil die Lösung eindeutig und gespeichert ist, wird zuerst geprüft, ob der aktuelle
Spielstand eine **Teilmenge der Lösung** ist:

- **Ja** → Deduktionsmaschine auf dem Spielerzustand laufen lassen, erste greifende Regel
  liefert Zug + Begründungstext (i18n-Key + Parameter, nicht als fertiger deutscher String
  im Code). Der Zug wird hervorgehoben und auf Wunsch gesetzt.
- **Nein** → der Spieler hat eine Brücke gesetzt, die in der Lösung nicht vorkommt. Der
  Tipp markiert genau diese Brücke: „Diese Brücke passt nicht — nimm sie zurück."
  Ohne diesen Zweig würde das Tipp-System in einer widersprüchlichen Stellung nichts
  Sinnvolles liefern, und da es keine Verlierbedingung gibt, kommt genau diese Stellung
  regelmäßig vor.

Kontingent: Start 5, +2 gratis pro Tag beim ersten App-Start, Rewarded gibt +3, maximal
5 Videos/Tag. Alles über `config/game.ts`.

---

## 5. Rendering & Eingabe

- **Zwei Canvas-Ebenen:** statische Ebene (Gitter, Inselkreise, Zahlen) wird nur bei
  Layout-/Theme-Änderung neu gezeichnet und aus einem Offscreen-Canvas geblittet;
  dynamische Ebene (Brücken, Auswahl, Fehler, Animation) nur bei Zustandsänderung.
  **Kein rAF-Dauerlauf** — die Schleife läuft nur, solange eine Animation aktiv ist, und
  hält danach an. Das ist die Bedingung dafür, dass das Ding auf Mid-Range-Geräten nicht
  den Akku frisst.
- DPR-korrekt: Canvas-Backing-Store = CSS-Größe × `devicePixelRatio` (gedeckelt bei 3).
- **Boardfläche** = verfügbare Höhe **nach** Abzug von Kopfleiste, reservierter
  Bannerhöhe und Safe-Area-Insets (`env(safe-area-inset-*)`), nicht Viewport-Höhe.
- **Eingabe:** Drag Insel→Insel legt/erhöht/entfernt (1 → 2 → 0), Tap-Tap als Alternative.
  Trefferradius ≥ 48 dp, Winkeltoleranz gegen ungenaues Ziehen, Snap auf die plausibelste
  Kante. Linkshänder-Layout spiegelt die Bedienleiste.
- Pinch-Zoom + Pan über Pointer-Events (kein extra Framework), Zoom-Grenzen und
  Pan-Clamping in `config/game.ts`.
- Feedback: erfüllte Insel färbt sich, überfüllte wird als Fehler markiert, Brücken
  snappen mit kurzer Animation, Haptik über `@capacitor/haptics` (im Web No-Op).

---

## 6. Werbung — Architektur

`src/services/ads.ts` ist der einzige Ort, der `@capacitor-community/admob` importiert.
Im Browser greift ein Mock (Banner = grauer Platzhalter mit korrekter Höhe, Rewarded =
Dialog mit „Video simulieren"), damit die App komplett im Browser entwickelbar bleibt.

**Reihenfolge beim Start:** `requestConsentInfo()` → falls `status === REQUIRED` und
`isConsentFormAvailable` → `showConsentForm()` → erst wenn `canRequestAds === true`
folgt `AdMob.initialize()` und die erste Ad-Anfrage. Menüpunkt
„Datenschutzeinstellungen" ruft `showPrivacyOptionsForm()` und wird nur angezeigt, wenn
`privacyOptionsRequirementStatus === REQUIRED`.

**Banner ohne Layout-Sprung:** Die Bannerhöhe steht in einer CSS-Variablen
`--banner-h`, die das Flex-Layout fest reserviert. Vor dem ersten Laden wird ein
konservativer Schätzwert reserviert (adaptive Banner sind je nach Displaybreite ca. 50–90 dp;
der exakte Startwert kommt aus `config/game.ts`), danach wird `--banner-h` aus dem
`SizeChanged`-Event exakt gesetzt. Zwischen Banner und dem nächsten interaktiven Element
liegen mindestens 16 dp (`margin`-Option des Plugins + CSS-Abstand). Bei `adsRemoved` oder
fehlgeschlagenem Laden geht die reservierte Höhe auf 0 und das Board bekommt den Platz.

**Rewarded:** Preload bei Levelstart und direkt nach jedem abgeschlossenen Video.
`showRewardVideoAd()` löst bei verdienter Belohnung auf; zusätzlich wird auf `Dismissed`
und `FailedToShow` gehört, damit ein Abbruch sauber landet (keine Gutschrift, keine
Strafe, kein hängender Spinner). Der Brettzustand liegt im Store und wird vor dem Video
persistiert — Pause/Resume und ein zwischenzeitliches Beenden der Activity überleben das.
Tageslimit 5, Zähler mit Tagesschlüssel plus Uhr-Schutz aus Abschnitt 3.

**Kein Interstitial** — bewusst, wie gefordert.

**Wichtiges technisches Detail (A1):** Die AdMob-**App-ID** ist keine Laufzeitgröße; sie
muss im `AndroidManifest.xml` stehen. Sie kann daher nicht aus einer `.env` zur Laufzeit
gelesen werden. Lösung: `scripts/inject-admob-appid.mjs` schreibt sie vor dem Build aus
der Umgebungsvariable in eine Android-Ressource, das Manifest referenziert nur diese
Ressource. Der Test-Wert ist eingecheckt, der echte kommt aus `.env` bzw. aus einem
GitHub-Secret. Die **Ad-Unit-IDs** kommen normal über `import.meta.env` in den Bundle.

---

## 7. Build, CI, Release

- `ci.yml` (bei jedem Push/PR): Node 22 → `npm ci` → ESLint → `tsc --noEmit` →
  `vitest run` → `vite build`. Zusätzlich `verify-puzzles.mjs`: die ausgelieferten
  JSON-Rätsel werden gegen den Solver auf Eindeutigkeit nachgeprüft, damit nie ein
  kaputtes Rätsel ins Release rutscht.
- `android-release.yml` (`workflow_dispatch`): JDK 21 + Android SDK 36 → Web-Build →
  `npx cap sync android` → Keystore aus Base64-Secret → `./gradlew bundleRelease` →
  AAB als Artefakt. Secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
  `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `ADMOB_APP_ID`, `ADMOB_BANNER_ID`,
  `ADMOB_REWARDED_ID`.
- **Einschränkung (R1):** In dieser Entwicklungsumgebung ist **kein Android SDK**
  installiert (Gradle ja, SDK nein). Der Gradle-Build kann hier also nicht lokal
  ausgeführt werden. Ich verifiziere ihn über den CI-Workflow. Ein echter Gerätetest
  (Touch-Gefühl, 60 fps, echte Ads) bleibt bei dir — das kann ich nicht ersetzen und
  werde es auch nicht behaupten.

---

## 8. Meilensteine

| M      | Inhalt                                                                                                                     | Definition of Done                                        |
| ------ | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **M0** | Repo-Setup: Vite+React+TS strict, Tailwind, ESLint/Prettier, Vitest, CI, `PROGRESS.md`                                     | CI grün auf leerem Gerüst                                 |
| **M1** | `src/core/`: State, Regeln, Union-Find, Deduktionen, Solver, Generator, Difficulty                                         | Tests aus Abschnitt 9 grün                                |
| **M2** | Canvas-Renderer, Pointer-Eingabe, Zoom/Pan, Undo/Redo/Reset, Haptik                                                        | Spielbar im Browser, Board füllt jede Fenstergröße        |
| **M3** | Screens, Level-Auswahl, 4×150 vorgenerierte Rätsel, Endlosmodus, Daily+Streak, Persistenz, Settings, i18n, **Tipp-System** | Fortschritt überlebt Reload, Tipps mit Begründung         |
| **M4** | `AdService`, UMP-Consent, Banner mit reservierter Höhe, Rewarded-Flow, Limits, `adsRemoved`                                | Spiel voll funktionsfähig auch bei komplett fehlenden Ads |
| **M5** | Capacitor + `android/`, Signing, Icons/Splash, `store/`-Inhalte, README, Qualitätscheck                                    | AAB aus dem CI-Workflow, Store-Unterlagen vollständig     |

`PROGRESS.md` wird nach jedem Meilenstein aktualisiert (erledigt / offen / bekannte
Probleme / Entscheidungen für dich).

---

## 9. Testplan (Vitest)

- Regelvalidierung: Kreuzungen, Überfahren von Inseln, Maximum 2, Zählwerte.
- Union-Find und Gewinnprüfung inklusive „alle Werte erfüllt, aber zwei getrennte Netze" → **nicht gelöst**.
- Solver gegen handgeschriebene Boards mit bekannter Lösung, plus Boards mit bekannt
  **zwei** Lösungen (Zähler muss bei 2 abbrechen).
- Jede Deduktionsregel einzeln, mit minimalem Board.
- Generator: Eindeutigkeit über generierte Puzzles pro Schwierigkeitsgrad (siehe E3).
- Tipp-System: liefert in der widersprüchlichen Stellung den Rücknahme-Tipp.
- Performance: Generierungszeit Experte (siehe E2).
- Persistenz: Migration von Schemaversion, Doppelpuffer-Wiederherstellung nach
  simuliertem Absturz.
- `AdService`-Mock: Kontingentlogik, Tageslimit, Uhr-Rückwärtssprung.

---

## 10. Entscheidungen (getroffen am 2026-08-19)

**E1 · React-Version → React 19.** React 19.2.x statt der ursprünglich vorgegebenen 18.

**E2 · „Experte-Generierung unter 500 ms" → Median-Kriterium.** Der Test prüft den
**Median** der Generierungszeit über mehrere Läufe gegen 500 ms und den p95 gegen ein
großzügigeres Budget; eine harte Einzelwert-Grenze würde auf geteilten CI-Runnern
flackern. Zur Laufzeit läuft die Generierung zusätzlich in einem **Web Worker**, damit
die UI nie blockiert, und der Endlosmodus produziert im Hintergrund vor.

**E3 · Eindeutigkeitsprüfung → volle 200 pro Grad in jedem CI-Lauf**, wie ursprünglich
vorgegeben (mein Vorschlag einer verkleinerten Standard-Stichprobe wurde nicht
übernommen). Ich messe die tatsächliche Laufzeit dieses Testblocks und melde sie in
`PROGRESS.md`; wird sie untragbar, komme ich mit Zahlen zurück statt still zu kürzen.

**E4 · Branch-Strategie → Feature-Branch und PR pro Meilenstein**
(`chore/m0-setup`, `feat/m1-core`, …), Basis-Branch `main`.

**E5 · Name und Bundle-ID → „Bridgelet", `com.bridgelet.game`.**
Der Eigenname „samenschluck" entfällt. Statt „Hashi" als Markenname wird ein eigener,
geprägter Name verwendet: Nikoli hält für mehrere Rätselnamen Marken, und
„Hashiwokakero" ist deren Prägung. „Hashi" bzw. „Bridges" erscheint nur **beschreibend**
im Untertitel und im Store-Text („Bridgelet — Brücken-Logikrätsel" /
„Bridgelet — Bridges Logic Puzzle"). **Das ist keine Rechtsberatung**; eine Marken- und
Namensprüfung vor dem Play-Upload bleibt beim Betreiber.

**E6 · Icon-Grafik → Eigen-Design.** Schlichtes Logo aus Inseln und Brücken, 1024×1024
als Quelldatei für `@capacitor/assets`. Eigene Grafik kann jederzeit ersetzt werden.

**E7 · Screenshots → 8 Vorlagen in Play-Maßen**, befüllt mit gerenderten
Spielbildschirmen aus dem Browser-Build. Echte Geräte-Screenshots kann ich nicht erzeugen.

**E8 · Daily-Schwierigkeit → fest „Mittel", keine Rotation.**

---

## 11. Bekannte Risiken

- **R1** Kein Android SDK in dieser Umgebung → Gradle-Build nur über CI verifizierbar,
  Gerätetests nur bei dir.
- **R2** Tailwind 4 hat eine andere Konfigurationsform als v3; das ist eingeplant, aber
  Anleitungen im Netz beziehen sich oft noch auf v3.
- **R3** Echte AdMob-IDs und der UMP-Nachrichten-Setup in der AdMob-Konsole sind ein
  manueller Schritt bei dir; ohne konfigurierte GDPR-Nachricht liefert `showConsentForm()`
  nichts. Steht so im README.
- **R4** Play Console: Data-Safety-Angaben und Content-Rating fülle ich als Vorlage aus,
  die rechtliche Verantwortung für die Angaben und die Datenschutzerklärung liegt bei dir.
  Insbesondere die Datenschutzerklärung ist ein Textentwurf, keine Rechtsberatung.

---

**Nächster Schritt:** Plan freigegeben, E1–E8 entschieden. Umsetzung startet mit M0 und M1.
