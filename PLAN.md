# PLAN.md — Bridgelet (Hashiwokakero) für Android

Stand: 2026-08-20 · Status: **umgesetzt, alle Meilensteine abgeschlossen**

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
| `D8_PARITY_CUT`          | Hängt eine Inselgruppe nur über eine Kante am Rest, hat diese Kante die Parität der Inselzahl-Summe dieser Gruppe               | „Die Summe dort drüben ist gerade, also müssen es hier zwei Brücken sein."                           |
| `D9_TWIN_PAIR`           | Zwei gleich große Inseln (1–1, 2=2) dürfen sich nicht gegenseitig sättigen, solange andere Inseln offen sind                    | „Zwei Einsen gehen nie zusammen — die beiden wären fertig und der Rest abgehängt."                   |

Propagation läuft als Worklist bis zum Fixpunkt. `D7` ist der teure Fall und wird nur für
`hard`/`expert` und im Tipp-System als letzte Stufe eingeschaltet.

`D8` und `D9` sind nachträglich dazugekommen, aus zwei verschiedenen Gründen:

- **D9** ist logisch ein Sonderfall von D5 und erweitert das Können des Solvers nicht.
  Sie steht trotzdem vor D5, weil sie ein **wiedererkennbares Muster** ist. Ein Tipp, der
  „zwei Einsen gehen nie zusammen" sagt, bringt einem Spieler etwas für das nächste
  Rätsel bei; „das würde eine Gruppe abschneiden" bleibt abstrakt. Gemessen greift sie
  häufig: durchschnittlich 1,1-mal bei „Mittel" bis 8,2-mal bei „Experte".
- **D8** ist ein echter neuer Schluss und deckt Fälle ab, die keine andere Regel sieht —
  sie greift aber nur an Engstellen und damit selten (siehe 4.4). Sie bleibt im Code,
  weil sie korrekt und billig ist: die Tiefensuche, die sie braucht, läuft für D6 ohnehin.

Eine falsche Deduktionsregel wäre der gefährlichste Fehler im Projekt — sie schließt still
den richtigen Wert aus, und Solver wie Tipp-System begründen anschließend Unsinn. Deshalb
prüft `npm run rules:check` in der CI bei jedem Push, dass nach der Propagation auf allen
600 ausgelieferten Rätseln und allen vier Tiefen der Wertebereich jeder Kante die echte
Lösung noch enthält.

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

### 4.4 Schwierigkeit = nötige Schlussweise, Dichte der Einsichten, wenig Leerlauf

| Grad    | Größe | Tiefe | mind. fortgeschr. Schlüsse | max. Leerlauf |
| ------- | ----- | ----- | -------------------------- | ------------- |
| Einfach | 7×7   | 1     | 0                          | —             |
| Mittel  | 9×9   | 2     | 2                          | 12            |
| Schwer  | 10×10 | 2–3   | 6                          | 10            |
| Experte | 12×12 | 4     | 8                          | 10            |

Die Werte stehen in `DIFFICULTY_CRITERIA` (`src/config/game.ts`), gemessen wird mit
`npm run puzzles:analyze`.

**Zweite Korrektur, nach dem ersten spielbaren Stand.** Die erste Fassung staffelte
vor allem über die Boardgröße (7 / 10 / 13 / 17). Gemessen an den damals ausgelieferten
Rätseln kamen die Grade so zwar auf mehr Deduktionsschritte, aber der Anteil echter
Einsichten daran blieb klein: 5 % bei „Mittel", 12 % bei „Schwer", 20 % bei „Experte" —
der Rest war mechanische Buchhaltung. Ein größeres Brett macht ein Rätsel eben länger,
nicht schwerer.

Drei Änderungen daraus:

1. **Kleinere Bretter.** „Experte" von 17×17 auf 12×12. Nebenbei die Ergonomie: 17×17
   ließ sich auf einem Telefon nur mit ständigem Zoomen bedienen.
2. **Mindestzahl fortgeschrittener Schlüsse je Grad** statt einer einzigen Schwelle
   zwischen „Mittel" und „Schwer".
3. **Obergrenze für Leerlauf** — die längste Strecke reiner Routinezüge (D1–D4)
   _zwischen_ zwei fortgeschrittenen Schlüssen. Die Strecke davor zählt nicht mit: das
   ist der Einstieg, den jedes Rätsel dieser Art hat. Ein Brett, das seine vier
   Einsichten über je dreißig mechanische Züge verteilt, wird verworfen statt
   herabgestuft — herabgestuft trüge es seinen Leerlauf nur in den nächsten Grad.

Ergebnis der Umstellung (Median über je 150 Rätsel):

| Grad    | Schritte alt → neu | Anteil Einsichten alt → neu | mit D1–D4 allein lösbar alt → neu |
| ------- | ------------------ | --------------------------- | --------------------------------- |
| Mittel  | 34 → 34            | 5,2 % → 9,4 %               | 61 % → 32 %                       |
| Schwer  | 61 → 55            | 12,0 % → 15,1 %             | 26 % → 15 %                       |
| Experte | 107 → 86           | 20,2 % → 22,0 %             | 9,6 % → 7,0 %                     |

