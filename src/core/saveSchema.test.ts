import { describe, expect, it } from 'vitest';
import { STORAGE } from '../config/game.ts';
import { createDefaultSave, recordSolved, type SaveData } from './progression.ts';
import { deserializeSave, migrateSave, serializeSave } from './saveSchema.ts';

const NOON = new Date(2026, 7, 19, 12, 0, 0).getTime();

function sampleSave(): SaveData {
  return recordSolved(createDefaultSave(NOON), {
    levelId: 'medium-0007',
    difficulty: 'medium',
    timeMs: 61_000,
    hintsUsed: 2,
    undosUsed: 0,
  });
}

describe('serializeSave / deserializeSave', () => {
  it('ueberlebt einen vollstaendigen Umlauf', () => {
    const save = sampleSave();
    const restored = deserializeSave(serializeSave(save), NOON);
    expect(restored).toEqual(save);
  });

  it('erkennt einen abgeschnittenen Text', () => {
    const text = serializeSave(sampleSave());
    expect(deserializeSave(text.slice(0, text.length - 20), NOON)).toBeNull();
  });

  it('erkennt nachtraeglich veraenderten Inhalt', () => {
    const text = serializeSave(sampleSave());
    expect(deserializeSave(text.replace('"balance":5', '"balance":999'), NOON)).toBeNull();
  });

  it('liefert null statt zu werfen, wenn gar kein Spielstand darin steht', () => {
    expect(deserializeSave('kein-spielstand', NOON)).toBeNull();
    expect(deserializeSave('', NOON)).toBeNull();
  });
});

describe('migrateSave', () => {
  it('macht aus Unsinn einen frischen Spielstand statt eines Absturzes', () => {
    for (const input of [null, undefined, 42, 'text', [], { schemaVersion: 'x' }]) {
      const save = migrateSave(input, NOON);
      expect(save.schemaVersion).toBe(STORAGE.schemaVersion);
      expect(save.levels).toEqual({});
    }
  });

  it('rettet, was lesbar ist, und ergaenzt den Rest', () => {
    const save = migrateSave(
      {
        schemaVersion: 1,
        settings: { locale: 'en', theme: 'unsinn', vibration: false },
        levels: {
          'easy-0001': { solved: true, bestTimeMs: 1234, hintsUsed: 1, undosUsed: 0 },
          kaputt: 'kein Objekt',
        },
        hints: { balance: 3 },
        stats: { solvedTotal: 7 },
      },
      NOON,
    );

    expect(save.settings.locale).toBe('en');
    expect(save.settings.vibration).toBe(false);
    // Unbekannter Wert faellt auf den Standard zurueck.
    expect(save.settings.theme).toBe('system');
    expect(save.settings.sound).toBe(true);

    // Ein alter Spielstand kennt keine Sterne: er bekommt 0 und kann sie beim
    // naechsten Durchgang verdienen. Rueckwirkend zu bewerten waere geraten.
    expect(save.levels['easy-0001']).toEqual({
      solved: true,
      bestTimeMs: 1234,
      hintsUsed: 1,
      stars: 0,
    });
    expect(save.levels['kaputt']).toBeUndefined();

    expect(save.hints.balance).toBe(3);
    expect(save.stats.solvedTotal).toBe(7);
    expect(save.stats.solvedByDifficulty).toEqual({ easy: 0, medium: 0, hard: 0, expert: 0 });
  });

  it('verwirft Zwischenstaende mit ungueltigen Brueckenwerten', () => {
    const save = migrateSave(
      {
        schemaVersion: 1,
        inProgress: {
          gut: { counts: '01201', elapsedMs: 500 },
          schlecht: { counts: '0139', elapsedMs: 500 },
        },
      },
      NOON,
    );

    expect(save.inProgress['gut']).toEqual({ counts: '01201', elapsedMs: 500 });
    expect(save.inProgress['schlecht']).toBeUndefined();
  });

  it('beginnt bei einem Stand aus einer neueren App-Version neu', () => {
    const save = migrateSave(
      { schemaVersion: STORAGE.schemaVersion + 1, hints: { balance: 999 } },
      NOON,
    );
    expect(save.hints.balance).not.toBe(999);
  });

  it('laesst negative Werte nicht durch', () => {
    const save = migrateSave(
      { schemaVersion: 1, hints: { balance: -10 }, stats: { hintsSpent: -3 } },
      NOON,
    );
    expect(save.hints.balance).toBe(0);
    expect(save.stats.hintsSpent).toBe(0);
  });
});
