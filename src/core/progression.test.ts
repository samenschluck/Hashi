import { describe, expect, it } from 'vitest';
import { ADS, HINTS } from '../config/game.ts';
import {
  addHints,
  averageSolveTime,
  clearInProgress,
  createDefaultSave,
  currentStreak,
  dayKey,
  effectiveNow,
  grantDailyHints,
  previousDay,
  recordDailySolved,
  recordSolved,
  registerRewardedWatch,
  remainingRewardedToday,
  spendHint,
  storeInProgress,
  touchClock,
} from './progression.ts';

/** Fester Zeitpunkt, damit die Tests unabhaengig von der echten Uhr laufen. */
const NOON = new Date(2026, 7, 19, 12, 0, 0).getTime();
const DAY = 24 * 60 * 60 * 1000;

describe('Kalendertage', () => {
  it('bildet lokale Tage auf YYYY-MM-DD ab', () => {
    expect(dayKey(NOON)).toBe('2026-08-19');
  });

  it('rechnet ueber Monatsgrenzen zurueck', () => {
    expect(previousDay('2026-08-01')).toBe('2026-07-31');
    expect(previousDay('2026-01-01')).toBe('2025-12-31');
    expect(previousDay('2028-03-01')).toBe('2028-02-29');
  });
});

describe('Schutz gegen zurueckgestellte Uhr', () => {
  it('ignoriert Rueckwaertsspruenge der Systemzeit', () => {
    const save = touchClock(createDefaultSave(NOON), NOON);
    // Uhr um drei Tage zurueckgestellt
    expect(effectiveNow(save, NOON - 3 * DAY)).toBe(NOON);
    expect(dayKey(effectiveNow(save, NOON - 3 * DAY))).toBe('2026-08-19');
  });

  it('laesst Vorwaertsspruenge zu', () => {
    const save = createDefaultSave(NOON);
    expect(effectiveNow(save, NOON + DAY)).toBe(NOON + DAY);
  });

  it('verweigert doppelte Gratis-Tipps nach dem Zurueckstellen', () => {
    const start = createDefaultSave(NOON);
    const first = grantDailyHints(start, NOON);
    expect(first.granted).toBe(HINTS.dailyFreeGrant);

    // Der Spieler stellt die Uhr auf gestern zurueck und startet neu.
    const second = grantDailyHints(first.save, NOON - DAY);
    expect(second.granted).toBe(0);
    expect(second.save.hints.balance).toBe(first.save.hints.balance);

    // Am echten Folgetag gibt es sie wieder.
    const third = grantDailyHints(second.save, NOON + DAY);
    expect(third.granted).toBe(HINTS.dailyFreeGrant);
  });
});

describe('Tipp-Kontingent', () => {
  it('startet mit dem konfigurierten Guthaben', () => {
    expect(createDefaultSave(NOON).hints.balance).toBe(HINTS.initialBalance);
  });

  it('verbraucht Tipps und zaehlt sie in der Statistik mit', () => {
    const save = createDefaultSave(NOON);
    const { save: after, spent } = spendHint(save);
    expect(spent).toBe(true);
    expect(after.hints.balance).toBe(HINTS.initialBalance - 1);
    expect(after.stats.hintsSpent).toBe(1);
  });

  it('laesst sich nicht ins Minus bringen', () => {
    let save = createDefaultSave(NOON);
    for (let index = 0; index < HINTS.initialBalance; index++) {
      save = spendHint(save).save;
    }
    const { save: after, spent } = spendHint(save);
    expect(spent).toBe(false);
    expect(after.hints.balance).toBe(0);
  });

  it('ignoriert Gutschriften mit unsinnigem Betrag', () => {
    const save = createDefaultSave(NOON);
    expect(addHints(save, 0)).toBe(save);
    expect(addHints(save, -5)).toBe(save);
  });
});

describe('Tageslimit fuer belohnte Videos', () => {
  it('zaehlt Videos und begrenzt sie auf das Tagesmaximum', () => {
    let save = createDefaultSave(NOON);
    expect(remainingRewardedToday(save, NOON)).toBe(ADS.maxRewardedPerDay);

    for (let index = 0; index < ADS.maxRewardedPerDay; index++) {
      save = registerRewardedWatch(save, NOON);
    }
    expect(remainingRewardedToday(save, NOON)).toBe(0);
    expect(save.hints.balance).toBe(
      HINTS.initialBalance + ADS.maxRewardedPerDay * HINTS.rewardedGrant,
    );
  });

  it('setzt das Limit am naechsten Tag zurueck', () => {
    let save = createDefaultSave(NOON);
    save = registerRewardedWatch(save, NOON);
    expect(remainingRewardedToday(save, NOON + DAY)).toBe(ADS.maxRewardedPerDay);
  });

  it('laesst sich nicht durch Zurueckstellen der Uhr umgehen', () => {
    let save = createDefaultSave(NOON);
    for (let index = 0; index < ADS.maxRewardedPerDay; index++) {
      save = registerRewardedWatch(save, NOON);
    }
    expect(remainingRewardedToday(save, NOON - 5 * DAY)).toBe(0);
  });
});

