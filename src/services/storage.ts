import { Preferences } from '@capacitor/preferences';
import { STORAGE } from '../config/game.ts';
import { createDefaultSave, type SaveData } from '../core/progression.ts';
import { deserializeSave, serializeSave } from '../core/saveSchema.ts';
import { isNativePlatform } from './platform.ts';

/**
 * Persistenz des Spielstands.
 *
 * Nativ ueber @capacitor/preferences, im Browser ueber localStorage — dieselbe
 * Schnittstelle, damit die App ohne Geraet vollstaendig entwickelbar bleibt.
 *
 * **Warum zwei Slots:** Preferences kennt kein atomares Ersetzen. Wird die App
 * mitten im Schreiben beendet, waere ein einzelner Schluessel halb beschrieben und
 * der Fortschritt weg. Deshalb wird abwechselnd nach `save.a` und `save.b`
 * geschrieben und erst danach der Zeiger `save.ptr` umgelegt. Bricht etwas ab,
 * zeigt der Zeiger noch auf den vollstaendigen alten Slot.
 */

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

const nativeStore: KeyValueStore = {
  get: async (key) => (await Preferences.get({ key })).value,
  set: async (key, value) => {
    await Preferences.set({ key, value });
  },
  remove: async (key) => {
    await Preferences.remove({ key });
  },
};

const webStore: KeyValueStore = {
  get: (key) => Promise.resolve(safeLocalStorage()?.getItem(key) ?? null),
  set: (key, value) => {
    safeLocalStorage()?.setItem(key, value);
    return Promise.resolve();
  },
  remove: (key) => {
    safeLocalStorage()?.removeItem(key);
    return Promise.resolve();
  },
};

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Kann im privaten Modus mancher Browser werfen.
    return null;
  }
}

/** Fuer Tests eingesetzter Ersatz; null bedeutet automatische Wahl. */
let injectedStore: KeyValueStore | null = null;

let nextSlot: 'a' | 'b' = 'a';
let pendingSave: SaveData | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
let writeChain: Promise<void> = Promise.resolve();

function store(): KeyValueStore {
  if (injectedStore) {
    return injectedStore;
  }
  return isNativePlatform() ? nativeStore : webStore;
}

/**
 * Setzt einen eigenen Speicher ein. Gedacht fuer Tests — und als Einstiegspunkt,
 * falls spaeter eine weitere Plattform dazukommt.
 */
export function setStorageBackend(backend: KeyValueStore | null): void {
  injectedStore = backend;
  nextSlot = 'a';
  pendingSave = null;
  if (writeTimer !== null) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
}

/** Speicher im Arbeitsspeicher, fuer Tests. */
export function createMemoryStore(): KeyValueStore & { readonly data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: (key) => Promise.resolve(data.get(key) ?? null),
    set: (key, value) => {
      data.set(key, value);
      return Promise.resolve();
    },
    remove: (key) => {
      data.delete(key);
      return Promise.resolve();
    },
  };
}

/** Laedt den Spielstand. Ist nichts oder nur Unbrauchbares da, entsteht ein neuer. */
export async function loadSave(nowMs = Date.now()): Promise<SaveData> {
  const backend = store();
  const pointer = await backend.get(STORAGE.keys.pointer);
  const order =
    pointer === 'b'
      ? [STORAGE.keys.slotB, STORAGE.keys.slotA]
      : [STORAGE.keys.slotA, STORAGE.keys.slotB];

  for (const key of order) {
    const raw = await backend.get(key);
    if (raw === null) {
      continue;
    }
    const parsed = deserializeSave(raw, nowMs);
    if (parsed) {
      return parsed;
    }
  }

  return createDefaultSave(nowMs);
}

/** Schreibt sofort, ohne Entprellung. */
export async function writeSave(save: SaveData): Promise<void> {
  const backend = store();
  const slot = nextSlot;
  const key = slot === 'a' ? STORAGE.keys.slotA : STORAGE.keys.slotB;

  await backend.set(key, serializeSave(save));
  await backend.set(STORAGE.keys.pointer, slot);

  nextSlot = slot === 'a' ? 'b' : 'a';
}

/**
 * Merkt den Stand vor und schreibt entprellt.
 * Waehrend des Spielens aendert sich der Stand nach jedem Zug — ohne Entprellung
 * waere das unnoetig viel Schreiblast.
 */
export function scheduleSave(save: SaveData): void {
  pendingSave = save;
  if (writeTimer !== null) {
    return;
  }
  writeTimer = setTimeout(() => {
    writeTimer = null;
    void flushSave();
  }, STORAGE.writeDebounceMs);
}

/**
 * Schreibt einen vorgemerkten Stand sofort.
 * Wird beim Pausieren der App aufgerufen, damit nichts verloren geht, wenn
 * Android den Prozess beendet.
 */
export function flushSave(): Promise<void> {
  if (writeTimer !== null) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  const save = pendingSave;
  pendingSave = null;
  if (!save) {
    return writeChain;
  }
  writeChain = writeChain.then(() => writeSave(save));
  return writeChain;
}

/** Loescht den Spielstand vollstaendig. Nur ueber die Einstellungen erreichbar. */
export async function clearSave(): Promise<void> {
  const backend = store();
  pendingSave = null;
  if (writeTimer !== null) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  await backend.remove(STORAGE.keys.slotA);
  await backend.remove(STORAGE.keys.slotB);
  await backend.remove(STORAGE.keys.pointer);
}
