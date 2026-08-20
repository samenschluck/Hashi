import { MAX_ISLAND_VALUE } from '../config/game.ts';
import type { Board, Cell, EdgeDef, Island, PuzzleDefinition } from './types.ts';

/** Rohbeschreibung einer Insel, bevor Ids vergeben sind. */
export interface IslandSpec {
  readonly x: number;
  readonly y: number;
  readonly required: number;
}

/**
 * Baut die vorberechnete Board-Struktur aus einer Inselmenge.
 *
 * Die Kantenreihenfolge ist deterministisch und damit als stabiler Index fuer
 * Loesungen und Spielstaende verwendbar:
 * Inseln werden nach (y, x) sortiert und in dieser Reihenfolge nummeriert;
 * fuer jede Insel wird zuerst der rechte, dann der untere Nachbar betrachtet.
 *
 * Zwei Inseln gelten als benachbart, wenn sie in derselben Zeile oder Spalte
 * liegen, keine Insel dazwischen liegt und mindestens eine freie Zelle Platz
 * fuer die Bruecke bleibt. Direkt aneinandergrenzende Inseln sind in
 * Hashiwokakero nicht vorgesehen und werden als Fehler gemeldet.
 */
export function buildBoard(
  width: number,
  height: number,
  specs: readonly IslandSpec[],
  walls: readonly Cell[] = [],
): Board {
  if (width <= 0 || height <= 0) {
    throw new RangeError('Boardgroesse muss positiv sein');
  }

  const blocked = new Uint8Array(width * height);
  for (const wall of walls) {
    if (wall.x < 0 || wall.x >= width || wall.y < 0 || wall.y >= height) {
      throw new RangeError(`Mauer ausserhalb des Gitters: (${String(wall.x)}, ${String(wall.y)})`);
    }
    blocked[wall.y * width + wall.x] = 1;
  }

  const sorted = [...specs].sort((left, right) => left.y - right.y || left.x - right.x);

  const grid = new Int32Array(width * height).fill(-1);
  const islands: Island[] = [];

  for (const spec of sorted) {
    if (spec.x < 0 || spec.x >= width || spec.y < 0 || spec.y >= height) {
      throw new RangeError(`Insel ausserhalb des Gitters: (${String(spec.x)}, ${String(spec.y)})`);
    }
    if (spec.required < 1 || spec.required > MAX_ISLAND_VALUE) {
      throw new RangeError(`Inselwert ${String(spec.required)} liegt ausserhalb von 1..8`);
    }
    const cell = spec.y * width + spec.x;
    if (grid[cell] !== -1) {
      throw new RangeError(`Doppelte Insel auf (${String(spec.x)}, ${String(spec.y)})`);
    }
    if (blocked[cell] === 1) {
      throw new RangeError(`Insel auf gesperrter Zelle: (${String(spec.x)}, ${String(spec.y)})`);
    }
    const id = islands.length;
    grid[cell] = id;
    islands.push({ id, x: spec.x, y: spec.y, required: spec.required });
  }

  const edges: EdgeDef[] = [];
  const edgesByIsland: number[][] = islands.map(() => []);

  const addEdge = (a: number, b: number, horizontal: boolean): void => {
    const id = edges.length;
    edges.push({ id, a, b, horizontal });
    edgesByIsland[a]!.push(id);
    edgesByIsland[b]!.push(id);
  };

  // Eine Mauer unterbricht die Sichtlinie: die Suche nach dem naechsten Nachbarn
  // endet dort, auch wenn dahinter noch eine Insel in derselben Reihe steht.
  for (const island of islands) {
    // Rechter Nachbar in derselben Zeile
    for (let x = island.x + 1; x < width; x++) {
      const cell = island.y * width + x;
      if (blocked[cell] === 1) {
        break;
      }
      const other = grid[cell]!;
      if (other === -1) {
        continue;
      }
      if (x === island.x + 1) {
        throw new RangeError(
          `Inseln (${String(island.x)}, ${String(island.y)}) und (${String(x)}, ${String(island.y)}) grenzen direkt aneinander`,
        );
      }
      addEdge(island.id, other, true);
      break;
    }
    // Unterer Nachbar in derselben Spalte
    for (let y = island.y + 1; y < height; y++) {
      const cell = y * width + island.x;
      if (blocked[cell] === 1) {
        break;
      }
      const other = grid[cell]!;
      if (other === -1) {
        continue;
      }
      if (y === island.y + 1) {
        throw new RangeError(
          `Inseln (${String(island.x)}, ${String(island.y)}) und (${String(island.x)}, ${String(y)}) grenzen direkt aneinander`,
        );
      }
      addEdge(island.id, other, false);
      break;
    }
  }

  const crossings = computeCrossings(islands, edges);

  const required = new Uint8Array(islands.length);
  for (const island of islands) {
    required[island.id] = island.required;
  }

  return {
    width,
    height,
    islands,
    edges,
    edgesByIsland: edgesByIsland.map((list) => Object.freeze([...list])),
    crossings,
    required,
    blocked,
  };
}

