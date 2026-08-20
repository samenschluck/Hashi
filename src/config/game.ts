/**
 * Zentrale Balancing- und Layoutwerte.
 * Regel aus den Code-Standards: keine Magic Numbers irgendwo sonst im Projekt.
 */

export const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/**
 * Board-Abmessungen je Schwierigkeitsgrad (quadratisch).
 *
 * Bewusst eng beieinander. Ein groesseres Brett macht ein Raetsel laenger, nicht
 * schwieriger — die Schwierigkeit kommt aus `DIFFICULTY_CRITERIA` weiter unten.
 * Dazu kommt die Bedienbarkeit: ab etwa 13x13 laesst sich ein Brett auf einem
 * Telefon nur noch mit staendigem Zoomen spielen.
 */
export const BOARD_SIZE: Readonly<Record<Difficulty, number>> = {
  easy: 7,
  medium: 9,
  hard: 10,
  expert: 12,
};

/**
 * Zielkorridor fuer die Inseldichte, gemessen als Anteil der Gitterzellen.
 *
 * Die Werte stammen aus einer Messreihe ueber Brettgroesse und Dichte
 * (`npm run puzzles:analyze`), nicht aus einer Ueberlegung: hoehere Dichte
 * erhoeht zwar die Zahl der fortgeschrittenen Schluesse, verlaengert aber die
 * Routinestrecken dazwischen noch staerker. Die gewaehlten Korridore sind das
 * gemessene Optimum aus „viele Einsichten" und „wenig Leerlauf".
 */
export const ISLAND_DENSITY: Readonly<Record<Difficulty, { min: number; max: number }>> = {
  easy: { min: 0.16, max: 0.24 },
  medium: { min: 0.16, max: 0.22 },
  hard: { min: 0.18, max: 0.24 },
  expert: { min: 0.18, max: 0.24 },
};

/**
 * Was ein Board erfuellen muss, um als Raetsel eines Grades durchzugehen.
 *
 * `levels` ist die noetige Deduktionstiefe (siehe `src/core/deductions.ts`),
 * `minAdvancedSteps` die Mindestzahl fortgeschrittener Schluesse und
 * `maxRoutineRun` die laengste zulaessige Strecke reiner Routinezuege zwischen
 * zwei solchen Schluessen.
 *
 * **Warum drei Kriterien statt nur der Tiefe.** Die Tiefe sagt nur, ob ein
 * schwieriger Schluss ueberhaupt vorkommt. Gemessen an der ersten Fassung
 * bestanden selbst „Experte"-Boards zu rund 80 Prozent aus mechanischer
 * Buchhaltung — schwieriger wurden die Grade vor allem dadurch, dass die Bretter
 * wuchsen. `minAdvancedSteps` verlangt deshalb Einsichten in Menge, und
 * `maxRoutineRun` verbietet, sie durch lange Leerlaufstrecken zu strecken.
 *
 * **Warum „mittel" und „schwer" dieselbe Tiefe haben.** Stufe 3 (Schnitt- und
 * Paritaetsschluesse) ist empirisch eine fast leere Klasse: ueber mehrere
 * tausend Kandidaten hinweg traten die Regeln D6 und D8 nur in Einzelfaellen als
 * *entscheidende* Schluesse auf. Ein Grad, den der Generator nicht zuverlaessig
 * fuellen kann, taugt nicht als Stufe. Die Regeln bleiben trotzdem im Solver:
 * wo sie greifen, sind sie korrekt und liefern einen guten Tipp.
 */
export const DIFFICULTY_CRITERIA: Readonly<
  Record<Difficulty, { levels: readonly number[]; minAdvancedSteps: number; maxRoutineRun: number }>
> = {
  easy: { levels: [1], minAdvancedSteps: 0, maxRoutineRun: Number.POSITIVE_INFINITY },
  medium: { levels: [2], minAdvancedSteps: 2, maxRoutineRun: 12 },
  hard: { levels: [2, 3], minAdvancedSteps: 6, maxRoutineRun: 10 },
  expert: { levels: [4], minAdvancedSteps: 8, maxRoutineRun: 10 },
};

/**
 * Generator-Parameter je Schwierigkeitsgrad.
 *
 * `distanceJitter` steuert, wie stark kurze Abstaende bevorzugt werden — dichter
 * stehende Inseln haben mehr moegliche Nachbarn und damit mehr Ablenkungen.
 * `doubleBridgeChance` ist die Wahrscheinlichkeit, eine neue Insel gleich mit einer
 * Doppelbruecke anzuhaengen; hohe Inselwerte sind stark eingeschraenkt und machen
 * ein Raetsel leichter. Fuer „Experte" steht der Wert deshalb auf 0.
 * `repairRounds` begrenzt, wie oft nachgebessert wird, bis ein Netz eindeutig ist.
 * `growthRecency` steuert, wie stark bevorzugt an der zuletzt gesetzten Insel
 * weitergewachsen wird — siehe `GROWTH_RECENT_FRACTION`.
 */