**Stufe 3 bleibt eine fast leere Klasse.** Ursprünglich war „Schwer" als „braucht D6,
aber nicht D7" geplant; das ließ sich nicht füllen. Auch die später ergänzte Paritätsregel
D8 ändert daran nichts: beide setzen eine Engstelle im Möglichkeitsgraphen voraus, und die
kommt in den erzeugten Layouts kaum vor — über 600 Bretter hinweg entschied D8 zwei Mal,
D6 elf Mal. Ein Versuch, das über die Wachstumsstrategie des Generators zu erzwingen
(`growthRecency`), hat die Häufigkeit nur unwesentlich erhöht. „Schwer" teilt sich deshalb
die Tiefe mit „Mittel" und unterscheidet sich über die geforderte Menge an Einsichten.
Die beiden Regeln bleiben im Solver: Wo sie greifen, sind sie korrekt und liefern einen
guten Tipp.

Ein Rätsel gilt nur dann als „Experte", wenn es mit den flacheren Mengen **nicht** lösbar
ist. Rätsel, die selbst mit D7 nicht rein deduktiv lösbar sind (die also Raten
erfordern), werden grundsätzlich verworfen — das Tipp-System könnte sie nicht erklären.

### 4.4b Erweiterungen des Rätseltyps

Nach dem ersten spielbaren Stand fiel auf, dass „Schwer" sich vor allem aus
Einsen und Zweien zusammensetzte und sich durch Probieren lösen ließ. Drei
Erweiterungen sollten das ändern; nur zwei davon haben messbar gewirkt.

**Mauern** (`WALL_DENSITY`) — gesperrte Zellen, über die keine Brücke läuft.
Sie unterbrechen die Sichtlinie: hinter einer Mauer liegt kein Nachbar mehr.

Erwartet war, dass dadurch Engstellen entstehen, an denen D6 und D8 greifen.
Gemessen: Der Effekt existiert, ist aber schwach (bei „Experte" sieben statt
eine Anwendung auf 60 Brettern), und der Anteil fortgeschrittener Schlüsse
sinkt sogar leicht, weil Mauern Nachbarschaften und damit Mehrdeutigkeit
entfernen. Auch höhere Inseldichte gleicht das nicht aus. Sie bleiben trotzdem,
mit moderater Dichte: Der Solver sieht das ganze Brett auf einmal, ein Mensch
muss Sichtlinien mit dem Auge verfolgen — genau diese Arbeit fügen Mauern
hinzu, und genau sie kann die Messung nicht erfassen.

**Inseln mit verborgener Zahl** (`HIDDEN_ISLANDS`) — der wirksamste Hebel im
ganzen Projekt. Eine verdeckte Insel zeigt `?`; ihre Zahl ist **keine
Bedingung mehr**, sie muss nur mindestens eine Brücke haben.

Der Punkt, an dem das kippen kann: Wer nur die Anzeige verdeckt und intern
weiter mit dem echten Wert rechnet, hält Bretter für eindeutig, die es aus
Spielersicht nicht sind. Die Bedingung fällt deshalb überall gemeinsam weg —
`isValidSolution`, `allIslandsSatisfied`, D1–D3, der Abschluss-Teil von D5 und
D9, und D8 für jede Schnittseite mit einer verborgenen Insel. Der Generator
zählt nach jedem Verdecken neu und nimmt es zurück, wenn die Eindeutigkeit
fällt oder der Grad sich ändert.

Wirkung: Anteil fortgeschrittener Schlüsse bei „Schwer" von 14,9 auf 18,0 %,
bei „Experte" von 21,0 auf 39,1 %. Zum ersten Mal ist Stufe 3 keine leere
Klasse mehr — D6 feuert bei „Schwer" 7,8-mal je Brett statt 0,0-mal.

**Farbregel** — vorgeschlagen, aber nicht gebaut. „Rot darf nicht an Rot"
entfernt Verbindungsmöglichkeiten; weniger Möglichkeiten heißt pro Zug
_weniger_ zu prüfen, nicht mehr. Dazu käme, dass Farbe als tragende Mechanik
Rot-Grün-Blinde ausschließt und das Spiel kein Hashiwokakero mehr wäre. Falls
sie kommt, dann als eigener Modus mit Symbolen zusätzlich zur Farbe.

### 4.4c Sterne statt Strafen

Drei Sterne ohne Tipp und ohne Rückgängig, zwei mit Rückgängig, einer mit Tipp
(`STARS`, `starsFor`). Gespeichert wird immer das beste Ergebnis; ein Stern
lässt sich nicht verlieren.

**Warum nicht begrenztes Rückgängig.** Vorgeschlagen war, Rückgängig pro Level
zu limitieren und weitere Versuche über belohnte Videos zu verkaufen. Dagegen
sprechen vier Dinge: Es widerspricht der Grundregel dieses Spiels, dass es
keine Verlierbedingung gibt (ein erzwungener Neustart ist eine, und zwar die
härteste). Es macht das Rätsel nicht schwerer, sondern nur die Strafe größer.
Auf einem Telefon bestraft es Fehlgriffe statt Denkfehler. Und ein belohntes
Video, das den eigenen Fehler zurücknimmt, liest sich als Lösegeld — Videos
funktionieren, wenn sie etwas Positives geben. Die Sterne erreichen dasselbe
Ziel, ohne jemanden zu blockieren.

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