/**
 * Board aus einem fertigen Raetsel.
 *
 * Bewusst die einzige Stelle, an der ein Board aus einer `PuzzleDefinition`
 * entsteht: wer `buildBoard` von Hand aufruft, vergisst irgendwann die Mauern,
 * und dann fehlen still ein paar Kanten zu viel oder zu wenig.
 */
export function boardFromPuzzle(puzzle: PuzzleDefinition): Board {
  return buildBoard(puzzle.width, puzzle.height, puzzle.islands, puzzle.blocked);
}

/**
 * Ermittelt fuer jede Kante die Kanten, die sie kreuzen.
 * Nur waagerecht/senkrecht kann sich kreuzen; parallele Kanten koennen sich
 * nicht ueberlappen, weil zwischen zwei benachbarten Inseln keine dritte liegt.
 */
function computeCrossings(
  islands: readonly Island[],
  edges: readonly EdgeDef[],
): readonly (readonly number[])[] {
  const result: number[][] = edges.map(() => []);

  const horizontal = edges.filter((edge) => edge.horizontal);
  const vertical = edges.filter((edge) => !edge.horizontal);

  for (const h of horizontal) {
    const hy = islands[h.a]!.y;
    const hx1 = Math.min(islands[h.a]!.x, islands[h.b]!.x);
    const hx2 = Math.max(islands[h.a]!.x, islands[h.b]!.x);

    for (const v of vertical) {
      const vx = islands[v.a]!.x;
      const vy1 = Math.min(islands[v.a]!.y, islands[v.b]!.y);
      const vy2 = Math.max(islands[v.a]!.y, islands[v.b]!.y);

      // Echte Kreuzung: der Schnittpunkt liegt strikt innerhalb beider Strecken.
      if (vx > hx1 && vx < hx2 && hy > vy1 && hy < vy2) {
        result[h.id]!.push(v.id);
        result[v.id]!.push(h.id);
      }
    }
  }

  return result.map((list) => Object.freeze(list));
}

/** Die Zellen zwischen zwei Inseln, die eine Bruecke belegt (ohne die Inseln selbst). */
export function edgeCells(board: Board, edgeId: number): { x: number; y: number }[] {
  const edge = board.edges[edgeId]!;
  const a = board.islands[edge.a]!;
  const b = board.islands[edge.b]!;
  const cells: { x: number; y: number }[] = [];

  if (edge.horizontal) {
    for (let x = Math.min(a.x, b.x) + 1; x < Math.max(a.x, b.x); x++) {
      cells.push({ x, y: a.y });
    }
  } else {
    for (let y = Math.min(a.y, b.y) + 1; y < Math.max(a.y, b.y); y++) {
      cells.push({ x: a.x, y });
    }
  }

  return cells;
}

/** Liefert die Kanten-Id zwischen zwei Inseln, falls es sie gibt. */
export function findEdge(board: Board, islandA: number, islandB: number): number | null {
  for (const edgeId of board.edgesByIsland[islandA] ?? []) {
    const edge = board.edges[edgeId]!;
    if (edge.a === islandB || edge.b === islandB) {
      return edgeId;
    }
  }
  return null;
}

/** Die jeweils andere Insel einer Kante. */
export function otherIsland(board: Board, edgeId: number, islandId: number): number {
  const edge = board.edges[edgeId]!;
  return edge.a === islandId ? edge.b : edge.a;
}
