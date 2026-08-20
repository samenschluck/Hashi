import { ADS, HINTS, STORAGE, type Difficulty } from '../config/game.ts';

export type ThemePreference = 'dark' | 'light' | 'system';
export type Locale = 'de' | 'en';

export interface Settings {
  readonly sound: boolean;
  readonly vibration: boolean;
  readonly theme: ThemePreference;
  /** Bedienleiste gespiegelt fuer Linkshaender. */
  readonly leftHanded: boolean;
  readonly locale: Locale;
}

export interface LevelProgress {
  readonly solved: boolean;
  readonly bestTimeMs: number | null;
  readonly hintsUsed: number;
}

export interface InProgressEntry {
  /** Brueckenstand als Ziffernkette, siehe `serializeCounts`. */
  readonly counts: string;
  readonly elapsedMs: number;
}

export interface SaveData {
  readonly schemaVersion: number;
  readonly settings: Settings;
  readonly levels: Readonly<Record<string, LevelProgress>>;
  readonly inProgress: Readonly<Record<string, InProgressEntry>>;
  readonly daily: {
    readonly streak: number;
    readonly longestStreak: number;
    readonly lastSolvedDay: string | null;
    readonly solvedDays: readonly string[];
  };
  readonly hints: {
    readonly balance: number;
    readonly lastFreeGrantDay: string | null;
  };
  readonly ads: {
    readonly rewardedCountToday: number;
    readonly rewardedDay: string | null;
    /** Vorgesehen fuer einen spaeteren Kauf „Werbung entfernen". */
    readonly adsRemoved: boolean;
    readonly consentCompleted: boolean;
  };
  readonly stats: {
    readonly solvedTotal: number;
    readonly totalTimeMs: number;
    readonly hintsSpent: number;
    readonly solvedByDifficulty: Readonly<Record<Difficulty, number>>;
  };
  readonly clock: {
    /**
     * Zuletzt gesehener Zeitstempel. Springt die Systemzeit zurueck, wird der
     * alte Wert weiterbenutzt — sonst liessen sich Gratis-Tipps und das
     * Tageslimit fuer Videos durch Umstellen der Uhr beliebig oft ausloesen.
     */
    readonly lastSeenEpochMs: number;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  vibration: true,
  theme: 'system',
  leftHanded: false,
  locale: 'de',
};

export function createDefaultSave(nowMs = Date.now()): SaveData {
  return {
    schemaVersion: STORAGE.schemaVersion,
    settings: DEFAULT_SETTINGS,
    levels: {},
    inProgress: {},
    daily: { streak: 0, longestStreak: 0, lastSolvedDay: null, solvedDays: [] },
    hints: { balance: HINTS.initialBalance, lastFreeGrantDay: null },
    ads: { rewardedCountToday: 0, rewardedDay: null, adsRemoved: false, consentCompleted: false },
    stats: {
      solvedTotal: 0,
      totalTimeMs: 0,
      hintsSpent: 0,
      solvedByDifficulty: { easy: 0, medium: 0, hard: 0, expert: 0 },
    },
    clock: { lastSeenEpochMs: nowMs },
  };
}

/** Kalendertag als `YYYY-MM-DD` in der lokalen Zeitzone des Geraets. */
export function dayKey(epochMs: number): string {
  const date = new Date(epochMs);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${String(year)}-${month}-${day}`;
}

/** Tag davor, fuer die Streak-Berechnung. */
export function previousDay(day: string): string {
  const [year, month, date] = day.split('-').map((part) => Number.parseInt(part, 10));
  const value = new Date(year ?? 1970, (month ?? 1) - 1, date ?? 1);
  value.setDate(value.getDate() - 1);
  return dayKey(value.getTime());
}

/**
 * Zeit, mit der gerechnet wird. Rueckwaertsspruenge der Systemuhr werden
 * ignoriert; Vorwaertsspruenge nicht — die liessen sich ohne Server nicht
 * erkennen, und ein Spieler, der sich damit zwei Gratis-Tipps erschleicht,
 * schadet niemandem.
 */
export function effectiveNow(save: SaveData, nowMs: number): number {
  return Math.max(nowMs, save.clock.lastSeenEpochMs);
}

/** Schreibt den zuletzt gesehenen Zeitstempel fort. */
export function touchClock(save: SaveData, nowMs: number): SaveData {
  const effective = effectiveNow(save, nowMs);
  if (effective === save.clock.lastSeenEpochMs) {
    return save;
  }
  return { ...save, clock: { lastSeenEpochMs: effective } };
}

/**
 * Gratis-Tipps beim ersten Oeffnen an einem neuen Kalendertag.
 * Liefert den neuen Stand und wie viele Tipps gutgeschrieben wurden.
 */
export function grantDailyHints(
  save: SaveData,
  nowMs: number,
): { save: SaveData; granted: number } {
  const today = dayKey(effectiveNow(save, nowMs));
  if (save.hints.lastFreeGrantDay === today) {
    return { save: touchClock(save, nowMs), granted: 0 };
  }
  const updated: SaveData = {
    ...touchClock(save, nowMs),
    hints: {
      balance: save.hints.balance + HINTS.dailyFreeGrant,
      lastFreeGrantDay: today,
    },
  };
  return { save: updated, granted: HINTS.dailyFreeGrant };
}

export function hasHints(save: SaveData): boolean {
  return save.hints.balance > 0;
}

/** Verbraucht einen Tipp. Ohne Guthaben bleibt der Stand unveraendert. */
export function spendHint(save: SaveData): { save: SaveData; spent: boolean } {
  if (save.hints.balance <= 0) {
    return { save, spent: false };
  }
  return {
    save: {
      ...save,
      hints: { ...save.hints, balance: save.hints.balance - 1 },
      stats: { ...save.stats, hintsSpent: save.stats.hintsSpent + 1 },
    },
    spent: true,
  };
}

export function addHints(save: SaveData, amount: number): SaveData {
  if (amount <= 0) {
    return save;
  }
  return { ...save, hints: { ...save.hints, balance: save.hints.balance + amount } };
}

/** Wie viele belohnte Videos heute noch moeglich sind. */
export function remainingRewardedToday(save: SaveData, nowMs: number): number {
  const today = dayKey(effectiveNow(save, nowMs));
  const used = save.ads.rewardedDay === today ? save.ads.rewardedCountToday : 0;
  return Math.max(0, ADS.maxRewardedPerDay - used);
}

/** Zaehlt ein vollstaendig angesehenes Video und schreibt die Tipps gut. */
export function registerRewardedWatch(save: SaveData, nowMs: number): SaveData {
  const today = dayKey(effectiveNow(save, nowMs));
  const used = save.ads.rewardedDay === today ? save.ads.rewardedCountToday : 0;

  return addHints(
    {
      ...touchClock(save, nowMs),
      ads: { ...save.ads, rewardedDay: today, rewardedCountToday: used + 1 },
    },
    HINTS.rewardedGrant,
  );
}

/** Haelt den Zwischenstand eines Levels fest. */
export function storeInProgress(
  save: SaveData,
  levelId: string,
  counts: string,
  elapsedMs: number,
): SaveData {
  return {
    ...save,
    inProgress: { ...save.inProgress, [levelId]: { counts, elapsedMs } },
  };
}

export function clearInProgress(save: SaveData, levelId: string): SaveData {
  if (!(levelId in save.inProgress)) {
    return save;
  }
  const next = Object.fromEntries(
    Object.entries(save.inProgress).filter(([key]) => key !== levelId),
  );
  return { ...save, inProgress: next };
}

export interface SolveRecord {
  readonly levelId: string;
  readonly difficulty: Difficulty;
  readonly timeMs: number;
  readonly hintsUsed: number;
}

/** Traegt ein geloestes Level ein und aktualisiert Bestzeit und Statistik. */
export function recordSolved(save: SaveData, record: SolveRecord): SaveData {
  const previous = save.levels[record.levelId];
  const bestTimeMs =
    previous?.bestTimeMs != null ? Math.min(previous.bestTimeMs, record.timeMs) : record.timeMs;
  const firstTime = previous?.solved !== true;

  return clearInProgress(
    {
      ...save,
      levels: {
        ...save.levels,
        [record.levelId]: {
          solved: true,
          bestTimeMs,
          hintsUsed: (previous?.hintsUsed ?? 0) + record.hintsUsed,
        },
      },
      stats: {
        ...save.stats,
        solvedTotal: save.stats.solvedTotal + 1,
        totalTimeMs: save.stats.totalTimeMs + record.timeMs,
        solvedByDifficulty: {
          ...save.stats.solvedByDifficulty,
          [record.difficulty]:
            save.stats.solvedByDifficulty[record.difficulty] + (firstTime ? 1 : 0),
        },
      },
    },
    record.levelId,
  );
}

/**
 * Traegt ein geloestes Tagesraetsel ein und fuehrt die Serie fort.
 * Eine Serie reisst, sobald ein Tag ausgelassen wurde.
 */
export function recordDailySolved(save: SaveData, day: string): SaveData {
  if (save.daily.solvedDays.includes(day)) {
    return save;
  }
  const continues = save.daily.lastSolvedDay === previousDay(day);
  const streak = continues ? save.daily.streak + 1 : 1;

  return {
    ...save,
    daily: {
      streak,
      longestStreak: Math.max(save.daily.longestStreak, streak),
      lastSolvedDay: day,
      solvedDays: [...save.daily.solvedDays, day],
    },
  };
}

/**
 * Ist die Serie noch aktiv? Sie gilt, solange das Tagesraetsel heute oder
 * gestern geloest wurde — sonst ist sie abgelaufen.
 */
export function currentStreak(save: SaveData, nowMs: number): number {
  const today = dayKey(effectiveNow(save, nowMs));
  const last = save.daily.lastSolvedDay;
  if (last === null) {
    return 0;
  }
  return last === today || last === previousDay(today) ? save.daily.streak : 0;
}

/** Durchschnittliche Loesungszeit in Millisekunden, oder null ohne Daten. */
export function averageSolveTime(save: SaveData): number | null {
  return save.stats.solvedTotal === 0
    ? null
    : Math.round(save.stats.totalTimeMs / save.stats.solvedTotal);
}
