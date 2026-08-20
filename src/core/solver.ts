import { ConstraintStore, type DeductionLevel } from './deductions.ts';
import { UnionFind } from './unionFind.ts';
import type { Board } from './types.ts';

export interface SolveOptions {
  /**
   * Abbruch, sobald so viele Loesungen gefunden sind.
   * Fuer die Eindeutigkeitspruefung reicht 2 — mehr braucht niemand zu wissen.
   */
  readonly maxSolutions?: number;
  /** Deduktionstiefe der Propagation. Beeinflusst nur die Geschwindigkeit, nie das Ergebnis. */
  readonly level?: DeductionLevel;
}

export interface SolveResult {
  /** Gefundene Loesungen, hoechstens `maxSolutions` viele. */
  readonly solutions: readonly Uint8Array[];
  /** Anzahl der gefundenen Loesungen (durch `maxSolutions` gedeckelt). */
  readonly count: number;
}

/** Standardtiefe der Propagation im Suchbaum: D7 waere hier zu teuer. */
const SEARCH_LEVEL: DeductionLevel = 3;

/**
 * Loest ein Board durch Constraint-Propagation mit anschliessendem Backtracking.
 *
 * Die Propagation schneidet nur nachweislich unmoegliche Werte weg, die Suche
 * zaehlt vollstaendig. Damit ist das Ergebnis ein Beweis und keine Schaetzung —
 * genau das braucht der Generator fuer die Eindeutigkeit.
 */
export function solve(board: Board, options: SolveOptions = {}): SolveResult {
  const maxSolutions = options.maxSolutions ?? 2;
  const level = options.level ?? SEARCH_LEVEL;

  const store = new ConstraintStore(board);
  const solutions: Uint8Array[] = [];

  store.propagate(level);
  if (!store.hasContradiction()) {
    search(store, board, level, maxSolutions, solutions);
  }

  return { solutions, count: solutions.length };
}

function search(
  store: ConstraintStore,
  board: Board,
  level: DeductionLevel,
  maxSolutions: number,
  solutions: Uint8Array[],
): void {
  if (solutions.length >= maxSolutions) {
    return;
  }

  const edgeId = store.selectBranchEdge();
  if (edgeId === -1) {
    const assignment = store.currentAssignment();
    if (isValidSolution(board, assignment)) {
      solutions.push(assignment);
    }
    return;
  }

  for (const value of store.candidates(edgeId)) {
    const mark = store.mark();
    store.fix(edgeId, value);
    if (!store.hasContradiction()) {
      store.propagate(level);
      if (!store.hasContradiction()) {
        search(store, board, level, maxSolutions, solutions);
      }
    }
    store.undoTo(mark);

    if (solutions.length >= maxSolutions) {
      return;
    }
  }
}

/** Zaehlt Loesungen bis zur Obergrenze. */
export function countSolutions(board: Board, limit = 2): number {
  return solve(board, { maxSolutions: limit }).count;
}

/** Hat das Board genau eine Loesung? Grundvoraussetzung fuer jedes ausgelieferte Raetsel. */
export function hasUniqueSolution(board: Board): boolean {
  return countSolutions(board, 2) === 1;
}

/**
 * Prueft eine vollstaendige Belegung gegen alle Regeln:
 * Inselwerte exakt erfuellt, keine Kreuzungen, ein zusammenhaengendes Netz.
 */
export function isValidSolution(board: Board, counts: ArrayLike<number>): boolean {
  const degrees = new Int32Array(board.islands.length);

  for (const edge of board.edges) {
    const count = counts[edge.id] ?? 0;
    if (count < 0 || count > 2) {
      return false;
    }
    if (count === 0) {
      continue;
    }
    degrees[edge.a] = degrees[edge.a]! + count;
    degrees[edge.b] = degrees[edge.b]! + count;

    for (const other of board.crossings[edge.id]!) {
      if ((counts[other] ?? 0) > 0) {
        return false;
      }
    }
  }

  for (let islandId = 0; islandId < degrees.length; islandId++) {
    if (degrees[islandId] !== board.required[islandId]) {
      return false;
    }
  }

  if (board.islands.length <= 1) {
    return true;
  }

  const unionFind = new UnionFind(board.islands.length);
  for (const edge of board.edges) {
    if ((counts[edge.id] ?? 0) > 0) {
      unionFind.union(edge.a, edge.b);
    }
  }
  return unionFind.components === 1;
}
