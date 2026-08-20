import { afterEach, describe, expect, it } from 'vitest';
import { STORAGE } from '../config/game.ts';
import { createDefaultSave, recordSolved, type SaveData } from '../core/progression.ts';
import {
  clearSave,
  createMemoryStore,
  loadSave,
  scheduleSave,
  flushSave,
  setStorageBackend,
  writeSave,
} from './storage.ts';

const NOON = new Date(2026, 7, 19, 12, 0, 0).getTime();

function saveWith(levelId: string): SaveData {
  return recordSolved(createDefaultSave(NOON), {
    levelId,
    difficulty: 'easy',
    timeMs: 1000,
    hintsUsed: 0,
  });
}

afterEach(() => {
  setStorageBackend(null);
});

describe('Doppelpuffer', () => {
  it('schreibt abwechselnd in beide Slots und legt den Zeiger um', async () => {
    const store = createMemoryStore();
    setStorageBackend(store);

    await writeSave(saveWith('a'));
    expect(store.data.get(STORAGE.keys.pointer)).toBe('a');
    expect(store.data.has(STORAGE.keys.slotA)).toBe(true);

    await writeSave(saveWith('b'));
    expect(store.data.get(STORAGE.keys.pointer)).toBe('b');
    expect(store.data.has(STORAGE.keys.slotB)).toBe(true);
  });

  it('ueberlebt einen Absturz mitten im Schreiben', async () => {
    const store = createMemoryStore();
    setStorageBackend(store);

    await writeSave(saveWith('erster'));
    await writeSave(saveWith('zweiter'));

    // Genau das ist der Fall, den der Doppelpuffer abfangen soll: der naechste
    // Schreibvorgang geht nach Slot A und wird mittendrin abgebrochen, der
    // Zeiger steht deshalb noch auf B.
    store.data.set(STORAGE.keys.slotA, '9f3:{"schemaVersion":1,"settin');

    const loaded = await loadSave(NOON);
    expect(loaded.levels['zweiter']?.solved).toBe(true);
    expect(loaded.levels['erster']).toBeUndefined();
  });

  it('faellt auf den anderen Slot zurueck, wenn der Zeiger auf Schrott zeigt', async () => {
    const store = createMemoryStore();
    setStorageBackend(store);

    await writeSave(saveWith('heil'));
    // Zeiger sagt B, aber dort steht nichts Brauchbares.
    store.data.set(STORAGE.keys.pointer, 'b');
    store.data.set(STORAGE.keys.slotB, 'unlesbar');

    const loaded = await loadSave(NOON);
    expect(loaded.levels['heil']?.solved).toBe(true);
  });

  it('beginnt neu, wenn beide Slots unbrauchbar sind', async () => {
    const store = createMemoryStore();
    setStorageBackend(store);

    store.data.set(STORAGE.keys.pointer, 'a');
    store.data.set(STORAGE.keys.slotA, 'kaputt');
    store.data.set(STORAGE.keys.slotB, 'auch kaputt');

    const loaded = await loadSave(NOON);
    expect(loaded.levels).toEqual({});
    expect(loaded.stats.solvedTotal).toBe(0);
  });

  it('liefert einen frischen Stand, wenn noch nie gespeichert wurde', async () => {
    setStorageBackend(createMemoryStore());
    const loaded = await loadSave(NOON);
    expect(loaded.stats.solvedTotal).toBe(0);
  });
});

describe('Entprelltes Schreiben', () => {
  it('schreibt beim Fluss sofort und nicht erst nach Ablauf der Entprellung', async () => {
    const store = createMemoryStore();
    setStorageBackend(store);

    scheduleSave(saveWith('vorgemerkt'));
    expect(store.data.size).toBe(0);

    await flushSave();
    const loaded = await loadSave(NOON);
    expect(loaded.levels['vorgemerkt']?.solved).toBe(true);
  });

  it('schreibt nur den zuletzt vorgemerkten Stand', async () => {
    const store = createMemoryStore();
    setStorageBackend(store);

    scheduleSave(saveWith('alt'));
    scheduleSave(saveWith('neu'));
    await flushSave();

    const loaded = await loadSave(NOON);
    expect(loaded.levels['neu']?.solved).toBe(true);
    expect(loaded.levels['alt']).toBeUndefined();
  });
});

describe('clearSave', () => {
  it('entfernt beide Slots und den Zeiger', async () => {
    const store = createMemoryStore();
    setStorageBackend(store);

    await writeSave(saveWith('weg'));
    await clearSave();

    expect(store.data.size).toBe(0);
    expect((await loadSave(NOON)).levels).toEqual({});
  });
});
