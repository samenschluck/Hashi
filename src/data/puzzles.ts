import { BOARD_SIZE, type Difficulty } from '../config/game.ts';
import { unpackPuzzle, type PuzzlePack } from '../core/serialization.ts';
import type { PuzzleDefinition } from '../core/types.ts';

/**
 * Zugriff auf die ausgelieferten Raetsel.
 *
 * Die vier Dateien werden einzeln nachgeladen, nicht in das Startbundle
 * gepackt. Wer nur „Einfach" spielt, laedt die 57 KB fuer „Experte" nie.
 */
const loaders: Readonly<Record<Difficulty, () => Promise<unknown>>> = {
  easy: () => import('./puzzles/easy.json'),
  medium: () => import('./puzzles/medium.json'),
  hard: () => import('./puzzles/hard.json'),
  expert: () => import('./puzzles/expert.json'),
};

const cache = new Map<Difficulty, PuzzlePack>();

export async function loadPack(difficulty: Difficulty): Promise<PuzzlePack> {
  const cached = cache.get(difficulty);
  if (cached) {
    return cached;
  }

  const module = (await loaders[difficulty]()) as { default: PuzzlePack };
  const pack = module.default;
  cache.set(difficulty, pack);
  return pack;
}

/** Anzahl der Level eines Schwierigkeitsgrades. */
export async function levelCount(difficulty: Difficulty): Promise<number> {
  return (await loadPack(difficulty)).puzzles.length;
}

/** Laedt ein Level anhand seiner Position (0-basiert). */
export async function loadLevel(
  difficulty: Difficulty,
  index: number,
): Promise<PuzzleDefinition | null> {
  const pack = await loadPack(difficulty);
  const packed = pack.puzzles[index];
  return packed ? unpackPuzzle(packed, difficulty, pack.size) : null;
}

/** Alle Level-Ids eines Grades, in Spielreihenfolge. */
export async function levelIds(difficulty: Difficulty): Promise<string[]> {
  const pack = await loadPack(difficulty);
  return pack.puzzles.map((puzzle) => puzzle.id);
}

/** Level-Id fuer eine Position, ohne die ganze Datei zu entpacken. */
export async function levelIdAt(difficulty: Difficulty, index: number): Promise<string | null> {
  const pack = await loadPack(difficulty);
  return pack.puzzles[index]?.id ?? null;
}

/** Boardgroesse eines Grades, ohne Nachladen. */
export function boardSize(difficulty: Difficulty): number {
  return BOARD_SIZE[difficulty];
}
