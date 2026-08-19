import { create } from 'zustand';
import { buildBoard } from '../core/geometry.ts';
import { PuzzleState } from '../core/puzzleState.ts';
import { clampZoom } from '../input/gestures.ts';
import {
  hapticBridgePlaced,
  hapticIslandSatisfied,
  hapticRejected,
  hapticSolved,
} from '../services/haptics.ts';
import type { Board, BridgeCount, PuzzleDefinition } from '../core/types.ts';

export interface GameStore {
  readonly puzzle: PuzzleDefinition | null;
  readonly board: Board | null;
  /**
   * Brueckenstand als eigene Kopie. Der veraenderliche `PuzzleState` bleibt
   * ausserhalb des Stores; React braucht ein neues Objekt, um neu zu zeichnen.
   */
  readonly counts: Uint8Array;
  readonly selectedIsland: number | null;
  readonly previewEdge: number | null;
  readonly hintEdge: number | null;
  readonly lastChangedEdge: number | null;
  readonly solved: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;

  loadPuzzle: (puzzle: PuzzleDefinition, savedCounts?: ArrayLike<number>) => void;
  cycleEdge: (edgeId: number) => void;
  setEdge: (edgeId: number, count: BridgeCount) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  setSelection: (islandId: number | null) => void;
  setPreview: (edgeId: number | null) => void;
  setHintEdge: (edgeId: number | null) => void;
  setTransform: (zoom: number, panX: number, panY: number) => void;
}

/** Der veraenderliche Spielstand liegt bewusst neben dem Store, nicht darin. */
let activeState: PuzzleState | null = null;

const EMPTY_COUNTS = new Uint8Array(0);

export const useGameStore = create<GameStore>((set, get) => {
  /** Uebernimmt den aktuellen Spielstand in den Store und meldet Rueckmeldungen. */
  const commit = (changedEdge: number | null, previousSolved: boolean): void => {
    const state = activeState;
    if (!state) {
      return;
    }
    const solved = state.isSolved();
    set({
      counts: state.snapshot(),
      canUndo: state.canUndo,
      canRedo: state.canRedo,
      solved,
      lastChangedEdge: changedEdge,
    });
    if (solved && !previousSolved) {
      hapticSolved();
    }
  };

  return {
    puzzle: null,
    board: null,
    counts: EMPTY_COUNTS,
    selectedIsland: null,
    previewEdge: null,
    hintEdge: null,
    lastChangedEdge: null,
    solved: false,
    canUndo: false,
    canRedo: false,
    zoom: 1,
    panX: 0,
    panY: 0,

    loadPuzzle: (puzzle, savedCounts) => {
      const board = buildBoard(puzzle.width, puzzle.height, puzzle.islands);
      const state = new PuzzleState(board);
      if (savedCounts) {
        state.restore(savedCounts);
      }
      activeState = state;

      set({
        puzzle,
        board,
        counts: state.snapshot(),
        selectedIsland: null,
        previewEdge: null,
        hintEdge: null,
        lastChangedEdge: null,
        solved: state.isSolved(),
        canUndo: false,
        canRedo: false,
        zoom: 1,
        panX: 0,
        panY: 0,
      });
    },

    cycleEdge: (edgeId) => {
      const state = activeState;
      const board = get().board;
      if (!state || !board) {
        return;
      }
      const wasSolved = get().solved;
      const edge = board.edges[edgeId];
      const satisfiedBefore = edge
        ? state.islandStatus(edge.a) === 'satisfied' && state.islandStatus(edge.b) === 'satisfied'
        : false;

      const move = state.cycle(edgeId);
      if (!move) {
        // Geometrisch unzulaessig — der einzige Fall, in dem ein Zug abgelehnt wird.
        hapticRejected();
        return;
      }

      const satisfiedAfter =
        edge !== undefined &&
        state.islandStatus(edge.a) === 'satisfied' &&
        state.islandStatus(edge.b) === 'satisfied';

      if (satisfiedAfter && !satisfiedBefore) {
        hapticIslandSatisfied();
      } else {
        hapticBridgePlaced();
      }

      commit(edgeId, wasSolved);
    },

    setEdge: (edgeId, count) => {
      const state = activeState;
      if (!state) {
        return;
      }
      const wasSolved = get().solved;
      const move = state.set(edgeId, count);
      if (!move) {
        hapticRejected();
        return;
      }
      hapticBridgePlaced();
      commit(edgeId, wasSolved);
    },

    undo: () => {
      const state = activeState;
      if (!state) {
        return;
      }
      const wasSolved = get().solved;
      const move = state.undo();
      if (move) {
        commit(move.edgeId, wasSolved);
      }
    },

    redo: () => {
      const state = activeState;
      if (!state) {
        return;
      }
      const wasSolved = get().solved;
      const move = state.redo();
      if (move) {
        commit(move.edgeId, wasSolved);
      }
    },

    reset: () => {
      const state = activeState;
      if (!state) {
        return;
      }
      state.reset();
      set({
        counts: state.snapshot(),
        selectedIsland: null,
        previewEdge: null,
        hintEdge: null,
        lastChangedEdge: null,
        solved: false,
        canUndo: false,
        canRedo: false,
      });
    },

    setSelection: (islandId) => {
      set({ selectedIsland: islandId });
    },
    setPreview: (edgeId) => {
      set({ previewEdge: edgeId });
    },
    setHintEdge: (edgeId) => {
      set({ hintEdge: edgeId });
    },
    setTransform: (zoom, panX, panY) => {
      set({ zoom: clampZoom(zoom), panX, panY });
    },
  };
});

/** Nur fuer Tests und fuer Module, die den rohen Spielstand brauchen. */
export function currentPuzzleState(): PuzzleState | null {
  return activeState;
}
