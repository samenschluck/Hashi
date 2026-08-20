import { buildBoard, type IslandSpec } from './geometry.ts';
import type { Board, BridgeCount } from './types.ts';

/**
 * Liest ein Board aus einer Textdarstellung — gedacht fuer handgeschriebene
 * Testfaelle und fuer Fehlerberichte.
 *
 * Ziffern 1–8 sind Inseln, `.` ist eine leere Zelle. Leerzeichen dienen nur der
 * Lesbarkeit und werden entfernt, so dass beide Schreibweisen dasselbe Board ergeben:
 *
 * ```
 * 2 . 3      2.3
 * . . .  ==  ...
 * 1 . 2      1.2
 * ```
 */
export function parseBoard(text: string): Board {
  const rows = text
    .split('\n')
    .map((line) => line.replace(/[ \t]/g, ''))
    .filter((line) => line.length > 0);

  if (rows.length === 0) {
    throw new SyntaxError('Leeres Board');
  }

  const width = rows[0]!.length;
  const specs: IslandSpec[] = [];

  rows.forEach((row, y) => {
    if (row.length !== width) {
      throw new SyntaxError(
        `Zeile ${String(y)} hat ${String(row.length)} Zellen, erwartet wurden ${String(width)}`,
      );
    }
    for (let x = 0; x < row.length; x++) {
      const char = row[x]!;
      if (char === '.') {
        continue;
      }
      const value = Number.parseInt(char, 10);
      if (Number.isNaN(value) || value < 1 || value > 8) {
        throw new SyntaxError(`Unbekanntes Zeichen "${char}" bei (${String(x)}, ${String(y)})`);
      }
      specs.push({ x, y, required: value });
    }
  });

  return buildBoard(width, rows.length, specs);
}

/**
 * Zeichnet ein Board mit gesetzten Bruecken als Text — nuetzlich fuer
 * Testausgaben und zum Debuggen des Solvers.
 */
export function renderBoardAscii(board: Board, counts: ArrayLike<number>): string {
  const grid: string[][] = Array.from({ length: board.height }, () =>
    Array.from({ length: board.width }, () => ' '),
  );

  for (const island of board.islands) {
    grid[island.y]![island.x] = String(island.required);
  }

  for (const edge of board.edges) {
    const count = counts[edge.id] ?? 0;
    if (count === 0) {
      continue;
    }
    const a = board.islands[edge.a]!;
    const b = board.islands[edge.b]!;
    const symbol = edge.horizontal ? (count === 1 ? '-' : '=') : count === 1 ? '|' : '‖';

    if (edge.horizontal) {
      for (let x = Math.min(a.x, b.x) + 1; x < Math.max(a.x, b.x); x++) {
        grid[a.y]![x] = symbol;
      }
    } else {
      for (let y = Math.min(a.y, b.y) + 1; y < Math.max(a.y, b.y); y++) {
        grid[y]![a.x] = symbol;
      }
    }
  }

  return grid.map((row) => row.join('')).join('\n');
}

/** Kompakte Serialisierung eines Brueckenstands als Ziffernkette. */
export function serializeCounts(counts: ArrayLike<number>): string {
  let result = '';
  for (let i = 0; i < counts.length; i++) {
    result += String(counts[i] ?? 0);
  }
  return result;
}

/** Gegenstueck zu `serializeCounts`. */
export function deserializeCounts(text: string): BridgeCount[] {
  return Array.from(text, (char) => {
    const value = Number.parseInt(char, 10);
    if (value !== 0 && value !== 1 && value !== 2) {
      throw new SyntaxError(`Ungueltiger Brueckenwert "${char}"`);
    }
    return value;
  });
}
