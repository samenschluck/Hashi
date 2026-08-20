import type { Difficulty } from '../config/game.ts';
import type { BridgeCount, Cell, Island, PuzzleDefinition } from './types.ts';

/**
 * Platzsparende Form eines Raetsels fuer die ausgelieferten JSON-Dateien.
 *
 * Inseln liegen als flache Dreiergruppen (x, y, Wert), die Loesung als Ziffernkette.
 * Bei 150 Raetseln je Schwierigkeitsgrad spart das gegenueber ausgeschriebenen
 * Objekten mehr als die Haelfte der Dateigroesse — und die App laedt es beim Start.
 */
export interface PackedPuzzle {
  readonly id: string;
  readonly seed: string;
  /** Flache Dreiergruppen: x, y, geforderte Brueckenenden. */
  readonly islands: readonly number[];
  /** Eine Ziffer je Kante, in der Kantenreihenfolge von `buildBoard`. */
  readonly solution: string;
  /**
   * Gesperrte Zellen als flache Paare (x, y). Fehlt bei Raetseln ohne Mauern —
   * das spart in den Dateien der leichten Grade jedes Byte.
   */
  readonly blocked?: readonly number[];
  /**
   * Indizes der Inseln, deren Zahl verborgen ist. Fehlt, wenn keine verborgen
   * ist. Die Zahl selbst steht trotzdem in `islands` — sie wird zum Zeichnen der
   * geloesten Ansicht gebraucht, nie als Bedingung.
   */
  readonly hidden?: readonly number[];
}

/** Eine ausgelieferte Raetseldatei. */
export interface PuzzlePack {
  readonly difficulty: Difficulty;
  readonly size: number;
  readonly puzzles: readonly PackedPuzzle[];
}

export function packPuzzle(puzzle: PuzzleDefinition): PackedPuzzle {
  const islands: number[] = [];
  for (const island of puzzle.islands) {
    islands.push(island.x, island.y, island.required);
  }
  const packed: PackedPuzzle = {
    id: puzzle.id,
    seed: puzzle.seed,
    islands,
    solution: puzzle.solution.join(''),
  };

  const blocked: number[] = [];
  for (const cell of puzzle.blocked) {
    blocked.push(cell.x, cell.y);
  }
  const hidden = puzzle.islands.filter((island) => island.hidden).map((island) => island.id);

  return {
    ...packed,
    ...(blocked.length > 0 ? { blocked } : {}),
    ...(hidden.length > 0 ? { hidden } : {}),
  };
}

export function unpackPuzzle(
  packed: PackedPuzzle,
  difficulty: Difficulty,
  size: number,
): PuzzleDefinition {
  if (packed.islands.length % 3 !== 0) {
    throw new SyntaxError(`Inseldaten von ${packed.id} sind unvollstaendig`);
  }

  const hiddenIds = new Set(packed.hidden ?? []);
  const islands: Island[] = [];
  for (let index = 0; index < packed.islands.length; index += 3) {
    const id = islands.length;
    islands.push({
      id,
      x: packed.islands[index]!,
      y: packed.islands[index + 1]!,
      required: packed.islands[index + 2]!,
      hidden: hiddenIds.has(id),
    });
  }

  const rawBlocked = packed.blocked ?? [];
  if (rawBlocked.length % 2 !== 0) {
    throw new SyntaxError(`Mauerdaten von ${packed.id} sind unvollstaendig`);
  }
  const blocked: Cell[] = [];
  for (let index = 0; index < rawBlocked.length; index += 2) {
    blocked.push({ x: rawBlocked[index]!, y: rawBlocked[index + 1]! });
  }

  const solution: BridgeCount[] = Array.from(packed.solution, (char) => {
    const value = Number.parseInt(char, 10);
    if (value !== 0 && value !== 1 && value !== 2) {
      throw new SyntaxError(`Ungueltiger Brueckenwert "${char}" in ${packed.id}`);
    }
    return value;
  });

  return {
    id: packed.id,
    seed: packed.seed,
    difficulty,
    width: size,
    height: size,
    islands,
    solution,
    blocked,
  };
}