describe('Fortschritt', () => {
  it('haelt Bestzeit und Statistik fest', () => {
    const save = recordSolved(createDefaultSave(NOON), {
      levelId: 'easy-0001',
      difficulty: 'easy',
      timeMs: 90_000,
      hintsUsed: 1,
    });

    expect(save.levels['easy-0001']).toEqual({
      solved: true,
      bestTimeMs: 90_000,
      hintsUsed: 1,
    });
    expect(save.stats.solvedTotal).toBe(1);
    expect(save.stats.solvedByDifficulty.easy).toBe(1);
    expect(averageSolveTime(save)).toBe(90_000);
  });

  it('uebernimmt nur eine schnellere Zeit als neue Bestzeit', () => {
    let save = recordSolved(createDefaultSave(NOON), {
      levelId: 'easy-0001',
      difficulty: 'easy',
      timeMs: 90_000,
      hintsUsed: 0,
    });
    save = recordSolved(save, {
      levelId: 'easy-0001',
      difficulty: 'easy',
      timeMs: 120_000,
      hintsUsed: 0,
    });
    expect(save.levels['easy-0001']?.bestTimeMs).toBe(90_000);

    save = recordSolved(save, {
      levelId: 'easy-0001',
      difficulty: 'easy',
      timeMs: 60_000,
      hintsUsed: 0,
    });
    expect(save.levels['easy-0001']?.bestTimeMs).toBe(60_000);

    // Ein zweites Mal geloest zaehlt nicht noch einmal als neu geschafftes Level.
    expect(save.stats.solvedByDifficulty.easy).toBe(1);
  });

  it('raeumt den Zwischenstand nach dem Loesen auf', () => {
    let save = storeInProgress(createDefaultSave(NOON), 'easy-0001', '0120', 5000);
    expect(save.inProgress['easy-0001']).toEqual({ counts: '0120', elapsedMs: 5000 });

    save = recordSolved(save, {
      levelId: 'easy-0001',
      difficulty: 'easy',
      timeMs: 9000,
      hintsUsed: 0,
    });
    expect(save.inProgress['easy-0001']).toBeUndefined();
  });

  it('laesst clearInProgress andere Level unberuehrt', () => {
    let save = storeInProgress(createDefaultSave(NOON), 'a', '0', 1);
    save = storeInProgress(save, 'b', '1', 2);
    save = clearInProgress(save, 'a');

    expect(save.inProgress['a']).toBeUndefined();
    expect(save.inProgress['b']).toEqual({ counts: '1', elapsedMs: 2 });
  });
});

describe('Tagesraetsel-Serie', () => {
  it('zaehlt aufeinanderfolgende Tage hoch', () => {
    let save = createDefaultSave(NOON);
    save = recordDailySolved(save, '2026-08-17');
    save = recordDailySolved(save, '2026-08-18');
    save = recordDailySolved(save, '2026-08-19');

    expect(save.daily.streak).toBe(3);
    expect(save.daily.longestStreak).toBe(3);
  });

  it('beginnt nach einer Luecke von vorn, behaelt aber die Bestmarke', () => {
    let save = createDefaultSave(NOON);
    save = recordDailySolved(save, '2026-08-15');
    save = recordDailySolved(save, '2026-08-16');
    save = recordDailySolved(save, '2026-08-19');

    expect(save.daily.streak).toBe(1);
    expect(save.daily.longestStreak).toBe(2);
  });

  it('zaehlt denselben Tag nicht doppelt', () => {
    let save = recordDailySolved(createDefaultSave(NOON), '2026-08-19');
    save = recordDailySolved(save, '2026-08-19');
    expect(save.daily.streak).toBe(1);
    expect(save.daily.solvedDays).toEqual(['2026-08-19']);
  });

  it('laesst die Serie ablaufen, wenn zwei Tage fehlen', () => {
    const save = recordDailySolved(createDefaultSave(NOON), '2026-08-19');
    expect(currentStreak(save, NOON)).toBe(1);
    expect(currentStreak(save, NOON + DAY)).toBe(1);
    expect(currentStreak(save, NOON + 2 * DAY)).toBe(0);
  });
});
