/**
 * Zentrale Balancing- und Layoutwerte.
 * Regel aus den Code-Standards: keine Magic Numbers irgendwo sonst im Projekt.
 */

export const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** Board-Abmessungen je Schwierigkeitsgrad (quadratisch). */
export const BOARD_SIZE: Readonly<Record<Difficulty, number>> = {
  easy: 7,
  medium: 10,
  hard: 13,
  expert: 17,
};

/**
 * Zielkorridor fuer die Inseldichte, gemessen als Anteil der Gitterzellen.
 * Zu wenig Inseln = triviales Raetsel, zu viele = zaeher Generator.
 */
export const ISLAND_DENSITY: Readonly<Record<Difficulty, { min: number; max: number }>> = {
  easy: { min: 0.16, max: 0.24 },
  medium: { min: 0.14, max: 0.2 },
  hard: { min: 0.12, max: 0.18 },
  expert: { min: 0.1, max: 0.16 },
};

/** Hoechstzahl an Brueckenenden pro Insel (Hashiwokakero-Regel). */
export const MAX_ISLAND_VALUE = 8;
/** Hoechstzahl paralleler Bruecken zwischen zwei Inseln. */
export const MAX_BRIDGES_PER_EDGE = 2;

/** Anzahl vorgenerierter Raetsel je Schwierigkeitsgrad im Auslieferungsumfang. */
export const PREGENERATED_PUZZLES_PER_DIFFICULTY = 150;

/** Schwierigkeitsgrad des taeglichen Raetsels (Entscheidung E8: keine Rotation). */
export const DAILY_DIFFICULTY: Difficulty = 'medium';

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
  zoom: { min: 1, max: 3, doubleTapStep: 1.6 },
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
