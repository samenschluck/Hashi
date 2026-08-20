import { DIFFICULTIES, STORAGE, type Difficulty } from '../config/game.ts';
import {
  createDefaultSave,
  DEFAULT_SETTINGS,
  type InProgressEntry,
  type LevelProgress,
  type Locale,
  type SaveData,
  type Settings,
  type ThemePreference,
} from './progression.ts';

/**
 * Einlesen eines gespeicherten Spielstands.
 *
 * Grundsatz: ein beschaedigter oder aelterer Stand darf die App nie am Starten
 * hindern. Alles wird einzeln geprueft, Unbekanntes faellt auf den Standardwert
 * zurueck. Lieber ein teilweise verlorener Fortschritt als eine App, die nicht
 * mehr aufgeht.
 */
export function migrateSave(raw: unknown, nowMs = Date.now()): SaveData {
  const fallback = createDefaultSave(nowMs);
  if (!isRecord(raw)) {
    return fallback;
  }

  const version = readNumber(raw['schemaVersion'], 0);
  if (version > STORAGE.schemaVersion) {
    // Stand aus einer neueren App-Version: nicht raten, lieber neu anfangen.
    return fallback;
  }

  const settings = readSettings(raw['settings'], fallback.settings);
  const clock = isRecord(raw['clock'])
    ? readNumber(raw['clock']['lastSeenEpochMs'], fallback.clock.lastSeenEpochMs)
    : fallback.clock.lastSeenEpochMs;

  const daily = isRecord(raw['daily']) ? raw['daily'] : {};
  const hints = isRecord(raw['hints']) ? raw['hints'] : {};
  const ads = isRecord(raw['ads']) ? raw['ads'] : {};
  const stats = isRecord(raw['stats']) ? raw['stats'] : {};

  return {
    schemaVersion: STORAGE.schemaVersion,
    settings,
    levels: readLevels(raw['levels']),
    inProgress: readInProgress(raw['inProgress']),
    daily: {
      streak: readNumber(daily['streak'], 0),
      longestStreak: readNumber(daily['longestStreak'], 0),
      lastSolvedDay: readOptionalString(daily['lastSolvedDay']),
      solvedDays: readStringArray(daily['solvedDays']),
    },
    hints: {
      balance: Math.max(0, readNumber(hints['balance'], fallback.hints.balance)),
      lastFreeGrantDay: readOptionalString(hints['lastFreeGrantDay']),
    },
    ads: {
      rewardedCountToday: Math.max(0, readNumber(ads['rewardedCountToday'], 0)),
      rewardedDay: readOptionalString(ads['rewardedDay']),
      adsRemoved: readBoolean(ads['adsRemoved'], false),
      consentCompleted: readBoolean(ads['consentCompleted'], false),
    },
    stats: {
      solvedTotal: Math.max(0, readNumber(stats['solvedTotal'], 0)),
      totalTimeMs: Math.max(0, readNumber(stats['totalTimeMs'], 0)),
      hintsSpent: Math.max(0, readNumber(stats['hintsSpent'], 0)),
      solvedByDifficulty: readSolvedByDifficulty(stats['solvedByDifficulty']),
    },
    clock: { lastSeenEpochMs: clock },
  };
}

/** Text mit Pruefsumme, damit ein abgeschnittener Schreibvorgang auffaellt. */
export function serializeSave(save: SaveData): string {
  const payload = JSON.stringify(save);
  return `${checksum(payload).toString(36)}:${payload}`;
}

/** Gegenstueck zu `serializeSave`. Liefert null, wenn der Text nicht stimmt. */
export function deserializeSave(text: string, nowMs = Date.now()): SaveData | null {
  const separator = text.indexOf(':');
  if (separator <= 0) {
    return null;
  }
  const expected = text.slice(0, separator);
  const payload = text.slice(separator + 1);
  if (checksum(payload).toString(36) !== expected) {
    return null;
  }
  try {
    return migrateSave(JSON.parse(payload), nowMs);
  } catch {
    return null;
  }
}

/** Einfache, schnelle Pruefsumme (FNV-1a). Kein Schutz gegen Manipulation,
 *  sondern gegen halb geschriebene Dateien. */
function checksum(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function readSettings(value: unknown, fallback: Settings): Settings {
  if (!isRecord(value)) {
    return fallback;
  }
  const theme = value['theme'];
  const locale = value['locale'];
  return {
    sound: readBoolean(value['sound'], DEFAULT_SETTINGS.sound),
    vibration: readBoolean(value['vibration'], DEFAULT_SETTINGS.vibration),
    theme: isThemePreference(theme) ? theme : DEFAULT_SETTINGS.theme,
    leftHanded: readBoolean(value['leftHanded'], DEFAULT_SETTINGS.leftHanded),
    locale: isLocale(locale) ? locale : DEFAULT_SETTINGS.locale,
  };
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'dark' || value === 'light' || value === 'system';
}

function isLocale(value: unknown): value is Locale {
  return value === 'de' || value === 'en';
}

function readLevels(value: unknown): Record<string, LevelProgress> {
  if (!isRecord(value)) {
    return {};
  }
  const result: Record<string, LevelProgress> = {};
  for (const [levelId, entry] of Object.entries(value)) {
    if (!isRecord(entry)) {
      continue;
    }
    const bestTime = entry['bestTimeMs'];
    result[levelId] = {
      solved: readBoolean(entry['solved'], false),
      bestTimeMs: typeof bestTime === 'number' && Number.isFinite(bestTime) ? bestTime : null,
      hintsUsed: Math.max(0, readNumber(entry['hintsUsed'], 0)),
    };
  }
  return result;
}

function readInProgress(value: unknown): Record<string, InProgressEntry> {
  if (!isRecord(value)) {
    return {};
  }
  const result: Record<string, InProgressEntry> = {};
  for (const [levelId, entry] of Object.entries(value)) {
    if (!isRecord(entry)) {
      continue;
    }
    const counts = entry['counts'];
    if (typeof counts !== 'string' || !/^[012]*$/.test(counts)) {
      continue;
    }
    result[levelId] = { counts, elapsedMs: Math.max(0, readNumber(entry['elapsedMs'], 0)) };
  }
  return result;
}

function readSolvedByDifficulty(value: unknown): Record<Difficulty, number> {
  const result: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0, expert: 0 };
  if (!isRecord(value)) {
    return result;
  }
  for (const difficulty of DIFFICULTIES) {
    result[difficulty] = Math.max(0, readNumber(value[difficulty], 0));
  }
  return result;
}
