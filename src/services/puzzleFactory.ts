import type { Difficulty } from '../config/game.ts';
import { tryGenerate } from '../core/generator.ts';
import type { PuzzleDefinition } from '../core/types.ts';
import type { GenerateRequest, GenerateResponse } from '../workers/generate.worker.ts';

/**
 * Erzeugt Raetsel zur Laufzeit — bevorzugt in einem Worker, damit die Oberflaeche
 * nie stockt. Steht kein Worker zur Verfuegung (aeltere WebView, Testumgebung),
 * wird direkt gerechnet; das Ergebnis ist identisch, nur eben auf dem Hauptthread.
 */

let worker: Worker | null = null;
let workerUnavailable = false;
let nextRequestId = 1;

const pending = new Map<number, (puzzle: PuzzleDefinition | null) => void>();

function ensureWorker(): Worker | null {
  if (worker || workerUnavailable) {
    return worker;
  }
  if (typeof Worker === 'undefined') {
    workerUnavailable = true;
    return null;
  }

  try {
    worker = new Worker(new URL('../workers/generate.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.addEventListener('message', (event: MessageEvent<GenerateResponse>) => {
      const resolve = pending.get(event.data.requestId);
      if (resolve) {
        pending.delete(event.data.requestId);
        resolve(event.data.puzzle);
      }
    });
    worker.addEventListener('error', () => {
      // Ab hier wird synchron weitergerechnet, statt haengen zu bleiben.
      workerUnavailable = true;
      for (const [, resolve] of pending) {
        resolve(null);
      }
      pending.clear();
      worker?.terminate();
      worker = null;
    });
  } catch {
    workerUnavailable = true;
    worker = null;
  }

  return worker;
}

/** Erzeugt ein Raetsel; faellt bei Problemen auf synchrone Berechnung zurueck. */
export function generatePuzzle(
  seed: string,
  difficulty: Difficulty,
): Promise<PuzzleDefinition | null> {
  const active = ensureWorker();
  if (!active) {
    return Promise.resolve(tryGenerate(seed, difficulty));
  }

  return new Promise((resolve) => {
    const requestId = nextRequestId++;
    pending.set(requestId, (puzzle) => {
      resolve(puzzle ?? tryGenerate(seed, difficulty));
    });
    const request: GenerateRequest = { requestId, seed, difficulty };
    active.postMessage(request);
  });
}

/** Nur fuer Tests: gibt den Worker frei. */
export function disposePuzzleFactory(): void {
  worker?.terminate();
  worker = null;
  workerUnavailable = false;
  pending.clear();
}
