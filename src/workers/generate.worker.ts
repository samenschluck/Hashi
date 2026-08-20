/// <reference lib="webworker" />
import { tryGenerate } from '../core/generator.ts';
import type { Difficulty } from '../config/game.ts';
import type { PuzzleDefinition } from '../core/types.ts';

/**
 * Erzeugt Raetsel im Hintergrund.
 *
 * Ein Experten-Raetsel braucht im Median rund 30 ms, im ungluecklichen Fall auch
 * ein Vielfaches davon. Auf dem Hauptthread waere das ein sichtbarer Hakler,
 * deshalb laeuft die Generierung fuer den Endlosmodus hier.
 */

export interface GenerateRequest {
  readonly requestId: number;
  readonly seed: string;
  readonly difficulty: Difficulty;
}

export interface GenerateResponse {
  readonly requestId: number;
  readonly puzzle: PuzzleDefinition | null;
}

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.addEventListener('message', (event: MessageEvent<GenerateRequest>) => {
  const { requestId, seed, difficulty } = event.data;
  const puzzle = tryGenerate(seed, difficulty);
  const response: GenerateResponse = { requestId, puzzle };
  scope.postMessage(response);
});