export const GENERATOR: Readonly<
  Record<
    Difficulty,
    {
      distanceJitter: number;
      doubleBridgeChance: number;
      repairRounds: number;
      growthRecency: number;
    }
  >
> = {
  easy: { distanceJitter: 2.5, doubleBridgeChance: 0.15, repairRounds: 1.5, growthRecency: 0 },
  medium: { distanceJitter: 2.5, doubleBridgeChance: 0.15, repairRounds: 1.5, growthRecency: 0 },
  hard: { distanceJitter: 2.5, doubleBridgeChance: 0.15, repairRounds: 1.5, growthRecency: 0 },
  expert: { distanceJitter: 2.5, doubleBridgeChance: 0, repairRounds: 1.5, growthRecency: 0.85 },
};

/**
 * Anteil der juengsten Inseln, aus dem bei `growthRecency` gewaehlt wird.
 *
 * Gleichverteilt gezogen waechst das Netz als gleichmaessiger Klumpen;
 * bevorzugt an der zuletzt gesetzten Insel waechst es in Ranken.
 *
 * **Was der Regler nicht tut.** Eingebaut war er, um Engstellen zu erzeugen, an
 * denen die Schnittregeln D6 und D8 greifen. Das ist messbar misslungen: ueber
 * je 150 Bretter aendert sich deren Zahl nicht (7 gegen 6 Anwendungen).
 *
 * **Was er tut.** Bei „Experte" hebt er den Anteil fortgeschrittener Schluesse
 * von 21,0 auf 23,4 Prozent, bei gleicher Gesamtlaenge und etwas mehr Leerlauf
 * (6,4 auf 7,5). Bei den anderen Graden liegt der Unterschied im Rauschen —
 * deshalb steht er dort auf 0. Nachmessen mit `npm run puzzles:analyze`.
 */
export const GROWTH_RECENT_FRACTION = 0.25;

/**
 * Anteil der Gitterzellen, die als Mauer gesperrt werden.
 *
 * Mauern tragen keine Insel und keine Bruecke laeuft ueber sie. Sie sind der
 * einzige Eingriff, der die *Geometrie* aendert statt der Zahlen: Sichtlinien
 * werden unterbrochen, Nachbarschaften verschwinden, und es entstehen Bereiche,
 * die nur ueber wenige Verbindungen erreichbar sind.
 *
 * „Einfach" bleibt bewusst ohne Mauern — dort soll das Brett auf einen Blick
 * lesbar sein.
 *
 * **Was die Messung sagt.** Die Erwartung war, dass Mauern Engstellen erzeugen
 * und damit die Schnittregeln D6 und D8 ins Spiel bringen. Das stimmt, aber nur
 * schwach: bei „Experte" feuern sie mit Mauern sieben- statt einmal auf 60
 * Brettern. Auf den Anteil fortgeschrittener Schluesse wirken Mauern dagegen
 * leicht *negativ* (bei „Experte" 22,7 auf 20,8 Prozent), weil sie Nachbarschaften
 * entfernen und damit Mehrdeutigkeit. Auch mehr Inseldichte gleicht das nicht aus.
 *
 * **Warum sie trotzdem drin sind.** Der Solver sieht das ganze Brett auf einmal;
 * ein Mensch muss Sichtlinien mit dem Auge verfolgen. Genau diese Arbeit fuegen
 * Mauern hinzu, und genau sie kann diese Messung nicht erfassen. Die Werte sind
 * deshalb bewusst moderat: genug, um den Charakter des Bretts zu aendern, ohne
 * die Nachbarzahl je Insel spuerbar zu druecken.
 */
export const WALL_DENSITY: Readonly<Record<Difficulty, number>> = {
  easy: 0,
  medium: 0.03,
  hard: 0.05,
  expert: 0.06,
};

/**
 * Hoechstzahl an Inseln je Brett, deren Zahl verborgen wird („?").
 *
 * Eine verborgene Zahl ist keine Bedingung mehr — der Spieler muss sie erst aus
 * der Umgebung erschliessen. Der Generator verdeckt nur, solange das Raetsel
 * dabei eindeutig bleibt; wo eine verborgene Zahl zusaetzliche Loesungen
 * eroeffnen wuerde, bleibt sie sichtbar. Die Zahl hier ist also eine Obergrenze,
 * kein Sollwert.
 *
 * „Einfach" bleibt ohne: dort soll nichts erschlossen werden muessen.
 *
 * **Der wirksamste Hebel im ganzen Projekt.** Gemessen ueber je 40 Bretter hebt
 * das Verdecken den Anteil fortgeschrittener Schluesse bei „Schwer" von 14,8 auf
 * 22,4 Prozent und bei „Experte" von 21,1 auf 38,4 — und die Raetsel werden
 * dabei sogar *kuerzer* (Schwer 51 auf 43 Schritte). Oberhalb dieser Werte
 * saettigt der Effekt: der Generator findet dann keine weiteren Inseln mehr, die
 * sich verdecken lassen, ohne die Eindeutigkeit zu verlieren.
 *
 * Bei „Mittel" bricht die Ausbeute ab 4 ein (18 von 40 Versuchen) — kleine
 * Bretter haben zu wenig Umgebung, aus der sich eine verborgene Zahl
 * erschliessen liesse.
 */
export const HIDDEN_ISLANDS: Readonly<Record<Difficulty, number>> = {
  easy: 0,
  medium: 2,
  hard: 8,
  expert: 10,
};

/** Hoechstzahl an Brueckenenden pro Insel (Hashiwokakero-Regel). */
export const MAX_ISLAND_VALUE = 8;
/** Hoechstzahl paralleler Bruecken zwischen zwei Inseln. */
export const MAX_BRIDGES_PER_EDGE = 2;

/** Anzahl vorgenerierter Raetsel je Schwierigkeitsgrad im Auslieferungsumfang. */
export const PREGENERATED_PUZZLES_PER_DIFFICULTY = 150;

/** Schwierigkeitsgrad des taeglichen Raetsels (Entscheidung E8: keine Rotation). */
export const DAILY_DIFFICULTY: Difficulty = 'medium';

/**
 * Sternebewertung je Level.
 *
 * Belohnt sauberes Spiel, statt Fehler zu bestrafen: Es gibt keine Stufe, die
 * den Fortschritt blockiert, und kein Stern laesst sich verlieren — gespeichert
 * wird immer das beste Ergebnis. Ein Level ohne Sterne bleibt gespielt und
 * geloest.
 */
export const STARS = {
  /** Ohne Tipp und ohne Rueckgaengig geloest. */
  max: 3,
  /** Ohne Tipp, aber mit Rueckgaengig. */
  withUndo: 2,
  /** Mit mindestens einem Tipp. */
  withHint: 1,
} as const;

/** Tipp-System (Meilenstein 3). */
export const HINTS = {
  /** Startguthaben bei der allerersten Installation. */
  initialBalance: 5,
  /** Gratis-Tipps beim ersten Oeffnen an einem neuen Kalendertag. */
  dailyFreeGrant: 2,
  /** Gutschrift nach vollstaendig angesehenem Rewarded-Video. */
  rewardedGrant: 3,
} as const;

/** Werbung (Meilenstein 4). */
export const ADS = {
  /** Hoechstzahl belohnter Videos pro Kalendertag. */
  maxRewardedPerDay: 5,
  /**
   * Reservierte Bannerhoehe in dp, bevor die echte Groesse bekannt ist.
   * Adaptive Anchored Banner liegen je nach Displaybreite bei etwa 50–90 dp;
   * der Wert wird ersetzt, sobald das Plugin `bannerAdSizeChanged` meldet.
   */
  estimatedBannerHeightDp: 60,
  /** Mindestabstand zwischen Banner und interaktiven Elementen in dp. */
  minDistanceToInteractiveDp: 16,
} as const;

/** Rendering und Eingabe (Meilenstein 2). */
export const RENDER = {
  /** Obergrenze fuer die Backing-Store-Aufloesung, damit grosse Boards fluessig bleiben. */
  maxDevicePixelRatio: 3,
  /** Mindest-Trefferflaeche fuer Inseln in dp (Android-Richtwert). */
  minTouchTargetDp: 48,
  /** Zusaetzliche Toleranz um eine Insel herum beim Ziehen, als Anteil des Zellenrasters. */
  grabToleranceCells: 0.6,
  /** Maximale Winkelabweichung in Grad, bis eine Drag-Richtung noch als Achse gilt. */
  dragAngleToleranceDeg: 30,
  /** Dauer der Snap-Animation einer Bruecke in ms. */
  bridgeAnimationMs: 120,
  /** Ab dieser Zugstrecke (in Zellen) gilt eine Bewegung als Ziehen, nicht als Tippen. */
  dragActivationCells: 0.35,
  zoom: { min: 1, max: 3 },
} as const;

/** Persistenz (Meilenstein 3). */
export const STORAGE = {
  schemaVersion: 1,
  /** Entprellung fuer Schreibvorgaenge in ms. */
  writeDebounceMs: 250,
  keys: {
    pointer: 'save.ptr',
    slotA: 'save.a',
    slotB: 'save.b',
  },
} as const;
